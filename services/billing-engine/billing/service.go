package billing

import (
	"context"
	"fmt"

	"billing-engine/db"
	"github.com/jackc/pgx/v5"
)

// ProcessCheckout handles the core billing transaction
func ProcessCheckout(ctx context.Context, tenantID string, req CheckoutRequest) (*Invoice, error) {
	conn, err := db.Pool.Acquire(ctx)
	if err != nil {
		return nil, fmt.Errorf("could not acquire connection: %w", err)
	}
	defer conn.Release()

	tx, err := conn.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return nil, fmt.Errorf("could not begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	// 1. Fetch Tenant Settings for conversion rate and invoice prefix
	var conversionRate float64 = 0.1
	var prefix string = "INV-"
	err = tx.QueryRow(ctx, `
		SELECT "rewardConversionRate", "invoicePrefix" 
		FROM "TenantSettings" 
		WHERE "tenantId" = $1
	`, tenantID).Scan(&conversionRate, &prefix)
	if err != nil {
		// Fallback to defaults if no settings found
		conversionRate = 0.1
		prefix = "INV-"
	}

	var subtotal, taxTotal float64

	// Generate a unique invoice sequence using a per-tenant DB counter to avoid second-precision collisions
	var seqNum int64
	err = tx.QueryRow(ctx, `
		UPDATE "TenantSettings"
		SET "invoiceCounter" = COALESCE("invoiceCounter", 0) + 1
		WHERE "tenantId" = $1
		RETURNING "invoiceCounter"
	`, tenantID).Scan(&seqNum)
	if err != nil {
		return nil, fmt.Errorf("failed to generate invoice sequence: %w", err)
	}
	invoiceSequence := fmt.Sprintf("%s%06d", prefix, seqNum)

	// Insert invoice first to get ID
	var invoiceID string
	err = tx.QueryRow(ctx, `
		INSERT INTO "Invoice" ("id", "tenantId", "invoiceSequence", "customerId", "subtotal", "taxTotal", "grandTotal", "paymentMode", "status", "updatedAt")
		VALUES (gen_random_uuid(), $1, $2, $3, 0, 0, 0, $4, 'COMPLETED', NOW())
		RETURNING "id"
	`, tenantID, invoiceSequence, req.CustomerId, req.PaymentMode).Scan(&invoiceID)

	if err != nil {
		return nil, fmt.Errorf("failed to create invoice: %w", err)
	}

	for _, reqItem := range req.Items {
		// Fetch item details
		var price, gstRate float64
		err := tx.QueryRow(ctx, `SELECT "price", "gstRateDefault" FROM "Item" WHERE "id" = $1 AND "tenantId" = $2 AND "isActive" = true`, reqItem.ItemId, tenantID).Scan(&price, &gstRate)
		if err != nil {
			return nil, fmt.Errorf("item not found or error: %w", err)
		}

		// Apply per-line discount (0 means no discount — backward compatible)
		discountRate := reqItem.DiscountRate
		if discountRate < 0 {
			discountRate = 0
		}
		if discountRate > 100 {
			discountRate = 100
		}

		// Calculate line totals on discounted amount
		lineSubtotal := price * reqItem.Quantity * (1.0 - discountRate/100.0)
		lineTax := lineSubtotal * (gstRate / 100.0)
		cgst := lineTax / 2.0
		sgst := lineTax / 2.0

		subtotal += lineSubtotal
		taxTotal += lineTax

		// Insert InvoiceLine (includes discountRate column)
		_, err = tx.Exec(ctx, `
			INSERT INTO "InvoiceLine" ("id", "invoiceId", "itemId", "qty", "unitPrice", "taxableValue", "cgst", "sgst", "igst", "discountRate")
			VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, 0, $8)
		`, invoiceID, reqItem.ItemId, reqItem.Quantity, price, lineSubtotal, cgst, sgst, discountRate)
		if err != nil {
			return nil, fmt.Errorf("failed to insert invoice line: %w", err)
		}

		// Deduct stock — only if sufficient quantity exists
		tag, err := tx.Exec(ctx, `
			UPDATE "Item" SET "stockQty" = "stockQty" - $1
			WHERE "id" = $2 AND "stockQty" >= $1
		`, reqItem.Quantity, reqItem.ItemId)
		if err != nil {
			return nil, fmt.Errorf("failed to update stock: %w", err)
		}
		if tag.RowsAffected() == 0 {
			return nil, fmt.Errorf("insufficient stock for item %s", reqItem.ItemId)
		}
	}

	grandTotal := subtotal + taxTotal
	var pointsEarned float64 = 0
	var pointsRedeemed float64 = 0

	// 2. Rewards calculation and redemption
	if req.CustomerId != nil && *req.CustomerId != "" {
		// Calculate earned points from subtotal
		pointsEarned = subtotal * conversionRate

		if req.RedeemPoints {
			// Fetch customer totalRewardPoints
			var availablePoints float64
			err = tx.QueryRow(ctx, `SELECT "totalRewardPoints" FROM "Customer" WHERE "id" = $1 AND "tenantId" = $2`, *req.CustomerId, tenantID).Scan(&availablePoints)
			if err != nil {
				return nil, fmt.Errorf("failed to fetch customer reward points: %w", err)
			}

			// Determine how much can be redeemed
			pointsRedeemed = availablePoints
			if pointsRedeemed > grandTotal {
				pointsRedeemed = grandTotal
			}

			if pointsRedeemed > 0 {
				// Deduct redeemed points from grand total
				grandTotal -= pointsRedeemed

				// Update customer points balance (subtract redeemed)
				_, err = tx.Exec(ctx, `
					UPDATE "Customer" 
					SET "totalRewardPoints" = "totalRewardPoints" - $1 
					WHERE "id" = $2
				`, pointsRedeemed, *req.CustomerId)
				if err != nil {
					return nil, fmt.Errorf("failed to deduct customer reward points: %w", err)
				}

				// Record in RewardLedger
				_, err = tx.Exec(ctx, `
					INSERT INTO "RewardLedger" ("id", "tenantId", "customerId", "points", "transactionType", "invoiceId", "createdAt")
					VALUES (gen_random_uuid(), $1, $2, $3, 'REDEEM', $4, NOW())
				`, tenantID, *req.CustomerId, -pointsRedeemed, invoiceID)
				if err != nil {
					return nil, fmt.Errorf("failed to create reward ledger entry (redeem): %w", err)
				}
			}
		}

		// Add earned points to customer balance
		if pointsEarned > 0 {
			_, err = tx.Exec(ctx, `
				UPDATE "Customer" 
				SET "totalRewardPoints" = "totalRewardPoints" + $1 
				WHERE "id" = $2
			`, pointsEarned, *req.CustomerId)
			if err != nil {
				return nil, fmt.Errorf("failed to add customer reward points: %w", err)
			}

			// Record in RewardLedger
			_, err = tx.Exec(ctx, `
				INSERT INTO "RewardLedger" ("id", "tenantId", "customerId", "points", "transactionType", "invoiceId", "createdAt")
				VALUES (gen_random_uuid(), $1, $2, $3, 'EARN', $4, NOW())
			`, tenantID, *req.CustomerId, pointsEarned, invoiceID)
			if err != nil {
				return nil, fmt.Errorf("failed to create reward ledger entry (earn): %w", err)
			}
		}
	}

	// 3. Customer Credit check and update
	if req.PaymentMode == "CREDIT" {
		if req.CustomerId == nil || *req.CustomerId == "" {
			return nil, fmt.Errorf("customer must be linked for credit purchases")
		}

		// Fetch credit account limits
		var accountID string
		var creditLimit, currentDue float64
		err = tx.QueryRow(ctx, `
			SELECT "id", "creditLimit", "currentDue" 
			FROM "CreditAccount" 
			WHERE "customerId" = $1 AND "tenantId" = $2
		`, *req.CustomerId, tenantID).Scan(&accountID, &creditLimit, &currentDue)
		if err != nil {
			return nil, fmt.Errorf("no active credit account found for this customer: %w", err)
		}

		// Check limit violation
		if currentDue+grandTotal > creditLimit {
			return nil, fmt.Errorf("credit limit exceeded! Current due: %.2f, Adding: %.2f, Limit: %.2f", currentDue, grandTotal, creditLimit)
		}

		// Charge credit account
		_, err = tx.Exec(ctx, `
			UPDATE "CreditAccount" 
			SET "currentDue" = "currentDue" + $1, "updatedAt" = NOW() 
			WHERE "id" = $2
		`, grandTotal, accountID)
		if err != nil {
			return nil, fmt.Errorf("failed to update credit account: %w", err)
		}

		// Log credit transaction
		_, err = tx.Exec(ctx, `
			INSERT INTO "CreditTransaction" ("id", "accountId", "amount", "type", "createdAt")
			VALUES (gen_random_uuid(), $1, $2, 'CHARGE', NOW())
		`, accountID, grandTotal)
		if err != nil {
			return nil, fmt.Errorf("failed to create credit transaction entry: %w", err)
		}
	}

	// Update Invoice totals, points earned, and points redeemed
	_, err = tx.Exec(ctx, `
		UPDATE "Invoice" 
		SET "subtotal" = $1, "taxTotal" = $2, "grandTotal" = $3, "rewardPointsEarned" = $4, "rewardPointsRedeemed" = $5
		WHERE "id" = $6
	`, subtotal, taxTotal, grandTotal, pointsEarned, pointsRedeemed, invoiceID)
	if err != nil {
		return nil, fmt.Errorf("failed to update invoice totals: %w", err)
	}

	// Commit transaction
	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("could not commit transaction: %w", err)
	}

	return &Invoice{
		ID:                   invoiceID,
		TenantID:             tenantID,
		InvoiceSequence:      invoiceSequence,
		CustomerID:           req.CustomerId,
		Subtotal:             subtotal,
		TaxTotal:             taxTotal,
		GrandTotal:           grandTotal,
		PaymentMode:          req.PaymentMode,
		RewardPointsEarned:   pointsEarned,
		RewardPointsRedeemed: pointsRedeemed,
		Status:               "COMPLETED",
	}, nil
}


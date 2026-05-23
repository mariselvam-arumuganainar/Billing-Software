package billing

import "time"

// CheckoutRequest represents the incoming checkout payload
type CheckoutRequest struct {
	CustomerId      *string          `json:"customerId"`
	PaymentMode     string           `json:"paymentMode"`
	RedeemPoints    bool             `json:"redeemPoints"`
	Items           []CheckoutItem   `json:"items"`
}

type CheckoutItem struct {
	ItemId   string  `json:"itemId"`
	Quantity float64 `json:"quantity"`
}

// Invoice represents the invoice record
type Invoice struct {
	ID                   string    `json:"id"`
	TenantID             string    `json:"tenantId"`
	InvoiceSequence      string    `json:"invoiceSequence"`
	CustomerID           *string   `json:"customerId"`
	Subtotal             float64   `json:"subtotal"`
	TaxTotal             float64   `json:"taxTotal"`
	GrandTotal           float64   `json:"grandTotal"`
	PaymentMode          string    `json:"paymentMode"`
	RewardPointsEarned   float64   `json:"rewardPointsEarned"`
	RewardPointsRedeemed float64   `json:"rewardPointsRedeemed"`
	Status               string    `json:"status"`
	CreatedAt            time.Time `json:"createdAt"`
}

// Item represents an inventory item
type Item struct {
	ID             string
	TenantID       string
	Price          float64
	GSTRateDefault float64
	StockQty       float64
}

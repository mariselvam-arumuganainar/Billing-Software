package billing

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// InternalKeyMiddleware rejects requests that don't carry the correct shared secret.
// The API gateway sets X-Internal-Key after validating the client JWT — direct callers
// without the key cannot reach the billing engine.
func InternalKeyMiddleware(expectedKey string) gin.HandlerFunc {
	return func(c *gin.Context) {
		if c.GetHeader("X-Internal-Key") != expectedKey {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
			return
		}
		c.Next()
	}
}

// CheckoutHandler parses the request and delegates to the service
func CheckoutHandler(c *gin.Context) {
	tenantID := c.GetHeader("X-Tenant-ID")
	if tenantID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Missing X-Tenant-ID header"})
		return
	}

	var req CheckoutRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid payload"})
		return
	}

	if len(req.Items) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Cart cannot be empty"})
		return
	}

	// Call the service
	invoice, err := ProcessCheckout(c.Request.Context(), tenantID, req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "Checkout successful",
		"invoice": invoice,
	})
}

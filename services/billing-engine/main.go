package main

import (
	"log"
	"net/http"
	"os"

	"billing-engine/billing"
	"billing-engine/db"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
)

// corsMiddleware allows cross-origin requests from the Next.js dev server and
// any production origin. Handles the preflight OPTIONS request so the browser
// doesn't block the actual POST /billing/checkout call.
func corsMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		origin := c.GetHeader("Origin")
		if origin == "" {
			origin = "*"
		}
		c.Header("Access-Control-Allow-Origin", origin)
		c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Tenant-ID, Accept")
		c.Header("Access-Control-Allow-Credentials", "true")
		c.Header("Access-Control-Max-Age", "86400")

		if c.Request.Method == http.MethodOptions {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}
		c.Next()
	}
}

func main() {
	// Load environment variables if .env file exists
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, relying on environment variables")
	}

	internalKey := os.Getenv("BILLING_INTERNAL_KEY")
	if internalKey == "" {
		log.Fatal("FATAL: BILLING_INTERNAL_KEY environment variable is not set. Refusing to start.")
	}

	// Connect to database
	if err := db.Connect(); err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer db.Close()

	// Initialize Gin router
	r := gin.Default()
	r.Use(corsMiddleware())

	// Setup routes
	api := r.Group("/api/v1/billing")
	{
		api.GET("/health", func(c *gin.Context) {
			c.JSON(200, gin.H{"status": "ok", "service": "billing-engine"})
		})
		api.POST("/checkout", billing.InternalKeyMiddleware(internalKey), billing.CheckoutHandler)
	}

	// Start server
	port := os.Getenv("PORT")
	if port == "" {
		port = "8082"
	}
	log.Printf("Billing engine running on port %s", port)
	if err := r.Run(":" + port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}

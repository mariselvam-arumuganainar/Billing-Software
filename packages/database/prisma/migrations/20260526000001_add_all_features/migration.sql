-- AlterTable TenantSettings: add manualQtyEnabled, discountEnabled, roundUpEnabled
ALTER TABLE "TenantSettings" ADD COLUMN IF NOT EXISTS "manualQtyEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "TenantSettings" ADD COLUMN IF NOT EXISTS "discountEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "TenantSettings" ADD COLUMN IF NOT EXISTS "roundUpEnabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable Item: add lowStockThreshold, discountRate
ALTER TABLE "Item" ADD COLUMN IF NOT EXISTS "lowStockThreshold" INTEGER NOT NULL DEFAULT 10;
ALTER TABLE "Item" ADD COLUMN IF NOT EXISTS "discountRate" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable InvoiceLine: add discountRate
ALTER TABLE "InvoiceLine" ADD COLUMN IF NOT EXISTS "discountRate" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- CreateTable StockHistory
CREATE TABLE IF NOT EXISTS "StockHistory" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "changeType" TEXT NOT NULL,
    "quantityChange" INTEGER NOT NULL,
    "previousQty" INTEGER NOT NULL,
    "newQty" INTEGER NOT NULL,
    "reason" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StockHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable StockPurchase
CREATE TABLE IF NOT EXISTS "StockPurchase" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "supplierName" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "costPerUnit" DOUBLE PRECISION NOT NULL,
    "totalCost" DOUBLE PRECISION NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StockPurchase_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "StockHistory_tenantId_idx" ON "StockHistory"("tenantId");
CREATE INDEX IF NOT EXISTS "StockHistory_itemId_idx" ON "StockHistory"("itemId");
CREATE INDEX IF NOT EXISTS "StockPurchase_tenantId_idx" ON "StockPurchase"("tenantId");
CREATE INDEX IF NOT EXISTS "StockPurchase_itemId_idx" ON "StockPurchase"("itemId");

-- AddForeignKey
ALTER TABLE "StockHistory" ADD CONSTRAINT "StockHistory_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StockHistory" ADD CONSTRAINT "StockHistory_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StockPurchase" ADD CONSTRAINT "StockPurchase_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StockPurchase" ADD CONSTRAINT "StockPurchase_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

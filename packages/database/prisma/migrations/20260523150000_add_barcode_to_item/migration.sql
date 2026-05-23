-- AlterTable
ALTER TABLE "Item" ADD COLUMN "barcode" VARCHAR(100);

-- CreateIndex
CREATE UNIQUE INDEX "Item_tenantId_barcode_key" ON "Item"("tenantId", "barcode");

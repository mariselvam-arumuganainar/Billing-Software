-- Add invoiceCounter to TenantSettings for collision-free sequential invoice numbering
ALTER TABLE "TenantSettings" ADD COLUMN IF NOT EXISTS "invoiceCounter" INTEGER NOT NULL DEFAULT 0;

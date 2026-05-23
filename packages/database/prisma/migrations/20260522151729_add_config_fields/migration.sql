-- AlterTable
ALTER TABLE "StoreProfile" ADD COLUMN     "invoiceFooterNote" TEXT,
ADD COLUMN     "pincode" TEXT,
ADD COLUMN     "placeOfSupply" TEXT,
ADD COLUMN     "state" TEXT,
ADD COLUMN     "storeEmail" TEXT,
ADD COLUMN     "storeMobile" TEXT,
ADD COLUMN     "storeWebsite" TEXT;

-- AlterTable
ALTER TABLE "TenantSettings" ADD COLUMN     "allowManualGstEdit" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "autoPrintAfterCheckout" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "billPrefix" TEXT NOT NULL DEFAULT 'BILL-',
ADD COLUMN     "compactBillMode" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "creditLimitDefault" DOUBLE PRECISION NOT NULL DEFAULT 5000,
ADD COLUMN     "enableCard" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "enableCash" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "enableCredit" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "enableSplit" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "enableUpi" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "gstEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "overdueAlertDays" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN     "rewardRedemptionEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "showLogoOnBill" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "showLogoOnInvoice" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "thermalHeaderText" TEXT,
ADD COLUMN     "thermalPaperWidth" TEXT NOT NULL DEFAULT '80mm',
ADD COLUMN     "thermalPrinterName" TEXT;

-- AlterTable
ALTER TABLE "OrderRequest" ADD COLUMN "originatorDepartment" TEXT;

-- AlterTable
ALTER TABLE "ProcurementOrder" ADD COLUMN "approvalNotes" TEXT;
ALTER TABLE "ProcurementOrder" ADD COLUMN "expectedDeliveryDate" DATETIME;

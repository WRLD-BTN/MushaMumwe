-- AlterTable
ALTER TABLE "Employee" ADD COLUMN "role" TEXT;

-- AlterTable
ALTER TABLE "InventoryItem" ADD COLUMN "category" TEXT;
ALTER TABLE "InventoryItem" ADD COLUMN "expiryDate" DATETIME;

-- AlterTable
ALTER TABLE "OrderRequest" ADD COLUMN "category" TEXT;
ALTER TABLE "OrderRequest" ADD COLUMN "urgency" TEXT DEFAULT 'normal';

-- AlterTable
ALTER TABLE "Patient" ADD COLUMN "bloodGroup" TEXT;
ALTER TABLE "Patient" ADD COLUMN "causeOfDeath" TEXT;
ALTER TABLE "Patient" ADD COLUMN "diagnosis" TEXT;
ALTER TABLE "Patient" ADD COLUMN "dischargeDate" DATETIME;
ALTER TABLE "Patient" ADD COLUMN "dischargeNotes" TEXT;
ALTER TABLE "Patient" ADD COLUMN "dischargedBy" TEXT;
ALTER TABLE "Patient" ADD COLUMN "finalDiagnosis" TEXT;
ALTER TABLE "Patient" ADD COLUMN "nextReviewDate" DATETIME;
ALTER TABLE "Patient" ADD COLUMN "outcome" TEXT;
ALTER TABLE "Patient" ADD COLUMN "patientInstructions" TEXT;
ALTER TABLE "Patient" ADD COLUMN "phone" TEXT;
ALTER TABLE "Patient" ADD COLUMN "reviewDepartment" TEXT;
ALTER TABLE "Patient" ADD COLUMN "symptoms" TEXT;
ALTER TABLE "Patient" ADD COLUMN "treatmentSummary" TEXT;

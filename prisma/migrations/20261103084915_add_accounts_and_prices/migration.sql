-- AlterTable
ALTER TABLE "ProcurementOrder" ADD COLUMN "priceUsd" REAL;
ALTER TABLE "ProcurementOrder" ADD COLUMN "priceZwg" REAL;

-- CreateTable
CREATE TABLE "CashFlow" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "reason" TEXT NOT NULL,
    "addedBy" TEXT NOT NULL
);

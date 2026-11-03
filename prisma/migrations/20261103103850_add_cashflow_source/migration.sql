/*
  Warnings:

  - Added the required column `source` to the `CashFlow` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CashFlow" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "source" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "addedBy" TEXT NOT NULL
);
INSERT INTO "new_CashFlow" ("addedBy", "amount", "currency", "date", "id", "reason", "type") SELECT "addedBy", "amount", "currency", "date", "id", "reason", "type" FROM "CashFlow";
DROP TABLE "CashFlow";
ALTER TABLE "new_CashFlow" RENAME TO "CashFlow";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

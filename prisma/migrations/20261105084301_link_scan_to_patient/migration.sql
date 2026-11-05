/*
  Warnings:

  - You are about to drop the column `patientName` on the `ScanRequest` table. All the data in the column will be lost.
  - Added the required column `patientId` to the `ScanRequest` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ScanRequest" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "patientId" INTEGER NOT NULL,
    "scanType" TEXT NOT NULL,
    "requestedBy" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ScanRequest_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_ScanRequest" ("createdAt", "id", "notes", "requestedBy", "scanType", "status", "updatedAt") SELECT "createdAt", "id", "notes", "requestedBy", "scanType", "status", "updatedAt" FROM "ScanRequest";
DROP TABLE "ScanRequest";
ALTER TABLE "new_ScanRequest" RENAME TO "ScanRequest";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

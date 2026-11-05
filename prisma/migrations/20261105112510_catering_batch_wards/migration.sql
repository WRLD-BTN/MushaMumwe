/*
  Warnings:

  - You are about to drop the column `mealType` on the `MealDelivery` table. All the data in the column will be lost.
  - You are about to drop the column `ward` on the `MealDelivery` table. All the data in the column will be lost.
  - Added the required column `batchId` to the `MealDelivery` table without a default value. This is not possible if the table is not empty.
  - Added the required column `mealTypeId` to the `MealDelivery` table without a default value. This is not possible if the table is not empty.
  - Added the required column `wardId` to the `MealDelivery` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "CateringWard" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "CateringMealType" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_MealDelivery" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "batchId" TEXT NOT NULL,
    "wardId" INTEGER NOT NULL,
    "mealTypeId" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "notes" TEXT,
    "deliveredBy" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'prepared',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MealDelivery_wardId_fkey" FOREIGN KEY ("wardId") REFERENCES "CateringWard" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MealDelivery_mealTypeId_fkey" FOREIGN KEY ("mealTypeId") REFERENCES "CateringMealType" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_MealDelivery" ("createdAt", "deliveredBy", "id", "notes", "quantity", "status") SELECT "createdAt", "deliveredBy", "id", "notes", "quantity", "status" FROM "MealDelivery";
DROP TABLE "MealDelivery";
ALTER TABLE "new_MealDelivery" RENAME TO "MealDelivery";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "CateringWard_name_key" ON "CateringWard"("name");

-- CreateIndex
CREATE UNIQUE INDEX "CateringMealType_name_key" ON "CateringMealType"("name");

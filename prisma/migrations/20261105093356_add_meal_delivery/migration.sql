-- CreateTable
CREATE TABLE "MealDelivery" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "ward" TEXT NOT NULL,
    "mealType" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "notes" TEXT,
    "deliveredBy" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'prepared',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

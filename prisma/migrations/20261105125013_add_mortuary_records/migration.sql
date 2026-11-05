-- CreateTable
CREATE TABLE "MortuaryRecord" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "bodyId" TEXT NOT NULL,
    "patientName" TEXT NOT NULL,
    "age" INTEGER,
    "gender" TEXT,
    "dateOfDeath" DATETIME NOT NULL,
    "causeOfDeath" TEXT NOT NULL,
    "nextOfKin" TEXT,
    "contactPhone" TEXT,
    "status" TEXT NOT NULL DEFAULT 'in_mortuary',
    "receivedBy" TEXT NOT NULL,
    "releasedTo" TEXT,
    "releasedBy" TEXT,
    "releaseNotes" TEXT,
    "releasedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "MortuaryRecord_bodyId_key" ON "MortuaryRecord"("bodyId");

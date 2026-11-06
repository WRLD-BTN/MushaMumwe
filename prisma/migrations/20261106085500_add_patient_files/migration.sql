-- CreateTable
CREATE TABLE "PatientFile" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "fileNumber" TEXT NOT NULL,
    "patientName" TEXT NOT NULL,
    "patientId" TEXT,
    "ward" TEXT NOT NULL,
    "requestedBy" TEXT NOT NULL,
    "purpose" TEXT,
    "status" TEXT NOT NULL DEFAULT 'out',
    "checkedOutAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "checkedOutBy" TEXT NOT NULL,
    "returnedAt" DATETIME,
    "returnedBy" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "PatientFile_fileNumber_key" ON "PatientFile"("fileNumber");

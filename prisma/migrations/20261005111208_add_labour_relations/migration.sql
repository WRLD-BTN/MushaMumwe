-- CreateTable
CREATE TABLE "DisciplinaryCase" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "caseNumber" TEXT NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "offenseType" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "reportedBy" TEXT NOT NULL,
    "reportedDate" DATETIME NOT NULL,
    "witnesses" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "actionTaken" TEXT,
    "actionDetails" TEXT,
    "outcome" TEXT,
    "hearingDate" DATETIME,
    "hearingNotes" TEXT,
    "effectiveDate" DATETIME,
    "durationDays" INTEGER,
    "closedBy" TEXT,
    "closedDate" DATETIME,
    "reopenedBy" TEXT,
    "reopenedDate" DATETIME,
    "reopenReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DisciplinaryCase_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DisciplinaryStatusLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "caseId" INTEGER NOT NULL,
    "oldStatus" TEXT NOT NULL,
    "newStatus" TEXT NOT NULL,
    "changedBy" TEXT NOT NULL,
    "notes" TEXT,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DisciplinaryStatusLog_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "DisciplinaryCase" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DisciplinaryAttachment" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "caseId" INTEGER NOT NULL,
    "originalName" TEXT NOT NULL,
    "storedName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "uploadedBy" TEXT NOT NULL,
    "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DisciplinaryAttachment_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "DisciplinaryCase" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "DisciplinaryCase_caseNumber_key" ON "DisciplinaryCase"("caseNumber");

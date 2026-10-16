-- CreateTable
CREATE TABLE "EmployeeMovement" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "employeeId" INTEGER NOT NULL,
    "movementType" TEXT NOT NULL,
    "fromDepartment" TEXT,
    "fromWardId" INTEGER,
    "toDepartment" TEXT,
    "toWardId" INTEGER,
    "plannedDate" DATETIME,
    "actualDate" DATETIME,
    "yearsOfService" INTEGER,
    "pensionNotes" TEXT,
    "resignationDate" DATETIME,
    "lastWorkingDay" DATETIME,
    "noticePeriodDays" INTEGER,
    "reason" TEXT,
    "exitInterviewDone" BOOLEAN NOT NULL DEFAULT false,
    "eligibleForRehire" BOOLEAN,
    "effectiveDate" DATETIME,
    "notes" TEXT,
    "approvedBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "EmployeeMovement_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EstablishmentTarget" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "department" TEXT NOT NULL,
    "minHeadcount" INTEGER NOT NULL DEFAULT 0,
    "maxHeadcount" INTEGER,
    "notes" TEXT,
    "updatedBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "EstablishmentTarget_department_key" ON "EstablishmentTarget"("department");

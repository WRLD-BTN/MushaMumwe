-- CreateTable
CREATE TABLE "SecurityIncident" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "type" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "reportedBy" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "GateLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "idNumber" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "timeIn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "timeOut" DATETIME,
    "loggedBy" TEXT NOT NULL
);

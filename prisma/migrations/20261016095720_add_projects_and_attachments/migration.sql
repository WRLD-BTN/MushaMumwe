-- AlterTable
ALTER TABLE "OrderRequest" ADD COLUMN "attachmentName" TEXT;
ALTER TABLE "OrderRequest" ADD COLUMN "attachmentPath" TEXT;

-- CreateTable
CREATE TABLE "Project" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "projectHead" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ongoing',
    "startDate" DATETIME,
    "targetDate" DATETIME,
    "obstacleReason" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ProjectUpdate" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "projectId" INTEGER NOT NULL,
    "note" TEXT NOT NULL,
    "statusAtUpdate" TEXT NOT NULL,
    "obstacleReason" TEXT,
    "actionTaken" TEXT,
    "updatedBy" TEXT NOT NULL,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProjectUpdate_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Project_department_idx" ON "Project"("department");

-- CreateIndex
CREATE INDEX "Project_status_idx" ON "Project"("status");

-- CreateIndex
CREATE INDEX "Project_updatedAt_idx" ON "Project"("updatedAt");

-- CreateIndex
CREATE INDEX "ProjectUpdate_projectId_idx" ON "ProjectUpdate"("projectId");

-- CreateIndex
CREATE INDEX "ProjectUpdate_timestamp_idx" ON "ProjectUpdate"("timestamp");

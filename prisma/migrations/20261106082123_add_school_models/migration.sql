-- CreateTable
CREATE TABLE "SchoolStudent" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "studentNumber" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "school" TEXT NOT NULL,
    "intakeYear" INTEGER NOT NULL,
    "currentClass" TEXT NOT NULL,
    "currentWard" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ClassSchedule" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "school" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "tutor" TEXT NOT NULL,
    "location" TEXT,
    "dayOfWeek" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "SchoolStudent_studentNumber_key" ON "SchoolStudent"("studentNumber");

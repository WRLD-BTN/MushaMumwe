-- Audit upgrade: add request correlation, HTTP context, and hash-chain fields.
-- All columns are nullable so existing rows are untouched and the migration is
-- safe to run on live data.

ALTER TABLE "AuditLog" ADD COLUMN "requestId" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN "method" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN "path" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN "httpStatus" INTEGER;
ALTER TABLE "AuditLog" ADD COLUMN "success" BOOLEAN;
ALTER TABLE "AuditLog" ADD COLUMN "durationMs" INTEGER;
ALTER TABLE "AuditLog" ADD COLUMN "body" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN "query" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN "prevHash" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN "rowHash" TEXT;

CREATE INDEX "AuditLog_requestId_idx" ON "AuditLog"("requestId");
CREATE INDEX "AuditLog_success_idx"   ON "AuditLog"("success");
CREATE INDEX "AuditLog_method_idx"    ON "AuditLog"("method");

-- Run this once against the hospital's Postgres database.
-- It fires a NOTIFY every time a row in "Patient" changes,
-- so the dashboard updates instantly even if the change came
-- from the hospital's existing records system, not just this app.

-- IMPORTANT: this payload is what gets broadcast live to every connected
-- dashboard over the LAN. Deliberately excludes name/dob/nationalId so PII
-- never leaves the database, even transiently over the socket connection.
CREATE OR REPLACE FUNCTION notify_patient_update() RETURNS trigger AS $$
BEGIN
  PERFORM pg_notify(
    'patient_updates',
    json_build_object(
      'id', NEW.id,
      'status', NEW.status,
      'wardId', NEW."wardId",
      'updatedAt', NEW."updatedAt"
    )::text
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS patient_update_trigger ON "Patient";

CREATE TRIGGER patient_update_trigger
AFTER INSERT OR UPDATE ON "Patient"
FOR EACH ROW EXECUTE FUNCTION notify_patient_update();

-- Suggested scoped role for the dashboard app (adjust table name/case to match real schema):
-- CREATE ROLE dashboard_user WITH LOGIN PASSWORD 'change_me';
-- GRANT SELECT ON ALL TABLES IN SCHEMA public TO dashboard_user;
-- GRANT UPDATE (status, "updatedAt") ON "Patient" TO dashboard_user;
-- GRANT INSERT ON "StatusLog" TO dashboard_user;

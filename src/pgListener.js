const { Client } = require("pg");

// Opens a dedicated, long-lived Postgres connection just for LISTEN.
// Any INSERT/UPDATE on Patient (from this app OR the hospital's existing
// system) fires the trigger in sql/trigger.sql, which lands here.
function startPgListener(io) {
  const client = new Client({ connectionString: process.env.DATABASE_URL });

  client.connect().then(() => {
    client.query("LISTEN patient_updates");
    console.log("Listening for patient_updates on Postgres...");
  });

  client.on("notification", (msg) => {
    try {
      const payload = JSON.parse(msg.payload);
      io.emit("patient:updated", payload);
    } catch (err) {
      console.error("Failed to parse pg_notify payload:", err);
    }
  });

  client.on("error", (err) => {
    console.error("Postgres listener error, retrying in 5s:", err.message);
    setTimeout(() => startPgListener(io), 5000);
  });
}

module.exports = { startPgListener };

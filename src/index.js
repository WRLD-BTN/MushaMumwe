require("dotenv").config();
const express = require("express");
const cors = require("cors");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");

const patientRoutes = require("./routes/patients");
const authRoutes = require("./routes/auth");
const { startPgListener } = require("./pgListener");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));

app.use("/api/auth", authRoutes);
app.use("/api/patients", patientRoutes);

app.get("/api/health", (req, res) => res.json({ ok: true }));

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

io.on("connection", (socket) => {
  console.log("Dashboard client connected:", socket.id);
  socket.on("disconnect", () => console.log("Dashboard client disconnected:", socket.id));
});

//startPgListener(io);
// Only start pg listener if using PostgreSQL (not SQLite)
if (process.env.DATABASE_URL && !process.env.DATABASE_URL.includes("file:")) {
  startPgListener(io);
}

const PORT = process.env.PORT || 4000;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`MushaMumwe server running on http://0.0.0.0:${PORT}`);
  console.log("Accessible on the LAN via the server machine's local IP.");
});

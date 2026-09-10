const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, { cors: { origin: '*' } });

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Import routes
const authRoutes = require('./routes/auth');
const patientRoutes = require('./routes/patients');
const employeeRoutes = require('./routes/employees');

// Use routes
app.use('/api/auth', authRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/employees', employeeRoutes);

// Socket.io events
io.on('connection', (socket) => {
  console.log('Dashboard connected:', socket.id);

  socket.on('disconnect', () => {
    console.log('Dashboard disconnected:', socket.id);
  });
});

// Emit patient updates
async function broadcastPatientUpdate(data) {
  io.emit('patient:updated', data);
}

// Emit employee updates
async function broadcastEmployeeUpdate(data) {
  io.emit('employee:updated', data);
}

// Export for use in routes
app.locals.io = io;
app.locals.broadcastPatientUpdate = broadcastPatientUpdate;
app.locals.broadcastEmployeeUpdate = broadcastEmployeeUpdate;

// Start server
const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`\n🏥 MushaMumwe server running on http://0.0.0.0:${PORT}`);
  console.log(`📱 Access from LAN: http://<server-ip>:${PORT}\n`);
});

module.exports = { io, app, server };
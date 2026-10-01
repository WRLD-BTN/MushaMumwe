const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const dotenv = require('dotenv');
const os = require('os');

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, { cors: { origin: '*' } });

app.use(express.json());
app.use(express.static('public'));

const authRoutes      = require('./routes/auth');
const patientRoutes   = require('./routes/patients');
const employeeRoutes  = require('./routes/employees');
const orderRoutes     = require('./routes/orders');
const inventoryRoutes = require('./routes/inventory');
const wardRoutes      = require('./routes/wards');
const settingsRoutes  = require('./routes/settings');

app.use('/api/auth',      authRoutes);
app.use('/api/patients',  patientRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/orders',    orderRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/wards',     wardRoutes);
app.use('/api/settings',  settingsRoutes);

app.locals.io = io;
app.locals.emit = (event, payload) => io.emit(event, payload);

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  socket.on('disconnect', () => console.log('Client disconnected:', socket.id));
});

const PORT = process.env.PORT || 4000;

server.listen(PORT, '0.0.0.0', () => {
  const nets = os.networkInterfaces();
  const addrs = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) addrs.push(net.address);
    }
  }
  console.log('');
  console.log('Sally Mugabe Central Hospital Dashboard running');
  console.log('Local:   http://localhost:' + PORT);
  addrs.forEach(a => console.log('Network: http://' + a + ':' + PORT));
  console.log('');
});

module.exports = { io, app, server };
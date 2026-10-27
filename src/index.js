const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const dotenv = require('dotenv');
const os = require('os');
const path = require('path');

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, { cors: { origin: '*' } });

app.use(express.json());

app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
});

const staticOptions = {
  etag: false,
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html') || filePath.endsWith('.js') || filePath.endsWith('.css')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
  }
};

app.use(express.static('public', staticOptions));

const CLEAN_ROUTES = ['/dashboard', '/login', '/nurses', '/it', '/procurement', '/stores', '/hr', '/admin'];

CLEAN_ROUTES.forEach(route => {
  app.get(route, (req, res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.sendFile(path.join(__dirname, '..', 'public', 'entry.html'));
  });
});

app.get('/', (req, res) => res.redirect('/portal'));

app.get('/portal', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

const authRoutes          = require('./routes/auth');
const patientRoutes       = require('./routes/patients');
const employeeRoutes      = require('./routes/employees');
const orderRoutes         = require('./routes/orders');
const inventoryRoutes     = require('./routes/inventory');
const wardRoutes          = require('./routes/wards');
const settingsRoutes      = require('./routes/settings');
const disciplinaryRoutes  = require('./routes/disciplinary');
const establishmentRoutes = require('./routes/establishment');
const projectRoutes       = require('./routes/projects');
const auditRoutes         = require('./routes/audit');

app.use('/api/auth',           authRoutes);
app.use('/api/patients',       patientRoutes);
app.use('/api/employees',      employeeRoutes);
app.use('/api/orders',         orderRoutes);
app.use('/api/inventory',      inventoryRoutes);
app.use('/api/wards',          wardRoutes);
app.use('/api/settings',       settingsRoutes);
app.use('/api/disciplinary',   disciplinaryRoutes);
app.use('/api/establishment',  establishmentRoutes);
app.use('/api/projects',       projectRoutes);
app.use('/api/audit',          auditRoutes);

app.locals.io = io;
app.locals.emit = (event, payload) => io.emit(event, payload);

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  socket.on('disconnect', () => console.log('Client disconnected:', socket.id));
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, '0.0.0.0', () => {
  console.log('Sally Mugabe Central Hospital Dashboard running on port ' + PORT);
});

module.exports = { io, app, server };

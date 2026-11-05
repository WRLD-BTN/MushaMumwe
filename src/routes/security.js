const express = require('express');
const prisma = require('../prismaClient');
const { requireAuth } = require('../auth');

const router = express.Router();

function requireSecurity(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  const dept = String(req.user.department || '').toLowerCase();
  if (dept !== 'security' && dept !== 'it' && dept !== 'superadmin') {
    return res.status(403).json({ error: 'Only Security and IT can access this' });
  }
  next();
}

// GET all incidents
router.get('/incidents', requireAuth, requireSecurity, async (req, res) => {
  try {
    const { search, severity, status } = req.query;
    const where = {};
    
    if (severity && severity !== 'all') where.severity = severity;
    if (status && status !== 'all') where.status = status;
    
    if (search) {
      const q = search.toLowerCase();
      const all = await prisma.securityIncident.findMany({
        where,
        orderBy: { createdAt: 'desc' }
      });
      return res.json(all.filter(i => 
        String(i.type).toLowerCase().includes(q) ||
        String(i.location).toLowerCase().includes(q) ||
        String(i.description).toLowerCase().includes(q)
      ));
    }

    const incidents = await prisma.securityIncident.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    });
    res.json(incidents);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST new incident
router.post('/incidents', requireAuth, requireSecurity, async (req, res) => {
  const { type, location, description, severity } = req.body;
  if (!type || !location || !description || !severity) {
    return res.status(400).json({ error: 'All fields are required' });
  }
  try {
    const record = await prisma.securityIncident.create({
      data: {
        type,
        location,
        description,
        severity,
        reportedBy: req.user.fullName,
        status: 'open'
      }
    });
    req.app.locals.emit('security:incident', { id: record.id, type: record.type });
    res.status(201).json(record);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PATCH update incident status
router.patch('/incidents/:id/status', requireAuth, requireSecurity, async (req, res) => {
  const { status } = req.body;
  try {
    const updated = await prisma.securityIncident.update({
      where: { id: parseInt(req.params.id) },
      data: { status }
    });
    res.json(updated);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET all gate logs
router.get('/gatelogs', requireAuth, requireSecurity, async (req, res) => {
  try {
    const { search } = req.query;
    const where = {};
    if (search) {
      const q = search.toLowerCase();
      const all = await prisma.gateLog.findMany({ orderBy: { timeIn: 'desc' } });
      return res.json(all.filter(g => 
        String(g.name).toLowerCase().includes(q) ||
        String(g.idNumber).toLowerCase().includes(q) ||
        String(g.purpose).toLowerCase().includes(q)
      ));
    }
    const logs = await prisma.gateLog.findMany({ orderBy: { timeIn: 'desc' } });
    res.json(logs);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST new gate log
router.post('/gatelogs', requireAuth, requireSecurity, async (req, res) => {
  const { name, idNumber, purpose } = req.body;
  if (!name || !idNumber || !purpose) {
    return res.status(400).json({ error: 'Name, ID, and purpose are required' });
  }
  try {
    const record = await prisma.gateLog.create({
      data: {
        name,
        idNumber,
        purpose,
        loggedBy: req.user.fullName
      }
    });
    res.status(201).json(record);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PATCH log out
router.patch('/gatelogs/:id/out', requireAuth, requireSecurity, async (req, res) => {
  try {
    const updated = await prisma.gateLog.update({
      where: { id: parseInt(req.params.id) },
      data: { timeOut: new Date() }
    });
    res.json(updated);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;

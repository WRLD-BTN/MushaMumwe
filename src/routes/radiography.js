const express = require('express');
const prisma = require('../prismaClient');
const { requireAuth } = require('../auth');

const router = express.Router();

function requireRadiography(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  const dept = String(req.user.department || '').toLowerCase();
  if (dept !== 'radiography' && dept !== 'medical' && dept !== 'nurses' && dept !== 'it' && dept !== 'superadmin') {
    return res.status(403).json({ error: 'Not authorized' });
  }
  next();
}

// GET admitted & in-treatment patients to populate dropdown
router.get('/patients', requireAuth, requireRadiography, async (req, res) => {
  try {
    const patients = await prisma.patient.findMany({
      where: { status: { in: ['admitted', 'treatment'] } },
      select: { id: true, name: true, ward: { select: { name: true } } },
      orderBy: { name: 'asc' }
    });
    res.json(patients);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET all scan requests with date filter
router.get('/scans', requireAuth, requireRadiography, async (req, res) => {
  try {
    const { status, from, to } = req.query;
    const where = {};
    if (status && status !== 'all') where.status = status;
    
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from + 'T00:00:00');
      if (to) where.createdAt.lte = new Date(to + 'T23:59:59.999');
    }
    
    const scans = await prisma.scanRequest.findMany({
      where,
      include: { patient: true },
      orderBy: { createdAt: 'desc' }
    });
    res.json(scans);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST new scan request
router.post('/scans', requireAuth, requireRadiography, async (req, res) => {
  const { patientId, scanType, notes } = req.body;
  if (!patientId || !scanType) {
    return res.status(400).json({ error: 'Patient and scan type required' });
  }
  try {
    const record = await prisma.scanRequest.create({
      data: {
        patientId: parseInt(patientId),
        scanType,
        requestedBy: req.user.fullName,
        notes: notes || null
      }
    });
    req.app.locals.emit('radiography:updated', { id: record.id });
    res.status(201).json(record);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PATCH update scan status
router.patch('/scans/:id/status', requireAuth, requireRadiography, async (req, res) => {
  const { status } = req.body;
  try {
    const updated = await prisma.scanRequest.update({
      where: { id: parseInt(req.params.id) },
      data: { status }
    });
    req.app.locals.emit('radiography:updated', { id: updated.id });
    res.json(updated);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
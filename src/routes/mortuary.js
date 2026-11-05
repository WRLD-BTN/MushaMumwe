const express = require('express');
const prisma = require('../prismaClient');
const { requireAuth } = require('../auth');

const router = express.Router();

function requireMortuary(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  const dept = String(req.user.department || '').toLowerCase();
  if (dept !== 'mortuary' && dept !== 'it' && dept !== 'superadmin') {
    return res.status(403).json({ error: 'Only Mortuary and IT can access this' });
  }
  next();
}

// GET records with date filter
router.get('/records', requireAuth, requireMortuary, async (req, res) => {
  try {
    const { from, to, status } = req.query;
    const where = {};
    if (status && status !== 'all') where.status = status;
    
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from + 'T00:00:00');
      if (to) where.createdAt.lte = new Date(to + 'T23:59:59.999');
    }
    
    const records = await prisma.mortuaryRecord.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    });
    res.json(records);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST new intake
router.post('/records', requireAuth, requireMortuary, async (req, res) => {
  const { patientName, age, gender, dateOfDeath, causeOfDeath, nextOfKin, contactPhone } = req.body;
  
  if (!patientName || !dateOfDeath || !causeOfDeath) {
    return res.status(400).json({ error: 'Patient name, date of death, and cause of death required' });
  }

  try {
    const year = new Date().getFullYear();
    const count = await prisma.mortuaryRecord.count();
    const bodyId = 'MOR-' + year + '-' + String(count + 1).padStart(4, '0');

    const record = await prisma.mortuaryRecord.create({
      data: {
        bodyId,
        patientName,
        age: age ? parseInt(age) : null,
        gender: gender || null,
        dateOfDeath: new Date(dateOfDeath),
        causeOfDeath,
        nextOfKin: nextOfKin || null,
        contactPhone: contactPhone || null,
        receivedBy: req.user.fullName,
        status: 'in_mortuary'
      }
    });

    req.app.locals.emit('mortuary:updated', { id: record.id });
    res.status(201).json(record);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PATCH release body
router.patch('/records/:id/release', requireAuth, requireMortuary, async (req, res) => {
  const { releasedTo, releaseNotes } = req.body;
  
  if (!releasedTo) {
    return res.status(400).json({ error: 'Released to is required' });
  }

  try {
    const updated = await prisma.mortuaryRecord.update({
      where: { id: parseInt(req.params.id) },
      data: {
        status: 'released',
        releasedTo,
        releaseNotes: releaseNotes || null,
        releasedBy: req.user.fullName,
        releasedAt: new Date()
      }
    });
    req.app.locals.emit('mortuary:updated', { id: updated.id });
    res.json(updated);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
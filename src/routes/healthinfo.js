const express = require('express');
const prisma = require('../prismaClient');
const { requireAuth } = require('../auth');

const router = express.Router();

function requireHealthInfo(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  const dept = String(req.user.department || '').toLowerCase();
  if (dept !== 'health information' && dept !== 'it' && dept !== 'superadmin') {
    return res.status(403).json({ error: 'Only Health Information and IT can access this' });
  }
  next();
}

// ============================================================
// FILES
// ============================================================
router.get('/files', requireAuth, requireHealthInfo, async (req, res) => {
  try {
    const { from, to, status, search } = req.query;
    const where = {};
    
    if (status && status !== 'all') where.status = status;
    
    if (from || to) {
      where.checkedOutAt = {};
      if (from) where.checkedOutAt.gte = new Date(from + 'T00:00:00');
      if (to) where.checkedOutAt.lte = new Date(to + 'T23:59:59.999');
    }
    
    let files = await prisma.patientFile.findMany({
      where,
      orderBy: { checkedOutAt: 'desc' }
    });
    
    if (search) {
      const q = search.toLowerCase();
      files = files.filter(f =>
        String(f.fileNumber).toLowerCase().includes(q) ||
        String(f.patientName).toLowerCase().includes(q) ||
        String(f.ward).toLowerCase().includes(q) ||
        String(f.requestedBy).toLowerCase().includes(q)
      );
    }
    
    res.json(files);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/files', requireAuth, requireHealthInfo, async (req, res) => {
  const { patientName, patientId, ward, requestedBy, purpose, notes } = req.body;
  
  if (!patientName || !ward || !requestedBy) {
    return res.status(400).json({ error: 'Patient name, ward, and requested by are required' });
  }

  try {
    // Generate file number: HI-YYYY-XXXX
    const year = new Date().getFullYear();
    const count = await prisma.patientFile.count();
    const fileNumber = 'HI-' + year + '-' + String(count + 1).padStart(4, '0');

    const record = await prisma.patientFile.create({
      data: {
        fileNumber,
        patientName,
        patientId: patientId || null,
        ward,
        requestedBy,
        purpose: purpose || null,
        notes: notes || null,
        status: 'out',
        checkedOutBy: req.user.fullName,
        checkedOutAt: new Date()
      }
    });

    req.app.locals.emit('healthinfo:updated', { id: record.id });
    res.status(201).json(record);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.patch('/files/:id/return', requireAuth, requireHealthInfo, async (req, res) => {
  const { notes } = req.body;
  
  try {
    const updated = await prisma.patientFile.update({
      where: { id: parseInt(req.params.id) },
      data: {
        status: 'returned',
        returnedAt: new Date(),
        returnedBy: req.user.fullName,
        notes: notes || null
      }
    });
    req.app.locals.emit('healthinfo:updated', { id: updated.id });
    res.json(updated);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============================================================
// SUMMARY
// ============================================================
router.get('/summary', requireAuth, requireHealthInfo, async (req, res) => {
  try {
    const allFiles = await prisma.patientFile.findMany();
    
    const now = new Date();
    const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);
    
    const currentlyOut = allFiles.filter(f => f.status === 'out');
    const overdue = currentlyOut.filter(f => new Date(f.checkedOutAt) < fortyEightHoursAgo);
    
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const checkedOutToday = allFiles.filter(f => new Date(f.checkedOutAt) >= todayStart).length;
    const returnedToday = allFiles.filter(f => f.returnedAt && new Date(f.returnedAt) >= todayStart).length;
    
    res.json({
      currentlyOut: currentlyOut.length,
      overdue: overdue.length,
      checkedOutToday,
      returnedToday,
      total: allFiles.length
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
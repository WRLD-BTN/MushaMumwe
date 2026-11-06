const express = require('express');
const prisma = require('../prismaClient');
const { requireAuth } = require('../auth');

const router = express.Router();

function requireBiomedical(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  const dept = String(req.user.department || '').toLowerCase();
  if (dept !== 'biomedical equipment' && dept !== 'it' && dept !== 'superadmin') {
    return res.status(403).json({ error: 'Only Biomedical Equipment and IT can access this' });
  }
  next();
}

// ============================================================
// EQUIPMENT
// ============================================================
router.get('/equipment', requireAuth, requireBiomedical, async (req, res) => {
  try {
    const { search, status, category } = req.query;
    const where = {};
    if (status && status !== 'all') where.status = status;
    if (category && category !== 'all') where.category = category;
    
    let equipment = await prisma.equipment.findMany({
      where,
      orderBy: { name: 'asc' }
    });
    
    if (search) {
      const q = search.toLowerCase();
      equipment = equipment.filter(e =>
        String(e.name).toLowerCase().includes(q) ||
        String(e.equipmentId).toLowerCase().includes(q) ||
        String(e.location).toLowerCase().includes(q)
      );
    }
    
    res.json(equipment);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/equipment', requireAuth, requireBiomedical, async (req, res) => {
  const { name, category, location, lastServiced, nextService, notes } = req.body;
  
  if (!name || !category || !location) {
    return res.status(400).json({ error: 'Name, category, and location required' });
  }

  try {
    // Generate equipment ID: EQ-YYYY-XXXX
    const year = new Date().getFullYear();
    const count = await prisma.equipment.count();
    const equipmentId = 'EQ-' + year + '-' + String(count + 1).padStart(4, '0');

    const record = await prisma.equipment.create({
      data: {
        equipmentId,
        name,
        category,
        location,
        status: 'operational',
        lastServiced: lastServiced ? new Date(lastServiced) : null,
        nextService: nextService ? new Date(nextService) : null,
        notes: notes || null
      }
    });

    req.app.locals.emit('biomedical:updated', { id: record.id });
    res.status(201).json(record);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.patch('/equipment/:id/status', requireAuth, requireBiomedical, async (req, res) => {
  const { status, notes } = req.body;
  const validStatuses = ['operational', 'maintenance', 'out_of_order'];
  
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  
  try {
    const updated = await prisma.equipment.update({
      where: { id: parseInt(req.params.id) },
      data: { status, notes: notes || undefined }
    });
    req.app.locals.emit('biomedical:updated', { id: updated.id });
    res.json(updated);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============================================================
// MAINTENANCE LOGS
// ============================================================
router.get('/equipment/:id/logs', requireAuth, requireBiomedical, async (req, res) => {
  try {
    const logs = await prisma.maintenanceLog.findMany({
      where: { equipmentId: parseInt(req.params.id) },
      orderBy: { loggedAt: 'desc' }
    });
    res.json(logs);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/equipment/:id/logs', requireAuth, requireBiomedical, async (req, res) => {
  const { logType, description, performedBy, cost, statusBefore, statusAfter } = req.body;
  
  if (!logType || !description || !performedBy) {
    return res.status(400).json({ error: 'Log type, description, and performed by required' });
  }

  try {
    const equipmentRecord = await prisma.equipment.findUnique({
      where: { id: parseInt(req.params.id) }
    });
    
    if (!equipmentRecord) {
      return res.status(404).json({ error: 'Equipment not found' });
    }

    const log = await prisma.maintenanceLog.create({
      data: {
        equipmentId: parseInt(req.params.id),
        logType,
        description,
        performedBy,
        cost: cost ? parseFloat(cost) : null,
        statusBefore: statusBefore || equipmentRecord.status,
        statusAfter: statusAfter || equipmentRecord.status
      }
    });

    // If logType is "routine" or "calibration", update lastServiced
    if (logType === 'routine' || logType === 'calibration') {
      await prisma.equipment.update({
        where: { id: parseInt(req.params.id) },
        data: { 
          lastServiced: new Date(),
          status: statusAfter || equipmentRecord.status
        }
      });
    } else if (statusAfter) {
      await prisma.equipment.update({
        where: { id: parseInt(req.params.id) },
        data: { status: statusAfter }
      });
    }

    req.app.locals.emit('biomedical:updated', { id: parseInt(req.params.id) });
    res.status(201).json(log);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============================================================
// SUMMARY
// ============================================================
router.get('/summary', requireAuth, requireBiomedical, async (req, res) => {
  try {
    const all = await prisma.equipment.findMany();
    
    const operational = all.filter(e => e.status === 'operational').length;
    const maintenance = all.filter(e => e.status === 'maintenance').length;
    const outOfOrder = all.filter(e => e.status === 'out_of_order').length;
    
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const dueForService = all.filter(e => 
      e.nextService && new Date(e.nextService) <= thirtyDaysFromNow && new Date(e.nextService) >= now
    ).length;
    
    res.json({
      total: all.length,
      operational,
      maintenance,
      outOfOrder,
      dueForService
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
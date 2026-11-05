const express = require('express');
const prisma = require('../prismaClient');
const { requireAuth } = require('../auth');

const router = express.Router();

function requireCatering(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  const dept = String(req.user.department || '').toLowerCase();
  if (dept !== 'catering' && dept !== 'it' && dept !== 'superadmin') {
    return res.status(403).json({ error: 'Only Catering and IT can access this' });
  }
  next();
}

// ============================================================
// WARDS
// ============================================================
router.get('/wards', requireAuth, requireCatering, async (req, res) => {
  try {
    const wards = await prisma.cateringWard.findMany({ orderBy: { name: 'asc' } });
    res.json(wards);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/wards', requireAuth, requireCatering, async (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'Name required' });
  try {
    const existing = await prisma.cateringWard.findUnique({ where: { name: name.trim() } });
    if (existing) return res.json(existing);
    const ward = await prisma.cateringWard.create({ data: { name: name.trim() } });
    res.status(201).json(ward);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============================================================
// MEAL TYPES
// ============================================================
router.get('/meals', requireAuth, requireCatering, async (req, res) => {
  try {
    const meals = await prisma.cateringMealType.findMany({ orderBy: { name: 'asc' } });
    res.json(meals);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/meals', requireAuth, requireCatering, async (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'Name required' });
  try {
    const existing = await prisma.cateringMealType.findUnique({ where: { name: name.trim() } });
    if (existing) return res.json(existing);
    const meal = await prisma.cateringMealType.create({ data: { name: name.trim() } });
    res.status(201).json(meal);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============================================================
// DELIVERIES (Batched)
// ============================================================
router.get('/deliveries', requireAuth, requireCatering, async (req, res) => {
  try {
    const { from, to } = req.query;
    const where = {};
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from + 'T00:00:00');
      if (to) where.createdAt.lte = new Date(to + 'T23:59:59.999');
    }
    
    const deliveries = await prisma.mealDelivery.findMany({
      where,
      include: { ward: true, mealType: true },
      orderBy: { createdAt: 'desc' }
    });
    res.json(deliveries);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Batch POST: { wardId, notes, meals: [{ mealTypeId, quantity }] }
router.post('/deliveries', requireAuth, requireCatering, async (req, res) => {
  const { wardId, notes, meals } = req.body;
  
  if (!wardId || !meals || meals.length === 0) {
    return res.status(400).json({ error: 'Ward and at least one meal required' });
  }

  try {
    const batchId = 'B-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();
    
    const created = await Promise.all(meals.map(m =>
      prisma.mealDelivery.create({
        data: {
          batchId,
          wardId: parseInt(wardId),
          mealTypeId: parseInt(m.mealTypeId),
          quantity: parseInt(m.quantity),
          notes: notes || null,
          deliveredBy: req.user.fullName,
          status: 'prepared'
        }
      })
    ));

    req.app.locals.emit('catering:updated', { batchId });
    res.status(201).json({ batchId, count: created.length });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Mark whole batch delivered
router.patch('/deliveries/batch/:batchId/deliver', requireAuth, requireCatering, async (req, res) => {
  try {
    await prisma.mealDelivery.updateMany({
      where: { batchId: req.params.batchId },
      data: { status: 'delivered' }
    });
    req.app.locals.emit('catering:updated', { batchId: req.params.batchId });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
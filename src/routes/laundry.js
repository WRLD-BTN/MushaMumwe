const express = require('express');
const prisma = require('../prismaClient');
const { requireAuth } = require('../auth');

const router = express.Router();

function requireLaundry(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  const dept = String(req.user.department || '').toLowerCase();
  if (dept !== 'laundry' && dept !== 'it' && dept !== 'superadmin') {
    return res.status(403).json({ error: 'Only Laundry and IT can access this' });
  }
  next();
}

// GET movements with date filter
router.get('/movements', requireAuth, requireLaundry, async (req, res) => {
  try {
    const { from, to, type } = req.query;
    const where = {};
    
    if (type && type !== 'all') where.type = type;
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from + 'T00:00:00');
      if (to) where.createdAt.lte = new Date(to + 'T23:59:59.999');
    }
    
    const movements = await prisma.linenMovement.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    });
    res.json(movements);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST new movement
router.post('/movements', requireAuth, requireLaundry, async (req, res) => {
  const { type, items } = req.body;
  
  if (!type || !items || items.length === 0) {
    return res.status(400).json({ error: 'Type and at least one item required' });
  }

  try {
    const created = await Promise.all(items.map(item =>
      prisma.linenMovement.create({
        data: {
          type,
          itemType: item.itemType,
          ward: item.ward,
          quantity: parseInt(item.quantity),
          condition: item.condition || 'good',
          notes: item.notes || null,
          loggedBy: req.user.fullName,
        }
      })
    ));

    req.app.locals.emit('laundry:updated', { count: created.length });
    res.status(201).json({ count: created.length });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
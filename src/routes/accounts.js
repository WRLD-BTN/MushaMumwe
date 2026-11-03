const express = require('express');
const prisma = require('../prismaClient');
const { requireAuth } = require('../auth');

const router = express.Router();

function requireAccounts(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  const dept = String(req.user.department || '').toLowerCase();
  if (dept !== 'accounts' && dept !== 'it' && dept !== 'superadmin') {
    return res.status(403).json({ error: 'Only Accounts and IT can access this' });
  }
  next();
}

// ============================================================
// CASH FLOW
// ============================================================

// GET summary for the selected date range
router.get('/summary', requireAuth, requireAccounts, async (req, res) => {
  try {
    let from = req.query.from ? new Date(req.query.from + 'T00:00:00') : new Date();
    let to = req.query.to ? new Date(req.query.to + 'T23:59:59.999') : new Date();
    
    if (!req.query.from) from.setHours(0, 0, 0, 0);
    if (!req.query.to) to.setHours(23, 59, 59, 999);

    const flows = await prisma.cashFlow.findMany({
      where: { date: { gte: from, lte: to } },
      orderBy: { date: 'desc' }
    });

    let usdNet = 0;
    let zwgNet = 0;
    const sourceBreakdown = {}; 

    flows.forEach(f => {
      const amount = f.type === 'in' ? f.amount : -f.amount;
      if (f.currency === 'USD') usdNet += amount;
      if (f.currency === 'ZWG') zwgNet += amount;

      if (f.type === 'in') {
        if (!sourceBreakdown[f.source]) {
          sourceBreakdown[f.source] = { USD: 0, ZWG: 0 };
        }
        sourceBreakdown[f.source][f.currency] += f.amount;
      }
    });

    res.json({ usdNet, zwgNet, flows, sourceBreakdown });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST record cash flow
router.post('/', requireAuth, requireAccounts, async (req, res) => {
  const { type, currency, amount, source, reason } = req.body;
  if (!type || !currency || !amount || !source) {
    return res.status(400).json({ error: 'Type, currency, amount, and source are required' });
  }
  try {
    const record = await prisma.cashFlow.create({
      data: {
        type,
        currency,
        amount: parseFloat(amount),
        source,
        reason: reason || '',
        addedBy: req.user.fullName,
      }
    });
    res.status(201).json(record);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============================================================
// PROCUREMENT SPENDING
// ============================================================

// GET procurement orders that have been ordered (to show supplier & price)
router.get('/procurement-orders', requireAuth, requireAccounts, async (req, res) => {
  try {
    const where = {
      status: { in: ['ordered', 'received', 'in_storage'] }
    };

    // Handle date filters
    const { from, to } = req.query;
    if (from || to) {
      where.orderDate = {};
      if (from) where.orderDate.gte = new Date(from + 'T00:00:00');
      if (to) {
        const toDate = new Date(to + 'T23:59:59.999');
        where.orderDate.lte = toDate;
      }
    }

    const orders = await prisma.procurementOrder.findMany({
      where,
      include: {
        orderRequest: true
      },
      orderBy: { orderDate: 'desc' },
      take: 100
    });
    res.json(orders);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
const express = require('express');
const prisma = require('../prismaClient');
const { requireAuth, isSuperAdmin, isITOrSuperAdmin } = require('../auth');

const router = express.Router();

// ============================================================
// LIST inventory
// ============================================================
router.get('/', requireAuth, async (req, res) => {
  try {
    const { search, category, from, to, lowStock } = req.query;
    const where = {};

    if (category && category !== 'all') where.category = category;
    if (search) where.name = { contains: search };
    if (lowStock === 'true') where.quantity = { lt: 10 };
    if (from || to) {
      where.lastReceived = {};
      if (from) where.lastReceived.gte = new Date(from);
      if (to) {
        const toDate = new Date(to); toDate.setHours(23, 59, 59, 999);
        where.lastReceived.lte = toDate;
      }
    }

    const items = await prisma.inventoryItem.findMany({
      where,
      orderBy: { name: 'asc' },
      include: { itemReceives: { orderBy: { receivedAt: 'desc' }, take: 3 } },
    });
    res.json(items);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============================================================
// SUMMARY
// ============================================================
router.get('/summary', requireAuth, async (req, res) => {
  try {
    const items = await prisma.inventoryItem.findMany({ select: { name: true, quantity: true, unit: true } });
    const critical = items.filter(i => i.quantity < 10).length;
    const low = items.filter(i => i.quantity >= 10 && i.quantity < 50).length;
    const adequate = items.filter(i => i.quantity >= 50).length;
    res.json({ totalItems: items.length, critical, low, adequate, items });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============================================================
// CSV EXPORT
// ============================================================
router.get('/export', requireAuth, async (req, res) => {
  try {
    const { search, category, from, to, lowStock } = req.query;
    const where = {};

    if (category && category !== 'all') where.category = category;
    if (search) where.name = { contains: search };
    if (lowStock === 'true') where.quantity = { lt: 10 };
    if (from || to) {
      where.lastReceived = {};
      if (from) where.lastReceived.gte = new Date(from);
      if (to) {
        const toDate = new Date(to); toDate.setHours(23, 59, 59, 999);
        where.lastReceived.lte = toDate;
      }
    }

    const items = await prisma.inventoryItem.findMany({ where, orderBy: { name: 'asc' } });

    const escape = (v) => '"' + String(v ?? '').replace(/"/g, '""') + '"';
    const lines = [
      '# Sally Mugabe Central Hospital - Inventory Report',
      '# Generated: ' + new Date().toISOString(),
      '# Filters: category=' + (category || 'all') + ' lowStock=' + (lowStock || 'false'),
      '# Total: ' + items.length,
      '',
      ['ID','Name','Category','Quantity','Unit','Expiry','Last Received'].join(','),
    ];
    const rows = items.map(i => [
      i.id, escape(i.name), escape(i.category || ''), i.quantity, escape(i.unit),
      escape(i.expiryDate ? i.expiryDate.toISOString() : ''),
      escape(i.lastReceived ? i.lastReceived.toISOString() : ''),
    ].join(','));

    const csv = lines.concat(rows).join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="inventory-' + new Date().toISOString().split('T')[0] + '.csv"');
    res.send(csv);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============================================================
// APPROVED ORDERS - ready to receive
// ============================================================
router.get('/approved-orders', requireAuth, async (req, res) => {
  try {
    const orders = await prisma.orderRequest.findMany({
      where: { status: { in: ['approved', 'ordered'] } },
      include: { procurementOrder: true },
      orderBy: { updatedAt: 'desc' },
    });
    res.json(orders);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============================================================
// RECEIVE items
// ============================================================
router.post('/receive', requireAuth, async (req, res) => {
  if (!isITOrSuperAdmin(req) && req.user.department !== 'Stores') {
    return res.status(403).json({ error: 'Only Stores can receive items' });
  }

  const { procurementOrderId, orderRequestId, itemName, quantityReceived, notes } = req.body;
  if (!itemName || !quantityReceived) {
    return res.status(400).json({ error: 'itemName and quantityReceived required' });
  }

  try {
    let procOrder = null;
    if (procurementOrderId) {
      procOrder = await prisma.procurementOrder.findUnique({ where: { id: parseInt(procurementOrderId) } });
    } else if (orderRequestId) {
      procOrder = await prisma.procurementOrder.findUnique({ where: { orderRequestId: parseInt(orderRequestId) } });
    }
    if (!procOrder) return res.status(404).json({ error: 'Procurement order not found' });

    let inventoryItem = await prisma.inventoryItem.findUnique({ where: { name: itemName } });
    if (!inventoryItem) {
      inventoryItem = await prisma.inventoryItem.create({
        data: { name: itemName, quantity: 0, unit: 'units' },
      });
    }

    const updated = await prisma.inventoryItem.update({
      where: { id: inventoryItem.id },
      data: { quantity: inventoryItem.quantity + parseInt(quantityReceived), lastReceived: new Date() },
    });

    const itemReceive = await prisma.itemReceive.create({
      data: {
        procurementOrderId: procOrder.id, inventoryItemId: inventoryItem.id,
        quantityReceived: parseInt(quantityReceived), receivedBy: req.user.fullName, notes: notes || '',
      },
    });

    const orderRequest = await prisma.orderRequest.findUnique({ where: { id: procOrder.orderRequestId } });
    if (orderRequest && orderRequest.status !== 'received') {
      await prisma.orderRequest.update({ where: { id: orderRequest.id }, data: { status: 'received' } });
      await prisma.orderRequestStatusLog.create({
        data: {
          orderRequestId: orderRequest.id, oldStatus: orderRequest.status, newStatus: 'received',
          changedBy: req.user.fullName,
          notes: 'Received ' + itemName + ' x' + quantityReceived,
        },
      });
      req.app.locals.emit('order:updated', { id: orderRequest.id, status: 'received', department: orderRequest.requestingDepartment });
    }

    req.app.locals.emit('inventory:updated', { itemId: updated.id, name: updated.name, quantity: updated.quantity });
    res.json({ message: 'Items received', itemReceive, inventoryItem: updated });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============================================================
// RECEIVE HISTORY
// ============================================================
router.get('/receive-history', requireAuth, async (req, res) => {
  try {
    const history = await prisma.itemReceive.findMany({
      include: { inventoryItem: true, procurementOrder: { include: { orderRequest: true } } },
      orderBy: { receivedAt: 'desc' }, take: 50,
    });
    res.json(history);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
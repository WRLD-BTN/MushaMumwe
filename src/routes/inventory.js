const express = require('express');
const prisma = require('../prismaClient');
const { requireAuth } = require('../auth');

const router = express.Router();

router.get('/', requireAuth, async (req, res) => {
  try {
    const items = await prisma.inventoryItem.findMany({
      orderBy: { name: 'asc' },
      include: { itemReceives: { orderBy: { receivedAt: 'desc' }, take: 3 } },
    });
    res.json(items);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/summary', requireAuth, async (req, res) => {
  try {
    const items = await prisma.inventoryItem.findMany({
      select: { name: true, quantity: true, unit: true },
    });
    const critical = items.filter(i => i.quantity < 10).length;
    const low = items.filter(i => i.quantity >= 10 && i.quantity < 50).length;
    const adequate = items.filter(i => i.quantity >= 50).length;
    res.json({ totalItems: items.length, critical, low, adequate, items });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================================
// CSV EXPORT — Inventory
// ============================================================
router.get('/export', requireAuth, async (req, res) => {
  try {
    const items = await prisma.inventoryItem.findMany({ orderBy: { name: 'asc' } });

    const escape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const header = ['ID', 'Name', 'Quantity', 'Unit', 'Last Received'].join(',');
    const rows = items.map(i => [
      i.id,
      escape(i.name),
      i.quantity,
      escape(i.unit),
      escape(i.lastReceived ? i.lastReceived.toISOString() : ''),
    ].join(','));

    const csv = [header, ...rows].join('\n');
    const filename = `inventory-${new Date().toISOString().split('T')[0]}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/approved-orders', requireAuth, async (req, res) => {
  try {
    const orders = await prisma.orderRequest.findMany({
      where: { status: { in: ['approved', 'ordered'] } },
      include: { procurementOrder: true },
      orderBy: { updatedAt: 'desc' },
    });
    res.json(orders);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/receive', requireAuth, async (req, res) => {
  if (req.user.department !== 'Stores' && req.user.department !== 'IT') {
    return res.status(403).json({ error: 'Only Stores can receive items' });
  }

  const { procurementOrderId, orderRequestId, itemName, quantityReceived, notes } = req.body;

  if (!itemName || !quantityReceived) {
    return res.status(400).json({ error: 'itemName and quantityReceived required' });
  }

  try {
    let procOrder = null;
    if (procurementOrderId) {
      procOrder = await prisma.procurementOrder.findUnique({
        where: { id: parseInt(procurementOrderId) },
      });
    } else if (orderRequestId) {
      procOrder = await prisma.procurementOrder.findUnique({
        where: { orderRequestId: parseInt(orderRequestId) },
      });
    }

    if (!procOrder) {
      return res.status(404).json({ error: 'Procurement order not found' });
    }

    let inventoryItem = await prisma.inventoryItem.findUnique({ where: { name: itemName } });
    if (!inventoryItem) {
      inventoryItem = await prisma.inventoryItem.create({
        data: { name: itemName, quantity: 0, unit: 'units' },
      });
    }

    const updated = await prisma.inventoryItem.update({
      where: { id: inventoryItem.id },
      data: {
        quantity: inventoryItem.quantity + parseInt(quantityReceived),
        lastReceived: new Date(),
      },
    });

    const itemReceive = await prisma.itemReceive.create({
      data: {
        procurementOrderId: procOrder.id,
        inventoryItemId: inventoryItem.id,
        quantityReceived: parseInt(quantityReceived),
        receivedBy: req.user.fullName,
        notes: notes || '',
      },
    });

    const orderRequest = await prisma.orderRequest.findUnique({
      where: { id: procOrder.orderRequestId },
    });

    if (orderRequest && orderRequest.status !== 'received') {
      await prisma.orderRequest.update({
        where: { id: orderRequest.id },
        data: { status: 'received' },
      });

      await prisma.orderRequestStatusLog.create({
        data: {
          orderRequestId: orderRequest.id,
          oldStatus: orderRequest.status,
          newStatus: 'received',
          changedBy: req.user.fullName,
          notes: `Received ${itemName} x${quantityReceived}`,
        },
      });

      req.app.locals.emit('order:updated', {
        id: orderRequest.id,
        status: 'received',
        department: orderRequest.requestingDepartment,
      });
    }

    req.app.locals.emit('inventory:updated', {
      itemId: updated.id,
      name: updated.name,
      quantity: updated.quantity,
    });

    res.json({ message: 'Items received', itemReceive, inventoryItem: updated });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/receive-history', requireAuth, async (req, res) => {
  try {
    const history = await prisma.itemReceive.findMany({
      include: {
        inventoryItem: true,
        procurementOrder: { include: { orderRequest: true } },
      },
      orderBy: { receivedAt: 'desc' },
      take: 50,
    });
    res.json(history);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
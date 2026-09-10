const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { requireAuth } = require('../auth');

const router = express.Router();
const prisma = new PrismaClient();

// GET all inventory items
router.get('/', async (req, res) => {
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

// GET inventory summary (for dashboard)
router.get('/summary', async (req, res) => {
  try {
    const items = await prisma.inventoryItem.findMany({
      select: { name: true, quantity: true, unit: true },
    });

    const critical = items.filter(i => i.quantity < 10).length;
    const low = items.filter(i => i.quantity >= 10 && i.quantity < 50).length;
    const adequate = items.filter(i => i.quantity >= 50).length;

    res.json({
      totalItems: items.length,
      critical,
      low,
      adequate,
      items,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// RECEIVE items (Stores only)
router.post('/receive', requireAuth, async (req, res) => {
  if (req.user.department !== 'Stores' && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Only Stores can receive items' });
  }

  const { procurementOrderId, itemName, quantityReceived, notes } = req.body;

  if (!procurementOrderId || !itemName || !quantityReceived) {
    return res.status(400).json({ error: 'procurementOrderId, itemName, and quantityReceived are required' });
  }

  try {
    // Find or create inventory item
    let inventoryItem = await prisma.inventoryItem.findUnique({
      where: { name: itemName },
    });

    if (!inventoryItem) {
      inventoryItem = await prisma.inventoryItem.create({
        data: {
          name: itemName,
          quantity: 0,
          unit: 'units',
        },
      });
    }

    // Update inventory quantity
    const updated = await prisma.inventoryItem.update({
      where: { id: inventoryItem.id },
      data: {
        quantity: inventoryItem.quantity + parseInt(quantityReceived),
        lastReceived: new Date(),
      },
    });

    // Record item receive
    const itemReceive = await prisma.itemReceive.create({
      data: {
        procurementOrderId: parseInt(procurementOrderId),
        inventoryItemId: inventoryItem.id,
        quantityReceived: parseInt(quantityReceived),
        receivedBy: req.user.fullName,
        notes: notes || '',
      },
    });

    // Update procurement order status
    const procOrder = await prisma.procurementOrder.findUnique({
      where: { id: parseInt(procurementOrderId) },
      include: { orderRequest: true },
    });

    if (procOrder) {
      // Update related order request status to 'in_storage'
      await prisma.orderRequest.update({
        where: { id: procOrder.orderRequestId },
        data: { status: 'in_storage', updatedAt: new Date() },
      });

      // Log status change
      await prisma.orderRequestStatusLog.create({
        data: {
          orderRequestId: procOrder.orderRequestId,
          oldStatus: 'ordered',
          newStatus: 'in_storage',
          changedBy: req.user.fullName,
          notes: `Items received: ${itemName} x${quantityReceived}`,
        },
      });
    }

    res.json({
      message: 'Items received and inventory updated',
      itemReceive,
      inventoryItem: updated,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET item receive history
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

// UPDATE inventory item (manual adjustment - Stores only)
router.patch('/:id', requireAuth, async (req, res) => {
  if (req.user.department !== 'Stores' && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Only Stores can update inventory' });
  }

  const { quantity, notes } = req.body;

  try {
    const item = await prisma.inventoryItem.update({
      where: { id: parseInt(req.params.id) },
      data: { quantity: parseInt(quantity) },
    });

    res.json(item);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;

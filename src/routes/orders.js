const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { requireAuth } = require('../auth');

const router = express.Router();
const prisma = new PrismaClient();

// CREATE order request (any department can request)
router.post('/request', requireAuth, async (req, res) => {
  const { itemName, quantity, reason } = req.body;

  if (!itemName || !quantity || !reason) {
    return res.status(400).json({ error: 'itemName, quantity, and reason are required' });
  }

  try {
    const orderRequest = await prisma.orderRequest.create({
      data: {
        requestingDepartment: req.user.department,
        requestingBy: req.user.fullName,
        itemName,
        quantity: parseInt(quantity),
        reason,
        status: 'pending',
      },
      include: { statusLogs: true },
    });

    // Create initial status log
    await prisma.orderRequestStatusLog.create({
      data: {
        orderRequestId: orderRequest.id,
        oldStatus: 'created',
        newStatus: 'pending',
        changedBy: req.user.fullName,
        notes: 'Order request created',
      },
    });

    res.json(orderRequest);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET all order requests (Procurement sees all, others see only theirs)
router.get('/requests', requireAuth, async (req, res) => {
  try {
    let where = {};
    
    // Only Procurement and IT Admin see all requests
    if (req.user.department !== 'Procurement' && req.user.role !== 'admin') {
      where.requestingDepartment = req.user.department;
    }

    const requests = await prisma.orderRequest.findMany({
      where,
      include: {
        statusLogs: { orderBy: { timestamp: 'desc' } },
        procurementOrder: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(requests);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET single order request
router.get('/requests/:id', requireAuth, async (req, res) => {
  try {
    const request = await prisma.orderRequest.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        statusLogs: { orderBy: { timestamp: 'desc' } },
        procurementOrder: { include: { itemReceives: true } },
      },
    });

    if (!request) return res.status(404).json({ error: 'Order request not found' });

    // Check authorization
    if (req.user.department !== 'Procurement' && req.user.role !== 'admin') {
      if (request.requestingDepartment !== req.user.department) {
        return res.status(403).json({ error: 'Unauthorized' });
      }
    }

    res.json(request);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// APPROVE order request (Procurement only)
router.patch('/requests/:id/approve', requireAuth, async (req, res) => {
  if (req.user.department !== 'Procurement' && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Only Procurement can approve orders' });
  }

  const { supplierName } = req.body;

  try {
    const request = await prisma.orderRequest.findUnique({
      where: { id: parseInt(req.params.id) },
    });

    if (!request) return res.status(404).json({ error: 'Order request not found' });
    if (request.status !== 'pending') {
      return res.status(400).json({ error: 'Can only approve pending requests' });
    }

    // Update request status
    const updated = await prisma.orderRequest.update({
      where: { id: parseInt(req.params.id) },
      data: { status: 'approved', updatedAt: new Date() },
      include: { statusLogs: true },
    });

    // Log status change
    await prisma.orderRequestStatusLog.create({
      data: {
        orderRequestId: parseInt(req.params.id),
        oldStatus: 'pending',
        newStatus: 'approved',
        changedBy: req.user.fullName,
        notes: `Approved by ${req.user.fullName}`,
      },
    });

    // Create procurement order
    await prisma.procurementOrder.create({
      data: {
        orderRequestId: parseInt(req.params.id),
        supplierName: supplierName || 'TBD',
        status: 'approved',
      },
    });

    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// REJECT order request (Procurement only)
router.patch('/requests/:id/reject', requireAuth, async (req, res) => {
  if (req.user.department !== 'Procurement' && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Only Procurement can reject orders' });
  }

  const { reason } = req.body;

  try {
    const request = await prisma.orderRequest.findUnique({
      where: { id: parseInt(req.params.id) },
    });

    if (!request) return res.status(404).json({ error: 'Order request not found' });

    const updated = await prisma.orderRequest.update({
      where: { id: parseInt(req.params.id) },
      data: { status: 'rejected', updatedAt: new Date() },
      include: { statusLogs: true },
    });

    await prisma.orderRequestStatusLog.create({
      data: {
        orderRequestId: parseInt(req.params.id),
        oldStatus: request.status,
        newStatus: 'rejected',
        changedBy: req.user.fullName,
        notes: reason || 'Rejected by Procurement',
      },
    });

    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// SEND order to supplier (Procurement only)
router.patch('/requests/:id/send', requireAuth, async (req, res) => {
  if (req.user.department !== 'Procurement' && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Only Procurement can send orders' });
  }

  try {
    const request = await prisma.orderRequest.findUnique({
      where: { id: parseInt(req.params.id) },
      include: { procurementOrder: true },
    });

    if (!request) return res.status(404).json({ error: 'Order request not found' });
    if (request.status !== 'approved') {
      return res.status(400).json({ error: 'Can only send approved orders' });
    }

    // Update request status
    const updated = await prisma.orderRequest.update({
      where: { id: parseInt(req.params.id) },
      data: { status: 'ordered', updatedAt: new Date() },
    });

    // Update procurement order status
    if (request.procurementOrder) {
      await prisma.procurementOrder.update({
        where: { id: request.procurementOrder.id },
        data: { status: 'ordered' },
      });
    }

    // Log status change
    await prisma.orderRequestStatusLog.create({
      data: {
        orderRequestId: parseInt(req.params.id),
        oldStatus: 'approved',
        newStatus: 'ordered',
        changedBy: req.user.fullName,
        notes: 'Order sent to supplier',
      },
    });

    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET order summary (for dashboard)
router.get('/summary', async (req, res) => {
  try {
    const pending = await prisma.orderRequest.count({ where: { status: 'pending' } });
    const approved = await prisma.orderRequest.count({ where: { status: 'approved' } });
    const ordered = await prisma.orderRequest.count({ where: { status: 'ordered' } });
    const rejected = await prisma.orderRequest.count({ where: { status: 'rejected' } });
    const inStorage = await prisma.orderRequest.count({ where: { status: 'in_storage' } });

    res.json({
      pending,
      approved,
      ordered,
      rejected,
      inStorage,
      total: pending + approved + ordered + rejected + inStorage,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;

const express = require('express');
const prisma = require('../prismaClient');
const { requireAuth, canonicalDept, isITOrSuperAdmin } = require('../auth');

const router = express.Router();

// ============================================================
// CREATE request - accepts originatorDepartment
// ============================================================
router.post('/request', requireAuth, async (req, res) => {
  const { itemName, quantity, reason, urgency, category, originatorDepartment } = req.body;
  if (!itemName || !quantity || !reason) {
    return res.status(400).json({ error: 'itemName, quantity, and reason are required' });
  }

  try {
    const submitterDept = canonicalDept(req.user.department);
    const originatorDept = originatorDepartment
      ? canonicalDept(originatorDepartment)
      : submitterDept;

    const orderRequest = await prisma.orderRequest.create({
      data: {
        requestingDepartment: submitterDept,
        originatorDepartment: originatorDept,
        requestingBy: req.user.fullName,
        itemName,
        quantity: parseInt(quantity),
        reason,
        status: 'pending',
        urgency: urgency || 'normal',
        category: category || null,
      },
    });

    await prisma.orderRequestStatusLog.create({
      data: {
        orderRequestId: orderRequest.id,
        oldStatus: 'created',
        newStatus: 'pending',
        changedBy: req.user.fullName,
        notes: submitterDept === originatorDept
          ? 'Order request created'
          : 'Created by ' + submitterDept + ' for ' + originatorDept,
      },
    });

    req.app.locals.emit('order:created', {
      id: orderRequest.id,
      department: orderRequest.requestingDepartment,
      originator: orderRequest.originatorDepartment,
      itemName: orderRequest.itemName,
    });

    res.status(201).json(orderRequest);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================================
// LIST requests
// ============================================================
router.get('/requests', requireAuth, async (req, res) => {
  try {
    const where = {};
    if (!isITOrSuperAdmin(req) && req.user.department !== 'Procurement') {
      where.requestingDepartment = req.user.department;
    }
    const requests = await prisma.orderRequest.findMany({
      where,
      include: {
        statusLogs: { orderBy: { timestamp: 'desc' } },
        procurementOrder: { include: { itemReceives: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(requests);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================================
// MY tenders - sees ones I submitted OR ones requested for my dept
// ============================================================
router.get('/my', requireAuth, async (req, res) => {
  try {
    const myDept = String(req.user.department || '').trim().toLowerCase();
    const all = await prisma.orderRequest.findMany({
      include: {
        statusLogs: { orderBy: { timestamp: 'desc' } },
        procurementOrder: { include: { itemReceives: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    const mine = all.filter(r => {
      const submitter = String(r.requestingDepartment || '').trim().toLowerCase();
      const originator = String(r.originatorDepartment || '').trim().toLowerCase();
      return submitter === myDept || originator === myDept;
    });
    res.json(mine);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================================
// MY tenders CSV export
// ============================================================
router.get('/my/export', requireAuth, async (req, res) => {
  try {
    const myDept = String(req.user.department || '').trim().toLowerCase();
    const all = await prisma.orderRequest.findMany({
      include: { procurementOrder: true },
      orderBy: { createdAt: 'desc' },
    });
    const mine = all.filter(r => {
      const submitter = String(r.requestingDepartment || '').trim().toLowerCase();
      const originator = String(r.originatorDepartment || '').trim().toLowerCase();
      return submitter === myDept || originator === myDept;
    });

    const escape = (v) => '"' + String(v ?? '').replace(/"/g, '""') + '"';
    const header = ['ID','Submitted By','Originator','Item','Quantity','Reason','Status','Supplier','Created'].join(',');
    const rows = mine.map(t => [
      t.id,
      escape(t.requestingDepartment),
      escape(t.originatorDepartment || t.requestingDepartment),
      escape(t.itemName),
      t.quantity,
      escape(t.reason),
      escape(t.status),
      escape(t.procurementOrder?.supplierName || ''),
      escape(t.createdAt.toISOString()),
    ].join(','));

    const csv = [header].concat(rows).join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="tenders-' + myDept + '-' + new Date().toISOString().split('T')[0] + '.csv"');
    res.send(csv);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================================
// HISTORY
// ============================================================
router.get('/history', requireAuth, async (req, res) => {
  if (req.user.department !== 'Procurement' && !isITOrSuperAdmin(req)) {
    return res.status(403).json({ error: 'Only Procurement can view tender history' });
  }
  try {
    const { search, status, department, from, to } = req.query;
    const all = await prisma.orderRequest.findMany({
      include: {
        statusLogs: { orderBy: { timestamp: 'desc' } },
        procurementOrder: { include: { itemReceives: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    let filtered = all;
    if (status && status !== 'all') filtered = filtered.filter(r => r.status === status);
    if (department && department !== 'all') {
      const d = department.toLowerCase();
      filtered = filtered.filter(r =>
        String(r.requestingDepartment || '').toLowerCase() === d ||
        String(r.originatorDepartment || '').toLowerCase() === d
      );
    }
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(r =>
        String(r.itemName || '').toLowerCase().includes(q) ||
        String(r.requestingBy || '').toLowerCase().includes(q) ||
        String(r.requestingDepartment || '').toLowerCase().includes(q) ||
        String(r.originatorDepartment || '').toLowerCase().includes(q) ||
        String(r.reason || '').toLowerCase().includes(q) ||
        String(r.id) === q
      );
    }
    if (from) filtered = filtered.filter(r => new Date(r.createdAt) >= new Date(from));
    if (to) {
      const toDate = new Date(to); toDate.setHours(23, 59, 59, 999);
      filtered = filtered.filter(r => new Date(r.createdAt) <= toDate);
    }

    res.json(filtered);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================================
// HISTORY SUMMARY
// ============================================================
router.get('/history/summary', requireAuth, async (req, res) => {
  if (req.user.department !== 'Procurement' && !isITOrSuperAdmin(req)) {
    return res.status(403).json({ error: 'Only Procurement can view tender history' });
  }
  try {
    const all = await prisma.orderRequest.findMany({
      select: { status: true, requestingDepartment: true, originatorDepartment: true, createdAt: true },
    });
    const statuses = ['pending', 'awaiting_quotation', 'ordered', 'received', 'in_storage'];
    const byStatus = {};
    statuses.forEach(s => byStatus[s] = 0);
    all.forEach(r => { byStatus[r.status] = (byStatus[r.status] || 0) + 1; });

    const byDept = {};
    all.forEach(r => {
      const d = r.originatorDepartment || r.requestingDepartment || 'Unknown';
      byDept[d] = (byDept[d] || 0) + 1;
    });

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recent = all.filter(r => new Date(r.createdAt) >= thirtyDaysAgo).length;

    res.json({ total: all.length, byStatus, byDepartment: byDept, last30Days: recent });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================================
// HISTORY CSV EXPORT
// ============================================================
router.get('/history/export', requireAuth, async (req, res) => {
  if (req.user.department !== 'Procurement' && !isITOrSuperAdmin(req)) {
    return res.status(403).json({ error: 'Only Procurement can export tender history' });
  }
  try {
    const all = await prisma.orderRequest.findMany({
      include: { procurementOrder: true },
      orderBy: { createdAt: 'desc' },
    });
    const escape = (v) => '"' + String(v ?? '').replace(/"/g, '""') + '"';
    const header = ['ID','Submitted By','Originator','Requested By','Item','Quantity','Reason','Status','Supplier','Created'].join(',');
    const rows = all.map(t => [
      t.id,
      escape(t.requestingDepartment),
      escape(t.originatorDepartment || t.requestingDepartment),
      escape(t.requestingBy),
      escape(t.itemName),
      t.quantity,
      escape(t.reason),
      escape(t.status),
      escape(t.procurementOrder?.supplierName || ''),
      escape(t.createdAt.toISOString()),
    ].join(','));
    const csv = [header].concat(rows).join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="tender-history-' + new Date().toISOString().split('T')[0] + '.csv"');
    res.send(csv);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================================
// APPROVE AND SEND
// Accepts tenders in status 'pending' OR 'awaiting_quotation'
// Sets status to 'ordered' directly (no separate Send step)
// ============================================================
router.patch('/requests/:id/approve', requireAuth, async (req, res) => {
  if (req.user.department !== 'Procurement' && !isITOrSuperAdmin(req)) {
    return res.status(403).json({ error: 'Only Procurement can approve' });
  }
  const { supplierName, expectedDeliveryDate, approvalNotes } = req.body;

  try {
    const request = await prisma.orderRequest.findUnique({ where: { id: parseInt(req.params.id) } });
    if (!request) return res.status(404).json({ error: 'Request not found' });
    if (!['pending', 'awaiting_quotation'].includes(request.status)) {
      return res.status(400).json({ error: 'Cannot approve request in status ' + request.status });
    }
    if (!supplierName) return res.status(400).json({ error: 'Supplier name is required' });

    const updated = await prisma.orderRequest.update({
      where: { id: request.id },
      data: { status: 'ordered' },
    });

    await prisma.orderRequestStatusLog.create({
      data: {
        orderRequestId: request.id,
        oldStatus: request.status,
        newStatus: 'ordered',
        changedBy: req.user.fullName,
        notes: 'Approved and sent. Supplier: ' + supplierName,
      },
    });

    const existingPO = await prisma.procurementOrder.findUnique({ where: { orderRequestId: request.id } });
    const poData = {
      supplierName,
      expectedDeliveryDate: expectedDeliveryDate ? new Date(expectedDeliveryDate) : null,
      approvalNotes: approvalNotes || null,
      status: 'ordered',
    };

    if (!existingPO) {
      await prisma.procurementOrder.create({
        data: { orderRequestId: request.id, ...poData },
      });
    } else {
      await prisma.procurementOrder.update({
        where: { id: existingPO.id },
        data: poData,
      });
    }

    req.app.locals.emit('order:updated', {
      id: updated.id,
      status: 'ordered',
      department: updated.requestingDepartment,
      originator: updated.originatorDepartment,
    });

    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================================
// WAITING FOR QUOTATION - temporary hold, not rejection
// Can be approved later via /approve
// ============================================================
router.patch('/requests/:id/await-quotation', requireAuth, async (req, res) => {
  if (req.user.department !== 'Procurement' && !isITOrSuperAdmin(req)) {
    return res.status(403).json({ error: 'Only Procurement can mark awaiting quotation' });
  }
  const { note } = req.body;

  try {
    const request = await prisma.orderRequest.findUnique({ where: { id: parseInt(req.params.id) } });
    if (!request) return res.status(404).json({ error: 'Request not found' });
    if (request.status === 'ordered' || request.status === 'received') {
      return res.status(400).json({ error: 'Cannot pause a tender already ' + request.status });
    }

    const updated = await prisma.orderRequest.update({
      where: { id: request.id },
      data: { status: 'awaiting_quotation' },
    });

    await prisma.orderRequestStatusLog.create({
      data: {
        orderRequestId: request.id,
        oldStatus: request.status,
        newStatus: 'awaiting_quotation',
        changedBy: req.user.fullName,
        notes: note ? 'Waiting for quotation: ' + note : 'Waiting for quotation from supplier',
      },
    });

    req.app.locals.emit('order:updated', {
      id: updated.id,
      status: 'awaiting_quotation',
      department: updated.requestingDepartment,
      originator: updated.originatorDepartment,
    });

    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================================
// SUMMARY
// ============================================================
router.get('/summary', requireAuth, async (req, res) => {
  try {
    const statuses = ['pending', 'awaiting_quotation', 'ordered', 'received', 'in_storage'];
    const counts = {};
    for (const s of statuses) counts[s] = await prisma.orderRequest.count({ where: { status: s } });
    res.json({
      pending: counts.pending,
      awaitingQuotation: counts.awaiting_quotation,
      ordered: counts.ordered,
      received: counts.received + counts.in_storage,
      total: Object.values(counts).reduce((a, b) => a + b, 0),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
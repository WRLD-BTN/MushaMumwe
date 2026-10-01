const express = require('express');
const prisma = require('../prismaClient');
const { requireAuth, isSuperAdmin, isITOrSuperAdmin } = require('../auth');

const router = express.Router();

// ============================================================
// LIST employees with filters
// ============================================================
router.get('/', requireAuth, async (req, res) => {
  if (!isITOrSuperAdmin(req) && req.user.department !== 'HR') {
    return res.status(403).json({ error: 'Unauthorized' });
  }
  try {
    const { search, department, status, role, from, to } = req.query;
    const where = {};

    if (department && department !== 'all') where.department = department;
    if (status && status !== 'all') where.status = status;
    if (role && role !== 'all') where.role = role;
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { department: { contains: search } },
        { role: { contains: search } },
      ];
    }
    if (from) where.hireDate = { gte: new Date(from) };
    if (to) {
      const toDate = new Date(to); toDate.setHours(23, 59, 59, 999);
      where.hireDate = { ...(where.hireDate || {}), lte: toDate };
    }

    const employees = await prisma.employee.findMany({
      where,
      include: { ward: true, statusLogs: { orderBy: { timestamp: 'desc' }, take: 1 } },
      orderBy: { name: 'asc' },
    });
    res.json(employees);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============================================================
// PUBLIC SUMMARY - for the Live Board
// ============================================================
router.get('/summary', async (req, res) => {
  try {
    const counts = await prisma.employee.groupBy({ by: ['status'], _count: true });
    const summary = {
      active: counts.find(c => c.status === 'active')?._count || 0,
      on_leave: counts.find(c => c.status === 'on_leave')?._count || 0,
      sick: counts.find(c => c.status === 'sick')?._count || 0,
      terminated: counts.find(c => c.status === 'terminated')?._count || 0,
      total: counts.reduce((sum, c) => sum + c._count, 0),
    };
    const byDept = await prisma.employee.groupBy({
      by: ['department'], _count: true, where: { status: { not: 'terminated' } },
    });
    summary.byDepartment = byDept.map(d => ({ department: d.department, count: d._count }));
    res.json(summary);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============================================================
// CSV EXPORT
// ============================================================
router.get('/export', requireAuth, async (req, res) => {
  if (!isITOrSuperAdmin(req) && req.user.department !== 'HR') {
    return res.status(403).json({ error: 'Only HR can export staff data' });
  }
  try {
    const { search, department, status, role, from, to } = req.query;
    const where = {};
    if (department && department !== 'all') where.department = department;
    if (status && status !== 'all') where.status = status;
    if (role && role !== 'all') where.role = role;
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { department: { contains: search } },
        { role: { contains: search } },
      ];
    }
    if (from) where.hireDate = { gte: new Date(from) };
    if (to) {
      const toDate = new Date(to); toDate.setHours(23, 59, 59, 999);
      where.hireDate = { ...(where.hireDate || {}), lte: toDate };
    }

    const employees = await prisma.employee.findMany({
      where, include: { ward: true }, orderBy: { name: 'asc' },
    });

    const escape = (v) => '"' + String(v ?? '').replace(/"/g, '""') + '"';
    const lines = [
      '# Sally Mugabe Central Hospital - Staff Report',
      '# Generated: ' + new Date().toISOString(),
      '# Filters: dept=' + (department || 'all') + ' status=' + (status || 'all') + ' role=' + (role || 'all'),
      '# Total: ' + employees.length,
      '',
      ['ID','Name','Department','Role','Ward','Status','Hire Date','Termination Date'].join(','),
    ];
    const rows = employees.map(e => [
      e.id, escape(e.name), escape(e.department), escape(e.role || ''),
      escape(e.ward?.name || ''), escape(e.status),
      escape(e.hireDate ? e.hireDate.toISOString() : ''),
      escape(e.terminationDate ? e.terminationDate.toISOString() : ''),
    ].join(','));

    const csv = lines.concat(rows).join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="staff-' + new Date().toISOString().split('T')[0] + '.csv"');
    res.send(csv);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============================================================
// CREATE employee
// ============================================================
router.post('/', requireAuth, async (req, res) => {
  if (!isITOrSuperAdmin(req) && req.user.department !== 'HR') {
    return res.status(403).json({ error: 'Unauthorized' });
  }
  const { name, department, role, wardId, hireDate } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });

  try {
    const employee = await prisma.employee.create({
      data: {
        name, department, role: role || null,
        wardId: wardId ? parseInt(wardId) : null,
        status: 'active',
        hireDate: hireDate ? new Date(hireDate) : new Date(),
      },
    });
    res.json(employee);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============================================================
// UPDATE status
// ============================================================
router.patch('/:id/status', requireAuth, async (req, res) => {
  if (!isITOrSuperAdmin(req) && req.user.department !== 'HR') {
    return res.status(403).json({ error: 'Unauthorized' });
  }
  const { id } = req.params;
  const { status } = req.body;

  try {
    const employee = await prisma.employee.findUnique({ where: { id: parseInt(id) } });
    if (!employee) return res.status(404).json({ error: 'Employee not found' });

    const oldStatus = employee.status;
    const updateData = { status };
    if (status === 'terminated') updateData.terminationDate = new Date();

    const updated = await prisma.employee.update({
      where: { id: parseInt(id) }, data: updateData, include: { ward: true },
    });
    await prisma.employeeStatusLog.create({
      data: { employeeId: parseInt(id), oldStatus, newStatus: status, changedBy: req.user.fullName },
    });

    req.app.locals.emit('employee:updated', { id: updated.id, name: updated.name, status: updated.status });
    res.json(updated);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============================================================
// TERMINATE
// ============================================================
router.delete('/:id', requireAuth, async (req, res) => {
  if (!isITOrSuperAdmin(req) && req.user.department !== 'HR') {
    return res.status(403).json({ error: 'Unauthorized' });
  }
  const { id } = req.params;
  try {
    const employee = await prisma.employee.findUnique({ where: { id: parseInt(id) } });
    if (!employee) return res.status(404).json({ error: 'Employee not found' });

    const updated = await prisma.employee.update({
      where: { id: parseInt(id) },
      data: { status: 'terminated', terminationDate: new Date() },
    });
    await prisma.employeeStatusLog.create({
      data: { employeeId: parseInt(id), oldStatus: employee.status, newStatus: 'terminated', changedBy: req.user.fullName },
    });
    res.json({ message: 'Employee terminated', employee: updated });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
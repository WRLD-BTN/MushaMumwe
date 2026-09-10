const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { requireAuth } = require('../auth');

const router = express.Router();
const prisma = new PrismaClient();

// GET all employees (HR only)
router.get('/', requireAuth, async (req, res) => {
  if (req.user.department !== 'HR' && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  try {
    const employees = await prisma.employee.findMany({
      include: { ward: true, statusLogs: { orderBy: { timestamp: 'desc' }, take: 1 } },
      orderBy: { name: 'asc' },
    });
    res.json(employees);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET employee summary (public - for dashboard)
router.get('/summary', async (req, res) => {
  try {
    const counts = await prisma.employee.groupBy({
      by: ['status'],
      _count: true,
    });

    const summary = {
      active: counts.find(c => c.status === 'active')?._count || 0,
      on_leave: counts.find(c => c.status === 'on_leave')?._count || 0,
      sick: counts.find(c => c.status === 'sick')?._count || 0,
      terminated: counts.find(c => c.status === 'terminated')?._count || 0,
      total: counts.reduce((sum, c) => sum + c._count, 0),
    };

    // By department
    const byDept = await prisma.employee.groupBy({
      by: ['department'],
      _count: true,
      where: { status: { not: 'terminated' } },
    });

    summary.byDepartment = byDept.map(d => ({
      department: d.department,
      count: d._count,
    }));

    res.json(summary);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// CREATE new employee
router.post('/', requireAuth, async (req, res) => {
  if (req.user.department !== 'HR' && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  const { name, department, wardId, hireDate } = req.body;

  try {
    const employee = await prisma.employee.create({
      data: {
        name,
        department,
        wardId: wardId ? parseInt(wardId) : null,
        status: 'active',
        hireDate: hireDate ? new Date(hireDate) : new Date(),
      },
    });
    res.json(employee);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// UPDATE employee status
router.patch('/:id/status', requireAuth, async (req, res) => {
  if (req.user.department !== 'HR' && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  const { id } = req.params;
  const { status } = req.body;

  try {
    const employee = await prisma.employee.findUnique({ where: { id: parseInt(id) } });
    if (!employee) return res.status(404).json({ error: 'Employee not found' });

    const oldStatus = employee.status;

    // Handle termination
    let updateData = { status };
    if (status === 'terminated') {
      updateData.terminationDate = new Date();
    }

    const updated = await prisma.employee.update({
      where: { id: parseInt(id) },
      data: updateData,
      include: { ward: true },
    });

    // Log status change
    await prisma.employeeStatusLog.create({
      data: {
        employeeId: parseInt(id),
        oldStatus,
        newStatus: status,
        changedBy: req.user.fullName,
      },
    });

    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE (terminate) employee
router.delete('/:id', requireAuth, async (req, res) => {
  if (req.user.department !== 'HR' && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  const { id } = req.params;

  try {
    const employee = await prisma.employee.findUnique({ where: { id: parseInt(id) } });
    if (!employee) return res.status(404).json({ error: 'Employee not found' });

    // Mark as terminated instead of deleting
    const updated = await prisma.employee.update({
      where: { id: parseInt(id) },
      data: {
        status: 'terminated',
        terminationDate: new Date(),
      },
    });

    // Log termination
    await prisma.employeeStatusLog.create({
      data: {
        employeeId: parseInt(id),
        oldStatus: employee.status,
        newStatus: 'terminated',
        changedBy: req.user.fullName,
      },
    });

    res.json({ message: 'Employee terminated', employee: updated });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;

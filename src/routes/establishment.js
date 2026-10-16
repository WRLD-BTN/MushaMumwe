const express = require('express');
const prisma = require('../prismaClient');
const { requireAuth } = require('../auth');

const router = express.Router();

function requireHRorIT(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  const dept = String(req.user.department || '').toLowerCase();
  if (dept !== 'hr' && dept !== 'it' && dept !== 'superadmin') {
    return res.status(403).json({ error: 'Only HR and IT can access establishment' });
  }
  next();
}

const MOVEMENT_TYPES = ['transfer', 'retirement', 'resignation'];
const RESIGNATION_REASONS = [
  'Better opportunity elsewhere',
  'Relocation',
  'Health reasons',
  'Family reasons',
  'Further studies',
  'Salary dissatisfaction',
  'Retirement',
  'Other',
];

function calcYearsOfService(hireDate, endDate) {
  if (!hireDate || !endDate) return null;
  const years = (new Date(endDate) - new Date(hireDate)) / (1000 * 60 * 60 * 24 * 365.25);
  return Math.max(0, Math.floor(years));
}

router.get('/movements', requireAuth, requireHRorIT, async (req, res) => {
  try {
    const { search, type, department, from, to } = req.query;

    const where = {};
    if (type && type !== 'all') where.movementType = type;

    if (department && department !== 'all') {
      where.OR = [
        { fromDepartment: department },
        { toDepartment: department },
      ];
    }

    if (from || to) {
      where.effectiveDate = {};
      if (from) where.effectiveDate.gte = new Date(from);
      if (to) {
        const toDate = new Date(to);
        toDate.setHours(23, 59, 59, 999);
        where.effectiveDate.lte = toDate;
      }
    }

    if (search) {
      where.OR = [
        { employee: { name: { contains: search } } },
        { fromDepartment: { contains: search } },
        { toDepartment: { contains: search } },
        { reason: { contains: search } },
        { notes: { contains: search } },
      ];
    }

    const movements = await prisma.employeeMovement.findMany({
      where,
      include: {
        employee: { select: { id: true, name: true, department: true, role: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(movements);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/movements/:id', requireAuth, requireHRorIT, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const movement = await prisma.employeeMovement.findUnique({
      where: { id },
      include: {
        employee: { select: { id: true, name: true, department: true, role: true, hireDate: true, status: true } },
      },
    });
    if (!movement) return res.status(404).json({ error: 'Movement not found' });
    res.json(movement);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/transfer', requireAuth, requireHRorIT, async (req, res) => {
  const { employeeId, toDepartment, toWardId, effectiveDate, reason, approvedBy, notes } = req.body;

  if (!employeeId || !toDepartment || !effectiveDate) {
    return res.status(400).json({ error: 'employeeId, toDepartment, and effectiveDate are required' });
  }

  try {
    const employee = await prisma.employee.findUnique({ where: { id: parseInt(employeeId) } });
    if (!employee) return res.status(404).json({ error: 'Employee not found' });

    const movement = await prisma.$transaction(async (tx) => {
      const m = await tx.employeeMovement.create({
        data: {
          employeeId: parseInt(employeeId),
          movementType: 'transfer',
          fromDepartment: employee.department,
          fromWardId: employee.wardId,
          toDepartment,
          toWardId: toWardId ? parseInt(toWardId) : null,
          effectiveDate: new Date(effectiveDate),
          reason: reason || 'Transfer',
          approvedBy: approvedBy || req.user.fullName,
          notes: notes || null,
        },
      });

      await tx.employee.update({
        where: { id: parseInt(employeeId) },
        data: {
          department: toDepartment,
          wardId: toWardId ? parseInt(toWardId) : null,
        },
      });

      return m;
    });

    req.app.locals.emit('employee:updated', { id: employee.id, name: employee.name });
    req.app.locals.emit('establishment:updated', { id: movement.id, type: 'transfer' });

    res.status(201).json(movement);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/retirement', requireAuth, requireHRorIT, async (req, res) => {
  const { employeeId, plannedDate, actualDate, pensionNotes, notes, approvedBy } = req.body;

  if (!employeeId) {
    return res.status(400).json({ error: 'employeeId is required' });
  }

  try {
    const employee = await prisma.employee.findUnique({ where: { id: parseInt(employeeId) } });
    if (!employee) return res.status(404).json({ error: 'Employee not found' });

    const endDate = actualDate ? new Date(actualDate) : (plannedDate ? new Date(plannedDate) : new Date());
    const yearsOfService = calcYearsOfService(employee.hireDate, endDate);

    const movement = await prisma.$transaction(async (tx) => {
      const m = await tx.employeeMovement.create({
        data: {
          employeeId: parseInt(employeeId),
          movementType: 'retirement',
          plannedDate: plannedDate ? new Date(plannedDate) : null,
          actualDate: actualDate ? new Date(actualDate) : null,
          yearsOfService,
          pensionNotes: pensionNotes || null,
          effectiveDate: actualDate ? new Date(actualDate) : null,
          notes: notes || null,
          approvedBy: approvedBy || req.user.fullName,
        },
      });

      if (actualDate) {
        await tx.employee.update({
          where: { id: parseInt(employeeId) },
          data: {
            status: 'retired',
            terminationDate: new Date(actualDate),
          },
        });
      }

      return m;
    });

    req.app.locals.emit('employee:updated', { id: employee.id, name: employee.name });
    req.app.locals.emit('establishment:updated', { id: movement.id, type: 'retirement' });

    res.status(201).json(movement);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/resignation', requireAuth, requireHRorIT, async (req, res) => {
  const {
    employeeId, resignationDate, lastWorkingDay,
    noticePeriodDays, reason, exitInterviewDone, eligibleForRehire,
    notes, approvedBy,
  } = req.body;

  if (!employeeId || !resignationDate || !lastWorkingDay) {
    return res.status(400).json({ error: 'employeeId, resignationDate, and lastWorkingDay are required' });
  }

  try {
    const employee = await prisma.employee.findUnique({ where: { id: parseInt(employeeId) } });
    if (!employee) return res.status(404).json({ error: 'Employee not found' });

    const movement = await prisma.$transaction(async (tx) => {
      const m = await tx.employeeMovement.create({
        data: {
          employeeId: parseInt(employeeId),
          movementType: 'resignation',
          resignationDate: new Date(resignationDate),
          lastWorkingDay: new Date(lastWorkingDay),
          noticePeriodDays: noticePeriodDays ? parseInt(noticePeriodDays) : null,
          reason: reason || null,
          exitInterviewDone: exitInterviewDone === true || exitInterviewDone === 'true',
          eligibleForRehire: eligibleForRehire === true || eligibleForRehire === 'true',
          effectiveDate: new Date(lastWorkingDay),
          notes: notes || null,
          approvedBy: approvedBy || req.user.fullName,
        },
      });

      if (new Date(lastWorkingDay) <= new Date()) {
        await tx.employee.update({
          where: { id: parseInt(employeeId) },
          data: {
            status: 'resigned',
            terminationDate: new Date(lastWorkingDay),
          },
        });
      }

      return m;
    });

    req.app.locals.emit('employee:updated', { id: employee.id, name: employee.name });
    req.app.locals.emit('establishment:updated', { id: movement.id, type: 'resignation' });

    res.status(201).json(movement);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.patch('/movements/:id', requireAuth, requireHRorIT, async (req, res) => {
  const id = parseInt(req.params.id);
  const { notes, plannedDate, actualDate, pensionNotes } = req.body;

  try {
    const existing = await prisma.employeeMovement.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Movement not found' });

    const updateData = {};
    if (notes !== undefined) updateData.notes = notes;
    if (plannedDate !== undefined) updateData.plannedDate = plannedDate ? new Date(plannedDate) : null;
    if (actualDate !== undefined) updateData.actualDate = actualDate ? new Date(actualDate) : null;
    if (pensionNotes !== undefined) updateData.pensionNotes = pensionNotes;

    const updated = await prisma.employeeMovement.update({
      where: { id },
      data: updateData,
    });

    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/summary', requireAuth, requireHRorIT, async (req, res) => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recent = await prisma.employeeMovement.findMany({
      where: { createdAt: { gte: thirtyDaysAgo } },
      select: { movementType: true },
    });

    const byType = { transfer: 0, retirement: 0, resignation: 0 };
    recent.forEach(m => { byType[m.movementType] = (byType[m.movementType] || 0) + 1; });

    const total = await prisma.employeeMovement.count();

    res.json({
      total,
      last30Days: recent.length,
      byType,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/targets', requireAuth, requireHRorIT, async (req, res) => {
  try {
    const targets = await prisma.establishmentTarget.findMany({
      orderBy: { department: 'asc' },
    });
    res.json(targets);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/targets/:department', requireAuth, requireHRorIT, async (req, res) => {
  const department = req.params.department;
  const { minHeadcount, maxHeadcount, notes } = req.body;

  if (minHeadcount === undefined) {
    return res.status(400).json({ error: 'minHeadcount is required' });
  }

  try {
    const target = await prisma.establishmentTarget.upsert({
      where: { department },
      update: {
        minHeadcount: parseInt(minHeadcount),
        maxHeadcount: maxHeadcount ? parseInt(maxHeadcount) : null,
        notes: notes || null,
        updatedBy: req.user.fullName,
      },
      create: {
        department,
        minHeadcount: parseInt(minHeadcount),
        maxHeadcount: maxHeadcount ? parseInt(maxHeadcount) : null,
        notes: notes || null,
        updatedBy: req.user.fullName,
      },
    });

    res.json(target);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/headcount', requireAuth, requireHRorIT, async (req, res) => {
  try {
    const departments = await prisma.employee.groupBy({
      by: ['department'],
      _count: true,
      where: { status: { in: ['active', 'on_leave', 'sick'] } },
    });

    const targets = await prisma.establishmentTarget.findMany();

    const map = {};
    departments.forEach(d => {
      map[d.department] = { department: d.department, current: d._count };
    });

    targets.forEach(t => {
      if (!map[t.department]) {
        map[t.department] = { department: t.department, current: 0 };
      }
      map[t.department].min = t.minHeadcount;
      map[t.department].max = t.maxHeadcount;
    });

    const list = Object.values(map).map(d => {
      let status = 'no_target';
      if (d.min !== undefined) {
        if (d.current < d.min) status = 'understaffed';
        else if (d.max && d.current > d.max) status = 'overstaffed';
        else status = 'adequate';
      }
      return { ...d, status };
    });

    list.sort((a, b) => a.department.localeCompare(b.department));

    res.json(list);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/headcount-public', async (req, res) => {
  try {
    const departments = await prisma.employee.groupBy({
      by: ['department'],
      _count: true,
      where: { status: { in: ['active', 'on_leave', 'sick'] } },
    });

    const targets = await prisma.establishmentTarget.findMany();

    const map = {};
    departments.forEach(d => {
      map[d.department] = { department: d.department, current: d._count };
    });

    targets.forEach(t => {
      if (!map[t.department]) {
        map[t.department] = { department: t.department, current: 0 };
      }
      map[t.department].min = t.minHeadcount;
      map[t.department].max = t.maxHeadcount;
    });

    const list = Object.values(map).map(d => {
      let status = 'no_target';
      if (d.min !== undefined) {
        if (d.current < d.min) status = 'understaffed';
        else if (d.max && d.current > d.max) status = 'overstaffed';
        else status = 'adequate';
      }
      return { department: d.department, current: d.current, min: d.min, max: d.max, status };
    });

    res.json(list);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Public summary for Live Board widget.
router.get('/summary-public', async (req, res) => {
  try {
    let from, to;
    if (req.query.from) {
      from = new Date(req.query.from);
      from.setHours(0, 0, 0, 0);
    } else {
      from = new Date();
      from.setHours(0, 0, 0, 0);
    }
    if (req.query.to) {
      to = new Date(req.query.to);
      to.setHours(23, 59, 59, 999);
    } else {
      to = new Date();
      to.setHours(23, 59, 59, 999);
    }

    const inRange = await prisma.employeeMovement.findMany({
      where: { createdAt: { gte: from, lte: to } },
      select: { movementType: true },
    });

    const byType = { transfer: 0, retirement: 0, resignation: 0 };
    inRange.forEach(m => { byType[m.movementType] = (byType[m.movementType] || 0) + 1; });

    const departments = await prisma.employee.groupBy({
      by: ['department'],
      _count: true,
      where: { status: { in: ['active', 'on_leave', 'sick'] } },
    });

    const targets = await prisma.establishmentTarget.findMany();
    const currentMap = {};
    departments.forEach(d => { currentMap[d.department] = d._count; });

    let understaffed = 0;
    let overstaffed = 0;
    targets.forEach(t => {
      const cur = currentMap[t.department] || 0;
      if (cur < t.minHeadcount) understaffed++;
      else if (t.maxHeadcount && cur > t.maxHeadcount) overstaffed++;
    });

    res.json({
      from: from.toISOString(),
      to: to.toISOString(),
      transfers: byType.transfer,
      retirements: byType.retirement,
      resignations: byType.resignation,
      total: inRange.length,
      understaffed,
      overstaffed,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Detail list for establishment widgets. Public. PII stripped.
router.get('/detail-public', async (req, res) => {
  try {
    const { category } = req.query;

    let from, to;
    if (req.query.from) {
      from = new Date(req.query.from);
      from.setHours(0, 0, 0, 0);
    } else {
      from = new Date();
      from.setHours(0, 0, 0, 0);
    }
    if (req.query.to) {
      to = new Date(req.query.to);
      to.setHours(23, 59, 59, 999);
    } else {
      to = new Date();
      to.setHours(23, 59, 59, 999);
    }

    const validCategories = ['transfer', 'retirement', 'resignation', 'understaffed', 'overstaffed'];
    if (!validCategories.includes(category)) {
      return res.status(400).json({ error: 'Invalid category' });
    }

    if (category === 'understaffed' || category === 'overstaffed') {
      const departments = await prisma.employee.groupBy({
        by: ['department'],
        _count: true,
        where: { status: { in: ['active', 'on_leave', 'sick'] } },
      });

      const targets = await prisma.establishmentTarget.findMany();

      const currentMap = {};
      departments.forEach(d => { currentMap[d.department] = d._count; });

      const list = targets
        .map(t => ({
          department: t.department,
          current: currentMap[t.department] || 0,
          min: t.minHeadcount,
          max: t.maxHeadcount,
        }))
        .filter(d => {
          if (category === 'understaffed') return d.current < d.min;
          if (category === 'overstaffed') return d.max && d.current > d.max;
          return false;
        });

      return res.json(list);
    }

    const movements = await prisma.employeeMovement.findMany({
      where: {
        movementType: category,
        createdAt: { gte: from, lte: to },
      },
      select: {
        id: true,
        movementType: true,
        fromDepartment: true,
        toDepartment: true,
        reason: true,
        effectiveDate: true,
        createdAt: true,
        employee: { select: { department: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    res.json(movements);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/metadata', requireAuth, requireHRorIT, (req, res) => {
  res.json({
    movementTypes: MOVEMENT_TYPES,
    resignationReasons: RESIGNATION_REASONS,
  });
});

module.exports = router;
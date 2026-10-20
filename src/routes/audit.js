const express = require('express');
const prisma = require('../prismaClient');
const { requireAuth, isSuperAdmin } = require('../auth');

const router = express.Router();

// ============================================================
// LIST audit log — Super Admin only, filterable, paginated
// ============================================================
router.get('/', requireAuth, async (req, res) => {
  if (!isSuperAdmin(req)) {
    return res.status(403).json({ error: 'Super Admin only' });
  }

  try {
    const {
      search, username, department, action, entity,
      from, to, page = 1, pageSize = 100,
    } = req.query;

    const take = Math.min(parseInt(pageSize) || 100, 500);
    const skip = ((parseInt(page) || 1) - 1) * take;

    const where = {};

    if (username)   where.username   = username;
    if (department) where.department = department;
    if (action)     where.action     = action;
    if (entity)     where.entity     = entity;

    if (from || to) {
      where.timestamp = {};
      if (from) where.timestamp.gte = new Date(from);
      if (to) {
        const toDate = new Date(to);
        toDate.setHours(23, 59, 59, 999);
        where.timestamp.lte = toDate;
      }
    }

    if (search) {
      where.OR = [
        { summary:    { contains: search } },
        { username:   { contains: search } },
        { fullName:   { contains: search } },
        { entityId:   { contains: search } },
        { ipAddress:  { contains: search } },
      ];
    }

    const [rows, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        take,
        skip,
      }),
      prisma.auditLog.count({ where }),
    ]);

    res.json({
      rows,
      total,
      page:     parseInt(page) || 1,
      pageSize: take,
      pages:    Math.ceil(total / take) || 1,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================================
// DISTINCT filter values (for dropdowns)
// ============================================================
router.get('/filters', requireAuth, async (req, res) => {
  if (!isSuperAdmin(req)) {
    return res.status(403).json({ error: 'Super Admin only' });
  }

  try {
    const [actions, entities, users, depts] = await Promise.all([
      prisma.auditLog.findMany({ distinct: ['action'],     select: { action: true } }),
      prisma.auditLog.findMany({ distinct: ['entity'],     select: { entity: true } }),
      prisma.auditLog.findMany({ distinct: ['username'],   select: { username: true, fullName: true } }),
      prisma.auditLog.findMany({ distinct: ['department'], select: { department: true } }),
    ]);

    res.json({
      actions:     actions.map(a => a.action).filter(Boolean).sort(),
      entities:    entities.map(e => e.entity).filter(Boolean).sort(),
      users:       users.filter(u => u.username),
      departments: depts.map(d => d.department).filter(Boolean).sort(),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================================
// CSV EXPORT — Super Admin only
// ============================================================
router.get('/export', requireAuth, async (req, res) => {
  if (!isSuperAdmin(req)) {
    return res.status(403).json({ error: 'Super Admin only' });
  }

  try {
    const { search, username, department, action, entity, from, to } = req.query;

    const where = {};
    if (username)   where.username   = username;
    if (department) where.department = department;
    if (action)     where.action     = action;
    if (entity)     where.entity     = entity;

    if (from || to) {
      where.timestamp = {};
      if (from) where.timestamp.gte = new Date(from);
      if (to) {
        const toDate = new Date(to);
        toDate.setHours(23, 59, 59, 999);
        where.timestamp.lte = toDate;
      }
    }

    if (search) {
      where.OR = [
        { summary:   { contains: search } },
        { username:  { contains: search } },
        { fullName:  { contains: search } },
        { entityId:  { contains: search } },
      ];
    }

    const rows = await prisma.auditLog.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: 10000,
    });

    const esc = (v) => '"' + String(v ?? '').replace(/"/g, '""') + '"';
    const header = ['Timestamp','User','Full Name','Department','Role','Action','Entity','Entity ID','Summary','IP','Device','Before','After'].join(',');
    const lines = rows.map(r => [
      esc(r.timestamp.toISOString()),
      esc(r.username),
      esc(r.fullName),
      esc(r.department),
      esc(r.role),
      esc(r.action),
      esc(r.entity),
      esc(r.entityId || ''),
      esc(r.summary),
      esc(r.ipAddress || ''),
      esc(r.deviceTag || ''),
      esc(r.before || ''),
      esc(r.after || ''),
    ].join(','));

    const csv = [header].concat(lines).join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="audit-' + new Date().toISOString().split('T')[0] + '.csv"');
    res.send(csv);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;

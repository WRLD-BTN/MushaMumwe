const express = require('express');
const prisma = require('../prismaClient');
const { requireAuth, canonicalDept, isITOrSuperAdmin } = require('../auth');

const router = express.Router();

const VALID_STATUSES = ['ongoing', 'pending', 'completed'];

// Status rules:
// ongoing   - note required (what's happening)
// pending   - note and obstacleReason required
// completed - note required
function validateStatusUpdate(status, note, obstacleReason) {
  if (!VALID_STATUSES.includes(status)) {
    return 'Invalid status. Allowed: ' + VALID_STATUSES.join(', ');
  }
  if (!note || !note.trim()) {
    return 'A note describing the current state is required';
  }
  if (status === 'pending' && (!obstacleReason || !obstacleReason.trim())) {
    return 'Obstacle reason is required when status is pending';
  }
  return null;
}

router.get('/', requireAuth, async (req, res) => {
  try {
    const { search, status, department, scope } = req.query;

    const where = {};
    if (status && status !== 'all') where.status = status;

    if (scope === 'own') {
      where.department = canonicalDept(req.user.department);
    } else if (department && department !== 'all') {
      where.department = canonicalDept(department);
    }

    let projects = await prisma.project.findMany({
      where,
      include: {
        updates: { orderBy: { timestamp: 'desc' }, take: 3 },
      },
      orderBy: { updatedAt: 'desc' },
    });

    if (search) {
      const q = search.toLowerCase();
      projects = projects.filter(p =>
        String(p.name || '').toLowerCase().includes(q) ||
        String(p.description || '').toLowerCase().includes(q) ||
        String(p.projectHead || '').toLowerCase().includes(q) ||
        String(p.department || '').toLowerCase().includes(q)
      );
    }

    res.json(projects);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/summary', requireAuth, async (req, res) => {
  try {
    const all = await prisma.project.findMany({
      select: { status: true, department: true, updatedAt: true },
    });

    const byStatus = { ongoing: 0, pending: 0, completed: 0 };
    all.forEach(p => { byStatus[p.status] = (byStatus[p.status] || 0) + 1; });

    const byDept = {};
    all.forEach(p => {
      byDept[p.department] = (byDept[p.department] || 0) + 1;
    });

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recent = all.filter(p => new Date(p.updatedAt) >= thirtyDaysAgo).length;

    res.json({
      total: all.length,
      byStatus,
      byDepartment: byDept,
      last30Days: recent,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Public summary for Live Board widget. No auth.
// byStatus is global. recent returns 10 most recently updated with obstacle reasons.
// blocked returns all pending projects with their obstacle reasons.
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

    const recentProjects = await prisma.project.findMany({
      select: {
        id: true,
        name: true,
        status: true,
        department: true,
        projectHead: true,
        obstacleReason: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: 'desc' },
      take: 10,
    });

    const blockedProjects = await prisma.project.findMany({
      where: { status: 'pending' },
      select: {
        id: true,
        name: true,
        department: true,
        projectHead: true,
        obstacleReason: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: 'desc' },
    });

    const all = await prisma.project.findMany({
      select: { status: true },
    });

    const byStatus = { ongoing: 0, pending: 0, completed: 0 };
    all.forEach(p => { byStatus[p.status] = (byStatus[p.status] || 0) + 1; });

    res.json({
      from: from.toISOString(),
      to: to.toISOString(),
      total: recentProjects.length,
      byStatus,
      recent: recentProjects,
      blocked: blockedProjects,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Detail list for a single project status. Public. PII stripped.
// Includes obstacleReason and projectHead. No date filter.
router.get('/detail-public', async (req, res) => {
  try {
    const { category } = req.query;

    const validCategories = ['ongoing', 'pending', 'completed'];
    if (!validCategories.includes(category)) {
      return res.status(400).json({ error: 'Invalid category' });
    }

    const projects = await prisma.project.findMany({
      where: { status: category },
      select: {
        id: true,
        name: true,
        department: true,
        projectHead: true,
        status: true,
        obstacleReason: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: 'desc' },
      take: 200,
    });

    res.json(projects);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/:id', requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        updates: { orderBy: { timestamp: 'desc' } },
      },
    });
    if (!project) return res.status(404).json({ error: 'Project not found' });
    res.json(project);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/', requireAuth, async (req, res) => {
  const {
    name,
    description,
    projectHead,
    status,
    startDate,
    targetDate,
    note,
    obstacleReason,
  } = req.body;

  if (!name || !description || !projectHead) {
    return res.status(400).json({
      error: 'name, description, and projectHead are required',
    });
  }

  const finalStatus = status || 'ongoing';
  const finalNote = note && note.trim() ? note : 'Project created';
  const validationError = validateStatusUpdate(finalStatus, finalNote, obstacleReason);
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }

  try {
    // Anti-duplicate check: Look for an identical project created in the last 5 seconds
    const recentDuplicate = await prisma.project.findFirst({
      where: {
        name: name,
        department: canonicalDept(req.user.department),
        createdAt: { gte: new Date(Date.now() - 5000) }
      }
    });

    if (recentDuplicate) {
      return res.status(400).json({ error: 'This project was just created. Please check the list before trying again.' });
    }

    const project = await prisma.project.create({
      data: {
        name,
        description,
        department: canonicalDept(req.user.department),
        projectHead,
        status: finalStatus,
        startDate: startDate ? new Date(startDate) : null,
        targetDate: targetDate ? new Date(targetDate) : null,
        obstacleReason: finalStatus === 'pending' ? obstacleReason : null,
        createdBy: req.user.fullName,
      },
    });

    await prisma.projectUpdate.create({
      data: {
        projectId: project.id,
        note: finalNote,
        statusAtUpdate: finalStatus,
        obstacleReason: finalStatus === 'pending' ? obstacleReason : null,
        updatedBy: req.user.fullName,
      },
    });

    req.app.locals.emit('project:created', { id: project.id, department: project.department });
    req.app.locals.emit('project:updated', { id: project.id, department: project.department });

    res.status(201).json(project);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/:id/updates', requireAuth, async (req, res) => {
  const id = parseInt(req.params.id);
  const { note, status, obstacleReason, actionTaken } = req.body;

  try {
    const project = await prisma.project.findUnique({ where: { id } });
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const userDept = canonicalDept(req.user.department);
    if (userDept !== project.department && !isITOrSuperAdmin(req)) {
      return res.status(403).json({
        error: 'Only the owning department can update this project',
      });
    }

    const finalStatus = status || project.status;
    const validationError = validateStatusUpdate(finalStatus, note, obstacleReason);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const update = await prisma.projectUpdate.create({
      data: {
        projectId: id,
        note,
        statusAtUpdate: finalStatus,
        obstacleReason: finalStatus === 'pending' ? obstacleReason : null,
        actionTaken: actionTaken || null,
        updatedBy: req.user.fullName,
      },
    });

    await prisma.project.update({
      where: { id },
      data: {
        status: finalStatus,
        obstacleReason: finalStatus === 'pending' ? obstacleReason : null,
        updatedAt: new Date(),
      },
    });

    req.app.locals.emit('project:updated', { id: project.id, department: project.department });

    res.status(201).json(update);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/:id', requireAuth, async (req, res) => {
  if (!isITOrSuperAdmin(req)) {
    return res.status(403).json({ error: 'Only IT can delete projects' });
  }

  const id = parseInt(req.params.id);

  try {
    const project = await prisma.project.findUnique({ where: { id } });
    if (!project) return res.status(404).json({ error: 'Project not found' });

    await prisma.projectUpdate.deleteMany({ where: { projectId: id } });
    await prisma.project.delete({ where: { id } });

    req.app.locals.emit('project:deleted', { id, department: project.department });

    res.json({ message: 'Project deleted' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
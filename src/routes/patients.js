const express = require('express');
const prisma = require('../prismaClient');
const { requireAuth, requireDepartment } = require('../auth');

const router = express.Router();

const VALID_STATUSES = ['admitted', 'treatment', 'in_treatment', 'discharged', 'deceased'];

function normalizeStatus(s) {
  if (s === 'in_treatment') return 'treatment';
  return s;
}

// ============================================================
// LIST patients (auth required — full record for entry portal)
// Supports ?status= &ward= &search=
// ============================================================
router.get('/', requireAuth, async (req, res) => {
  try {
    const { status, ward, search } = req.query;
    const where = {};
    if (status) where.status = normalizeStatus(status);
    if (ward) where.wardId = Number(ward);
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { nationalId: { contains: search } },
      ];
    }

    const patients = await prisma.patient.findMany({
      where,
      include: { ward: true },
      orderBy: { updatedAt: 'desc' },
    });
    res.json(patients);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================================
// BOARD — PUBLIC (no auth) — PII-stripped feed for the shared screen
// Returns: id, status, updatedAt, ward.name — NO name / DOB / nationalId
// ============================================================
router.get('/board', async (req, res) => {
  try {
    const patients = await prisma.patient.findMany({
      select: {
        id: true,
        status: true,
        updatedAt: true,
        ward: { select: { name: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
    res.json(patients);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================================
// SUMMARY — PUBLIC (no auth) — counts + percentages for the header
// ============================================================
router.get('/summary', async (req, res) => {
  try {
    const statuses = ['admitted', 'treatment', 'discharged', 'deceased'];
    const counts = {};
    for (const s of statuses) {
      counts[s] = await prisma.patient.count({ where: { status: s } });
    }
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    const percentages = {};
    for (const s of statuses) {
      percentages[s] = total === 0 ? 0 : +((counts[s] / total) * 100).toFixed(1);
    }
    res.json({ counts, percentages, total });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================================
// CREATE patient (Nurses + IT only)
// ============================================================
router.post('/', requireAuth, requireDepartment(['nurses', 'it']), async (req, res) => {
  const { name, nationalId, wardId, status, gender } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });

  const finalStatus = normalizeStatus(status || 'admitted');
  if (!VALID_STATUSES.includes(finalStatus)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  try {
    const patient = await prisma.patient.create({
      data: {
        name,
        nationalId: nationalId || undefined,
        gender: gender || undefined,
        wardId: wardId ? parseInt(wardId) : undefined,
        status: finalStatus,
      },
      include: { ward: true },
    });

    await prisma.statusLog.create({
      data: {
        patientId: patient.id,
        oldStatus: '—',
        newStatus: patient.status,
        changedBy: req.user.username,
      },
    });

    req.app.locals.emit('patient:created', { id: patient.id, status: patient.status });

    res.status(201).json(patient);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================================
// UPDATE status — accepts `status` or `newStatus` in body
// ============================================================
router.patch('/:id/status', requireAuth, requireDepartment(['nurses', 'it']), async (req, res) => {
  const id = Number(req.params.id);
  const raw = req.body.status || req.body.newStatus;
  const newStatus = normalizeStatus(raw);

  if (!VALID_STATUSES.includes(newStatus)) {
    return res.status(400).json({ error: `Invalid status. Allowed: ${VALID_STATUSES.join(', ')}` });
  }

  try {
    const existing = await prisma.patient.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Patient not found' });

    const updated = await prisma.$transaction(async (tx) => {
      const p = await tx.patient.update({
        where: { id },
        data: { status: newStatus },
        include: { ward: true },
      });
      await tx.statusLog.create({
        data: {
          patientId: id,
          oldStatus: existing.status,
          newStatus,
          changedBy: req.user.username,
        },
      });
      return p;
    });

    req.app.locals.emit('patient:updated', { id: updated.id, status: updated.status });

    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================================
// GET single patient (with status history)
// ============================================================
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const patient = await prisma.patient.findUnique({
      where: { id: Number(req.params.id) },
      include: {
        ward: true,
        statusLogs: { orderBy: { timestamp: 'desc' } },
      },
    });
    if (!patient) return res.status(404).json({ error: 'Not found' });
    res.json(patient);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
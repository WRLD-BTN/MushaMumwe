const express = require('express');
const prisma = require('../prismaClient');
const { requireAuth, requireDepartment, isSuperAdmin } = require('../auth');

const router = express.Router();

const VALID_STATUSES = ['admitted', 'treatment', 'in_treatment', 'discharged', 'deceased'];

function normalizeStatus(s) {
  if (s === 'in_treatment') return 'treatment';
  return s;
}

router.get('/', requireAuth, async (req, res) => {
  try {
    const { search, status, ward, diagnosis, from, to } = req.query;
    const where = {};

    if (status && status !== 'all') where.status = normalizeStatus(status);
    if (ward && ward !== 'all') where.wardId = Number(ward);
    if (diagnosis) where.diagnosis = { contains: diagnosis };
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { nationalId: { contains: search } },
        { phone: { contains: search } },
        { diagnosis: { contains: search } },
        { symptoms: { contains: search } },
        { causeOfDeath: { contains: search } },
      ];
    }
    if (from) where.admissionDate = { gte: new Date(from) };
    if (to) {
      const toDate = new Date(to);
      toDate.setHours(23, 59, 59, 999);
      where.admissionDate = { ...(where.admissionDate || {}), lte: toDate };
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

router.get('/board', async (req, res) => {
  try {
    const patients = await prisma.patient.findMany({
      select: {
        id: true, status: true, updatedAt: true,
        ward: { select: { name: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
    res.json(patients);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

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

router.get('/discharges', requireAuth, async (req, res) => {
  try {
    const { search, outcome, ward, from, to } = req.query;
    const where = { status: 'discharged' };

    if (outcome && outcome !== 'all') where.outcome = outcome;
    if (ward && ward !== 'all') where.wardId = Number(ward);
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { nationalId: { contains: search } },
        { finalDiagnosis: { contains: search } },
        { diagnosis: { contains: search } },
      ];
    }
    if (from) where.dischargeDate = { gte: new Date(from) };
    if (to) {
      const toDate = new Date(to);
      toDate.setHours(23, 59, 59, 999);
      where.dischargeDate = { ...(where.dischargeDate || {}), lte: toDate };
    }

    const records = await prisma.patient.findMany({
      where,
      include: { ward: true },
      orderBy: { dischargeDate: 'desc' },
    });
    res.json(records);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/discharges/export', requireAuth, async (req, res) => {
  try {
    const { search, outcome, ward, from, to } = req.query;
    const where = { status: 'discharged' };

    if (outcome && outcome !== 'all') where.outcome = outcome;
    if (ward && ward !== 'all') where.wardId = Number(ward);
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { nationalId: { contains: search } },
        { finalDiagnosis: { contains: search } },
      ];
    }
    if (from) where.dischargeDate = { gte: new Date(from) };
    if (to) {
      const toDate = new Date(to);
      toDate.setHours(23, 59, 59, 999);
      where.dischargeDate = { ...(where.dischargeDate || {}), lte: toDate };
    }

    const records = await prisma.patient.findMany({
      where, include: { ward: true }, orderBy: { dischargeDate: 'desc' },
    });

    const escape = (v) => '"' + String(v ?? '').replace(/"/g, '""') + '"';
    const lines = [
      '# Sally Mugabe Central Hospital - Discharge Records',
      '# Generated: ' + new Date().toISOString(),
      '# Filters: outcome=' + (outcome || 'all') + ' ward=' + (ward || 'all') + ' search=' + (search || 'none'),
      '# Total: ' + records.length,
      '',
      ['ID','Name','Ward','Diagnosis','Final Diagnosis','Outcome','Discharged','Review Date','By'].join(','),
    ];
    const rows = records.map(r => [
      r.id, escape(r.name), escape(r.ward?.name || ''), escape(r.diagnosis || ''),
      escape(r.finalDiagnosis || ''), escape(r.outcome || ''),
      escape(r.dischargeDate ? r.dischargeDate.toISOString() : ''),
      escape(r.nextReviewDate ? r.nextReviewDate.toISOString() : ''),
      escape(r.dischargedBy || ''),
    ].join(','));

    const csv = lines.concat(rows).join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="discharges-' + new Date().toISOString().split('T')[0] + '.csv"');
    res.send(csv);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/export', requireAuth, async (req, res) => {
  try {
    const { search, status, ward, diagnosis, from, to } = req.query;
    const where = {};

    if (status && status !== 'all') where.status = normalizeStatus(status);
    if (ward && ward !== 'all') where.wardId = Number(ward);
    if (diagnosis) where.diagnosis = { contains: diagnosis };
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { nationalId: { contains: search } },
        { phone: { contains: search } },
        { diagnosis: { contains: search } },
      ];
    }
    if (from) where.admissionDate = { gte: new Date(from) };
    if (to) {
      const toDate = new Date(to);
      toDate.setHours(23, 59, 59, 999);
      where.admissionDate = { ...(where.admissionDate || {}), lte: toDate };
    }

    const patients = await prisma.patient.findMany({
      where, include: { ward: true }, orderBy: { admissionDate: 'desc' },
    });

    const escape = (v) => '"' + String(v ?? '').replace(/"/g, '""') + '"';
    const lines = [
      '# Sally Mugabe Central Hospital - Patient Report',
      '# Generated: ' + new Date().toISOString(),
      '# Filters: status=' + (status || 'all') + ' ward=' + (ward || 'all') + ' search=' + (search || 'none'),
      '# Total: ' + patients.length,
      '',
      ['ID','Name','Gender','Ward','Diagnosis','Status','Admitted','Discharged','Outcome'].join(','),
    ];
    const rows = patients.map(p => [
      p.id, escape(p.name), escape(p.gender || ''), escape(p.ward?.name || ''),
      escape(p.diagnosis || ''), escape(p.status),
      escape(p.admissionDate.toISOString()),
      escape(p.dischargeDate ? p.dischargeDate.toISOString() : ''),
      escape(p.outcome || ''),
    ].join(','));

    const csv = lines.concat(rows).join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="patients-' + new Date().toISOString().split('T')[0] + '.csv"');
    res.send(csv);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/', requireAuth, async (req, res) => {
  if (!isSuperAdmin(req) && !['nurses', 'it'].includes(String(req.user.department).toLowerCase())) {
    return res.status(403).json({ error: 'Not authorized' });
  }

  const { name, nationalId, wardId, status, gender, diagnosis, symptoms, phone, bloodGroup } = req.body;
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
        diagnosis: diagnosis || undefined,
        symptoms: symptoms || undefined,
        phone: phone || undefined,
        bloodGroup: bloodGroup || undefined,
      },
      include: { ward: true },
    });

    await prisma.statusLog.create({
      data: {
        patientId: patient.id,
        oldStatus: 'new',
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

router.patch('/:id/status', requireAuth, async (req, res) => {
  if (!isSuperAdmin(req) && !['nurses', 'it'].includes(String(req.user.department).toLowerCase())) {
    return res.status(403).json({ error: 'Not authorized' });
  }

  const id = Number(req.params.id);
  const raw = req.body.status || req.body.newStatus;
  const newStatus = normalizeStatus(raw);
  const { causeOfDeath } = req.body;

  if (!VALID_STATUSES.includes(newStatus)) {
    return res.status(400).json({ error: 'Invalid status. Allowed: ' + VALID_STATUSES.join(', ') });
  }

  try {
    const existing = await prisma.patient.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Patient not found' });

    const updateData = { status: newStatus };
    if (newStatus === 'deceased' && causeOfDeath) updateData.causeOfDeath = causeOfDeath;

    const updated = await prisma.$transaction(async (tx) => {
      const p = await tx.patient.update({
        where: { id },
        data: updateData,
        include: { ward: true },
      });
      await tx.statusLog.create({
        data: { patientId: id, oldStatus: existing.status, newStatus, changedBy: req.user.username },
      });
      return p;
    });

    req.app.locals.emit('patient:updated', { id: updated.id, status: updated.status });
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.patch('/:id/discharge', requireAuth, async (req, res) => {
  if (!isSuperAdmin(req) && !['nurses', 'it'].includes(String(req.user.department).toLowerCase())) {
    return res.status(403).json({ error: 'Not authorized' });
  }

  const id = Number(req.params.id);
  const {
    finalDiagnosis, treatmentSummary, outcome, dischargeNotes,
    nextReviewDate, reviewDepartment, patientInstructions,
  } = req.body;

  if (!finalDiagnosis) {
    return res.status(400).json({ error: 'Final diagnosis is required' });
  }

  try {
    const existing = await prisma.patient.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Patient not found' });
    if (existing.status === 'discharged') {
      return res.status(400).json({ error: 'Patient already discharged' });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const p = await tx.patient.update({
        where: { id },
        data: {
          status: 'discharged',
          finalDiagnosis,
          treatmentSummary: treatmentSummary || null,
          outcome: outcome || 'Recovered',
          dischargeNotes: dischargeNotes || null,
          dischargeDate: new Date(),
          dischargedBy: req.user.fullName,
          nextReviewDate: nextReviewDate ? new Date(nextReviewDate) : null,
          reviewDepartment: reviewDepartment || null,
          patientInstructions: patientInstructions || null,
        },
        include: { ward: true },
      });
      await tx.statusLog.create({
        data: { patientId: id, oldStatus: existing.status, newStatus: 'discharged', changedBy: req.user.username },
      });
      return p;
    });

    req.app.locals.emit('patient:updated', { id: updated.id, status: 'discharged' });
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/:id', requireAuth, async (req, res) => {
  try {
    const patient = await prisma.patient.findUnique({
      where: { id: Number(req.params.id) },
      include: { ward: true, statusLogs: { orderBy: { timestamp: 'desc' } } },
    });
    if (!patient) return res.status(404).json({ error: 'Not found' });
    res.json(patient);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
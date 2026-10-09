const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const prisma = require('../prismaClient');
const { requireAuth, isITOrSuperAdmin } = require('../auth');

const router = express.Router();

// ============================================================
// CONFIG
// ============================================================
const UPLOAD_DIR = path.join(__dirname, '..', '..', 'public', 'uploads', 'disciplinary');
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_FILES_PER_CASE = 5;
const ALLOWED_MIMES = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const caseId = req.params.id || 'case';
    const ts = Date.now();
    const rand = Math.random().toString(36).substring(2, 8);
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, 'case-' + caseId + '-' + ts + '-' + rand + ext);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIMES.includes(file.mimetype)) {
      return cb(new Error('Only PDF, JPG, JPEG, PNG files allowed'));
    }
    cb(null, true);
  },
});

// ============================================================
// AUTH GUARD
// ============================================================
function requireHRorIT(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  const dept = String(req.user.department || '').toLowerCase();
  if (dept !== 'hr' && dept !== 'it' && dept !== 'superadmin') {
    return res.status(403).json({ error: 'Only HR and IT can access labour relations' });
  }
  next();
}

// ============================================================
// CONSTANTS
// ============================================================
const VALID_STATUSES = ['open', 'under_investigation', 'resolved', 'dismissed'];
const VALID_OFFENSES = [
  'Absenteeism', 'Late arrival', 'Insubordination', 'Negligence', 'Misconduct',
  'Theft', 'Substance abuse', 'Harassment', 'Patient mistreatment',
  'Breach of confidentiality', 'Falsification of records', 'Other',
];
const VALID_ACTIONS = [
  'Verbal warning', 'Written warning', 'Final written warning',
  'Suspension', 'Demotion', 'Termination', 'Reinstatement',
  'No action', 'Counselling', 'Referred to authority',
];

// ============================================================
// HELPERS
// ============================================================
async function generateCaseNumber() {
  const year = new Date().getFullYear();
  const prefix = 'DISC-' + year + '-';
  const latest = await prisma.disciplinaryCase.findFirst({
    where: { caseNumber: { startsWith: prefix } },
    orderBy: { caseNumber: 'desc' },
  });

  let nextSeq = 1;
  if (latest) {
    const parts = latest.caseNumber.split('-');
    const lastSeq = parseInt(parts[2], 10);
    if (!isNaN(lastSeq)) nextSeq = lastSeq + 1;
  }

  return prefix + String(nextSeq).padStart(4, '0');
}

// ============================================================
// PUBLIC SUMMARY - Live Board widget (NO AUTH)
// Returns counts + 5 most recent cases (anonymised)
// ============================================================
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

    const search = (req.query.search || '').toLowerCase();

    const casesInRange = await prisma.disciplinaryCase.findMany({
      where: {
        reportedDate: { gte: from, lte: to },
      },
      select: {
        id: true,
        caseNumber: true,
        offenseType: true,
        status: true,
        reportedDate: true,
        description: true,
      },
      orderBy: { reportedDate: 'desc' },
    });

    let filtered = casesInRange;
    if (search) {
      filtered = casesInRange.filter(c =>
        String(c.caseNumber || '').toLowerCase().includes(search) ||
        String(c.offenseType || '').toLowerCase().includes(search) ||
        String(c.description || '').toLowerCase().includes(search)
      );
    }

    const byStatus = { open: 0, under_investigation: 0, resolved: 0, dismissed: 0 };
    filtered.forEach(c => { byStatus[c.status] = (byStatus[c.status] || 0) + 1; });

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const last30Days = casesInRange.filter(c => new Date(c.reportedDate) >= thirtyDaysAgo).length;

    const recent = filtered.slice(0, 5).map(c => ({
      id: c.id,
      caseNumber: c.caseNumber,
      offenseType: c.offenseType,
      status: c.status,
      reportedDate: c.reportedDate,
    }));

    res.json({
      from: from.toISOString(),
      to: to.toISOString(),
      total: filtered.length,
      byStatus,
      last30Days,
      recent,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================================
// METADATA
// ============================================================
router.get('/metadata', requireAuth, requireHRorIT, (req, res) => {
  res.json({
    offenses: VALID_OFFENSES,
    actions: VALID_ACTIONS,
    statuses: VALID_STATUSES,
  });
});

// ============================================================
// LIST
// ============================================================
router.get('/', requireAuth, requireHRorIT, async (req, res) => {
  try {
    const { search, status, offense, department, from, to } = req.query;

    const where = {};
    if (status && status !== 'all') where.status = status;
    if (offense && offense !== 'all') where.offenseType = offense;

    if (from || to) {
      where.reportedDate = {};
      if (from) where.reportedDate.gte = new Date(from);
      if (to) {
        const toDate = new Date(to);
        toDate.setHours(23, 59, 59, 999);
        where.reportedDate.lte = toDate;
      }
    }

    if (department && department !== 'all') {
      where.employee = { department };
    }

    if (search) {
      const q = search;
      where.OR = [
        { caseNumber: { contains: q } },
        { offenseType: { contains: q } },
        { description: { contains: q } },
        { reportedBy: { contains: q } },
        { employee: { name: { contains: q } } },
        { employee: { department: { contains: q } } },
      ];
    }

    const cases = await prisma.disciplinaryCase.findMany({
      where,
      include: {
        employee: { select: { id: true, name: true, department: true, role: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(cases);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================================
// SUMMARY (auth)
// ============================================================
router.get('/summary', requireAuth, requireHRorIT, async (req, res) => {
  try {
    const all = await prisma.disciplinaryCase.findMany({
      select: { status: true, offenseType: true, reportedDate: true },
    });

    const byStatus = { open: 0, under_investigation: 0, resolved: 0, dismissed: 0 };
    all.forEach(c => { byStatus[c.status] = (byStatus[c.status] || 0) + 1; });

    const byOffense = {};
    all.forEach(c => {
      byOffense[c.offenseType] = (byOffense[c.offenseType] || 0) + 1;
    });

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentCount = all.filter(c => new Date(c.reportedDate) >= thirtyDaysAgo).length;

    res.json({
      total: all.length,
      byStatus,
      byOffense,
      last30Days: recentCount,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================================
// GET ONE
// ============================================================
router.get('/:id', requireAuth, requireHRorIT, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const record = await prisma.disciplinaryCase.findUnique({
      where: { id },
      include: {
        employee: { select: { id: true, name: true, department: true, role: true, status: true } },
        statusLogs: { orderBy: { timestamp: 'desc' } },
        attachments: { orderBy: { uploadedAt: 'desc' } },
      },
    });
    if (!record) return res.status(404).json({ error: 'Case not found' });
    res.json(record);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================================
// CREATE
// ============================================================
router.post('/', requireAuth, requireHRorIT, async (req, res) => {
  const {
    employeeId,
    offenseType,
    description,
    reportedBy,
    reportedDate,
    witnesses,
  } = req.body;

  if (!employeeId || !offenseType || !description || !reportedBy || !reportedDate) {
    return res.status(400).json({
      error: 'employeeId, offenseType, description, reportedBy, and reportedDate are required',
    });
  }

  if (!VALID_OFFENSES.includes(offenseType)) {
    return res.status(400).json({ error: 'Invalid offense type' });
  }

  try {
    const employee = await prisma.employee.findUnique({ where: { id: parseInt(employeeId) } });
    if (!employee) return res.status(404).json({ error: 'Employee not found' });

    const caseNumber = await generateCaseNumber();

    const record = await prisma.disciplinaryCase.create({
      data: {
        caseNumber,
        employeeId: parseInt(employeeId),
        offenseType,
        description,
        reportedBy,
        reportedDate: new Date(reportedDate),
        witnesses: witnesses || null,
        status: 'open',
      },
    });

    await prisma.disciplinaryStatusLog.create({
      data: {
        caseId: record.id,
        oldStatus: 'new',
        newStatus: 'open',
        changedBy: req.user.fullName,
        notes: 'Case filed',
      },
    });

    req.app.locals.emit('disciplinary:created', { id: record.id, caseNumber: record.caseNumber });

    res.status(201).json(record);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================================
// UPDATE
// ============================================================
router.patch('/:id', requireAuth, requireHRorIT, async (req, res) => {
  const id = parseInt(req.params.id);
  const {
    offenseType, description, reportedBy, reportedDate, witnesses,
    actionTaken, actionDetails, outcome,
    hearingDate, hearingNotes, effectiveDate, durationDays,
  } = req.body;

  try {
    const existing = await prisma.disciplinaryCase.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Case not found' });

    if (existing.status === 'resolved' || existing.status === 'dismissed') {
      return res.status(400).json({ error: 'Cannot edit a closed case. Reopen it first.' });
    }

    if (offenseType && !VALID_OFFENSES.includes(offenseType)) {
      return res.status(400).json({ error: 'Invalid offense type' });
    }
    if (actionTaken && !VALID_ACTIONS.includes(actionTaken)) {
      return res.status(400).json({ error: 'Invalid action type' });
    }

    const updateData = {};
    if (offenseType !== undefined) updateData.offenseType = offenseType;
    if (description !== undefined) updateData.description = description;
    if (reportedBy !== undefined) updateData.reportedBy = reportedBy;
    if (reportedDate !== undefined) updateData.reportedDate = new Date(reportedDate);
    if (witnesses !== undefined) updateData.witnesses = witnesses || null;
    if (actionTaken !== undefined) updateData.actionTaken = actionTaken || null;
    if (actionDetails !== undefined) updateData.actionDetails = actionDetails || null;
    if (outcome !== undefined) updateData.outcome = outcome || null;
    if (hearingDate !== undefined) updateData.hearingDate = hearingDate ? new Date(hearingDate) : null;
    if (hearingNotes !== undefined) updateData.hearingNotes = hearingNotes || null;
    if (effectiveDate !== undefined) updateData.effectiveDate = effectiveDate ? new Date(effectiveDate) : null;
    if (durationDays !== undefined) updateData.durationDays = durationDays ? parseInt(durationDays) : null;

    const updated = await prisma.disciplinaryCase.update({ where: { id }, data: updateData });
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================================
// STATUS CHANGE
// ============================================================
router.patch('/:id/status', requireAuth, requireHRorIT, async (req, res) => {
  const id = parseInt(req.params.id);
  const { newStatus, notes } = req.body;

  if (!VALID_STATUSES.includes(newStatus)) {
    return res.status(400).json({ error: 'Invalid status. Allowed: ' + VALID_STATUSES.join(', ') });
  }

  try {
    const existing = await prisma.disciplinaryCase.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Case not found' });

    const updateData = { status: newStatus };
    if (newStatus === 'resolved' || newStatus === 'dismissed') {
      updateData.closedBy = req.user.fullName;
      updateData.closedDate = new Date();
    }

    const updated = await prisma.disciplinaryCase.update({ where: { id }, data: updateData });

    await prisma.disciplinaryStatusLog.create({
      data: {
        caseId: id,
        oldStatus: existing.status,
        newStatus,
        changedBy: req.user.fullName,
        notes: notes || null,
      },
    });

    req.app.locals.emit('disciplinary:updated', { id: updated.id, status: updated.status });

    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================================
// REOPEN
// ============================================================
router.post('/:id/reopen', requireAuth, requireHRorIT, async (req, res) => {
  const id = parseInt(req.params.id);
  const { reason, newStatus } = req.body;

  if (!reason) {
    return res.status(400).json({ error: 'Reason for reopening is required' });
  }

  const targetStatus = newStatus || 'under_investigation';
  if (!VALID_STATUSES.includes(targetStatus)) {
    return res.status(400).json({ error: 'Invalid target status' });
  }

  try {
    const existing = await prisma.disciplinaryCase.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Case not found' });

    if (existing.status !== 'resolved' && existing.status !== 'dismissed') {
      return res.status(400).json({ error: 'Only closed cases can be reopened' });
    }

    const updated = await prisma.disciplinaryCase.update({
      where: { id },
      data: {
        status: targetStatus,
        reopenedBy: req.user.fullName,
        reopenedDate: new Date(),
        reopenReason: reason,
        closedBy: null,
        closedDate: null,
      },
    });

    await prisma.disciplinaryStatusLog.create({
      data: {
        caseId: id,
        oldStatus: existing.status,
        newStatus: targetStatus,
        changedBy: req.user.fullName,
        notes: 'Reopened: ' + reason,
      },
    });

    req.app.locals.emit('disciplinary:updated', { id: updated.id, status: updated.status });

    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================================
// ATTACHMENTS
// ============================================================
router.post('/:id/attachments', requireAuth, requireHRorIT, upload.array('files', MAX_FILES_PER_CASE), async (req, res) => {
  const id = parseInt(req.params.id);

  try {
    const existing = await prisma.disciplinaryCase.findUnique({
      where: { id },
      include: { attachments: true },
    });

    if (!existing) {
      (req.files || []).forEach(f => {
        try { fs.unlinkSync(f.path); } catch (e) {}
      });
      return res.status(404).json({ error: 'Case not found' });
    }

    const currentCount = existing.attachments.length;
    const incoming = (req.files || []).length;

    if (currentCount + incoming > MAX_FILES_PER_CASE) {
      (req.files || []).forEach(f => {
        try { fs.unlinkSync(f.path); } catch (e) {}
      });
      return res.status(400).json({
        error: 'Maximum ' + MAX_FILES_PER_CASE + ' attachments per case (has ' + currentCount + ', tried to add ' + incoming + ')',
      });
    }

    const created = [];
    for (const file of (req.files || [])) {
      const att = await prisma.disciplinaryAttachment.create({
        data: {
          caseId: id,
          originalName: file.originalname,
          storedName: file.filename,
          mimeType: file.mimetype,
          sizeBytes: file.size,
          uploadedBy: req.user.fullName,
        },
      });
      created.push(att);
    }

    res.status(201).json({ message: 'Uploaded ' + created.length + ' file(s)', attachments: created });
  } catch (e) {
    (req.files || []).forEach(f => {
      try { fs.unlinkSync(f.path); } catch (err) {}
    });
    res.status(500).json({ error: e.message });
  }
});

router.get('/:id/attachments/:attachmentId', requireAuth, requireHRorIT, async (req, res) => {
  const id = parseInt(req.params.id);
  const attachmentId = parseInt(req.params.attachmentId);

  try {
    const att = await prisma.disciplinaryAttachment.findFirst({
      where: { id: attachmentId, caseId: id },
    });
    if (!att) return res.status(404).json({ error: 'Attachment not found' });

    const filePath = path.join(UPLOAD_DIR, att.storedName);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File missing on disk' });
    }

    res.setHeader('Content-Type', att.mimeType);
    res.setHeader('Content-Disposition', 'inline; filename="' + att.originalName + '"');
    fs.createReadStream(filePath).pipe(res);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/:id/attachments/:attachmentId', requireAuth, requireHRorIT, async (req, res) => {
  const id = parseInt(req.params.id);
  const attachmentId = parseInt(req.params.attachmentId);

  try {
    const att = await prisma.disciplinaryAttachment.findFirst({
      where: { id: attachmentId, caseId: id },
    });
    if (!att) return res.status(404).json({ error: 'Attachment not found' });

    const filePath = path.join(UPLOAD_DIR, att.storedName);
    if (fs.existsSync(filePath)) {
      try { fs.unlinkSync(filePath); } catch (e) {}
    }

    await prisma.disciplinaryAttachment.delete({ where: { id: attachmentId } });

    res.json({ message: 'Attachment deleted' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================================
// CSV EXPORT
// ============================================================
router.get('/export', requireAuth, requireHRorIT, async (req, res) => {
  try {
    const { search, status, offense, department, from, to } = req.query;

    const where = {};
    if (status && status !== 'all') where.status = status;
    if (offense && offense !== 'all') where.offenseType = offense;

    if (from || to) {
      where.reportedDate = {};
      if (from) where.reportedDate.gte = new Date(from);
      if (to) {
        const toDate = new Date(to);
        toDate.setHours(23, 59, 59, 999);
        where.reportedDate.lte = toDate;
      }
    }

    if (department && department !== 'all') {
      where.employee = { department };
    }

    if (search) {
      const q = search;
      where.OR = [
        { caseNumber: { contains: q } },
        { offenseType: { contains: q } },
        { description: { contains: q } },
        { reportedBy: { contains: q } },
        { employee: { name: { contains: q } } },
        { employee: { department: { contains: q } } },
      ];
    }

    const cases = await prisma.disciplinaryCase.findMany({
      where,
      include: {
        employee: { select: { name: true, department: true, role: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const escape = (v) => '"' + String(v ?? '').replace(/"/g, '""') + '"';
    const lines = [
      '# Sally Mugabe Central Hospital - Labour Relations Report',
      '# Generated: ' + new Date().toISOString(),
      '# Filters: status=' + (status || 'all') + ' offense=' + (offense || 'all') + ' dept=' + (department || 'all'),
      '# Total: ' + cases.length,
      '',
      ['Case #','Employee','Department','Role','Offense','Status','Reported By','Reported','Action','Outcome','Closed By','Closed Date'].join(','),
    ];
    const rows = cases.map(c => [
      escape(c.caseNumber),
      escape(c.employee?.name || ''),
      escape(c.employee?.department || ''),
      escape(c.employee?.role || ''),
      escape(c.offenseType),
      escape(c.status),
      escape(c.reportedBy),
      escape(c.reportedDate ? c.reportedDate.toISOString() : ''),
      escape(c.actionTaken || ''),
      escape(c.outcome || ''),
      escape(c.closedBy || ''),
      escape(c.closedDate ? c.closedDate.toISOString() : ''),
    ].join(','));

    const csv = lines.concat(rows).join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="labour-relations-' + new Date().toISOString().split('T')[0] + '.csv"');
    res.send(csv);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
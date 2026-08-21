const express = require("express");
const prisma = require("../prismaClient");
const { requireAuth, requireRole, requireDepartment } = require("../auth");

const router = express.Router();

const STATUSES = ["admitted", "treatment", "discharged", "deceased"];

// GET /api/patients?status=admitted
// Full record — used by the DEPARTMENT ENTRY portal only. Requires auth.
router.get("/", requireAuth, async (req, res) => {
  const { status, ward } = req.query;
  const where = {};
  if (status) where.status = status;
  if (ward) where.wardId = Number(ward);

  const patients = await prisma.patient.findMany({
    where,
    include: { ward: true },
    orderBy: { updatedAt: "desc" },
  });
  res.json(patients);
});

// GET /api/patients/board
// PII-stripped feed — this is what the public/shared-screen dashboard reads.
// No name, no DOB, no nationalId. Just enough to track status by case.
router.get("/board", requireAuth, async (req, res) => {
  const { status, ward } = req.query;
  const where = {};
  if (status) where.status = status;
  if (ward) where.wardId = Number(ward);

  const patients = await prisma.patient.findMany({
    where,
    select: {
      id: true,
      status: true,
      updatedAt: true,
      ward: { select: { name: true } },
      // name, dob, nationalId, attendingDoctor deliberately omitted
    },
    orderBy: { updatedAt: "desc" },
  });
  res.json(patients);
});

// GET /api/patients/summary  -> counts + percentages for the dashboard header
router.get("/summary", requireAuth, async (req, res) => {
  const counts = {};
  for (const s of STATUSES) {
    counts[s] = await prisma.patient.count({ where: { status: s } });
  }
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  const percentages = {};
  for (const s of STATUSES) {
    percentages[s] = total === 0 ? 0 : +((counts[s] / total) * 100).toFixed(1);
  }

  res.json({ counts, percentages, total });
});

// POST /api/patients — used by the department ENTRY portal to register a new case
router.post("/", requireAuth, requireDepartment(["nurses", "records", "it"]), async (req, res) => {
  const { name, nationalId, wardId, status } = req.body;
  if (!name) return res.status(400).json({ error: "Name is required" });
  if (status && !STATUSES.includes(status)) {
    return res.status(400).json({ error: "Invalid status value" });
  }

  const patient = await prisma.patient.create({
    data: {
      name,
      nationalId: nationalId || undefined,
      wardId: wardId || undefined,
      status: status || "admitted",
    },
  });

  await prisma.statusLog.create({
    data: {
      patientId: patient.id,
      oldStatus: "—",
      newStatus: patient.status,
      changedBy: req.user.username,
    },
  });

  res.status(201).json(patient);
});

// PATCH /api/patients/:id/status  -> update status, log the change, notify listeners
router.patch("/:id/status", requireAuth, requireDepartment(["nurses", "records", "it"]), async (req, res) => {
  const id = Number(req.params.id);
  const { newStatus } = req.body;

  if (!STATUSES.includes(newStatus)) {
    return res.status(400).json({ error: "Invalid status value" });
  }

  const existing = await prisma.patient.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: "Patient not found" });

  const updated = await prisma.$transaction(async (tx) => {
    const p = await tx.patient.update({
      where: { id },
      data: { status: newStatus },
    });
    await tx.statusLog.create({
      data: {
        patientId: id,
        oldStatus: existing.status,
        newStatus,
        changedBy: req.user.username, // set by requireAuth
      },
    });
    return p;
  });

  // Note: the Postgres trigger (sql/trigger.sql) also fires pg_notify here,
  // which src/pgListener.js picks up and broadcasts over Socket.io —
  // so this endpoint doesn't need to emit directly.

  res.json(updated);
});

module.exports = router;

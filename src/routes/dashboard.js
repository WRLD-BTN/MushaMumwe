const express = require('express');
const prisma = require('../prismaClient');

const router = express.Router();

// ============================================================
// HELPER: Compute date range from query
// ============================================================
function getDateRange(period) {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);

  let from, to, prevFrom, prevTo;

  switch (period) {
    case 'today':
      from = startOfToday;
      to = now;
      prevFrom = startOfYesterday;
      prevTo = startOfToday;
      break;
    case 'week':
      const weekStart = new Date(startOfToday);
      weekStart.setDate(weekStart.getDate() - now.getDay());
      const prevWeekStart = new Date(weekStart);
      prevWeekStart.setDate(prevWeekStart.getDate() - 7);
      from = weekStart;
      to = now;
      prevFrom = prevWeekStart;
      prevTo = weekStart;
      break;
    case 'month':
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      from = monthStart;
      to = now;
      prevFrom = prevMonthStart;
      prevTo = monthStart;
      break;
    default:
      from = startOfToday;
      to = now;
      prevFrom = startOfYesterday;
      prevTo = startOfToday;
  }

  return { from, to, prevFrom, prevTo };
}

// ============================================================
// HELPER: Compute "patients in care" at a given point in time
// = (admitted before T) - (discharged before T) - (deceased before T)
// ============================================================
async function patientsInCareAt(time) {
  const [admittedBefore, dischargedBefore, deceasedBefore] = await Promise.all([
    prisma.patient.count({
      where: { admissionDate: { lte: time } }
    }),
    prisma.patient.count({
      where: {
        status: 'discharged',
        dischargeDate: { lte: time }
      }
    }),
    prisma.patient.count({
      where: {
        status: 'deceased',
        updatedAt: { lte: time }
      }
    }),
  ]);

  return Math.max(0, admittedBefore - dischargedBefore - deceasedBefore);
}

// ============================================================
// TOP STRIP STATS (with time range + trends)
// ============================================================
router.get('/stats', async (req, res) => {
  try {
    const period = req.query.period || 'today';
    const { from, to, prevFrom, prevTo } = getDateRange(period);

    // Current patients in care
    const patientsCurrent = await prisma.patient.count({
      where: { status: { in: ['admitted', 'treatment'] } }
    });

    // Previous patients in care: at the moment just before this period started
    const patientsPrevious = await patientsInCareAt(prevTo);

    const patientsTrend = patientsCurrent - patientsPrevious;

    const employeesActive = await prisma.employee.count({ where: { status: 'active' } });
    const pendingTenders = await prisma.orderRequest.count({ where: { status: 'pending' } });

    const [admitted, treatment, discharged, deceased] = await Promise.all([
      prisma.patient.count({ where: { status: 'admitted' } }),
      prisma.patient.count({ where: { status: 'treatment' } }),
      prisma.patient.count({ where: { status: 'discharged' } }),
      prisma.patient.count({ where: { status: 'deceased' } }),
    ]);

    const alerts = await computeAlerts();

    res.json({
      period,
      range: { from: from.toISOString(), to: to.toISOString() },
      patients: {
        current: patientsCurrent,
        previous: patientsPrevious,
        trend: patientsTrend,
      },
      employees: { active: employeesActive },
      tenders: { current: pendingTenders },
      distribution: { admitted, treatment, discharged, deceased },
      alerts: alerts.total,
      alertBreakdown: {
        files: alerts.files,
        projects: alerts.projects,
        tenders: alerts.tenders,
        equipment: alerts.equipment,
        incidents: alerts.incidents,
      }
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ... (rest of the file stays the same — clinical-outcomes, deaths-breakdown, alerts, departments, activity)

// ============================================================
// CLINICAL OUTCOMES
// ============================================================
router.get('/clinical-outcomes', async (req, res) => {
  try {
    const period = req.query.period || 'today';
    const { from, to, prevFrom, prevTo } = getDateRange(period);

    const admitted = await prisma.patient.count({
      where: { admissionDate: { gte: from, lte: to } }
    });
    const admittedPrev = await prisma.patient.count({
      where: { admissionDate: { gte: prevFrom, lte: prevTo } }
    });

    const discharged = await prisma.patient.count({
      where: { dischargeDate: { gte: from, lte: to } }
    });
    const dischargedPrev = await prisma.patient.count({
      where: { dischargeDate: { gte: prevFrom, lte: prevTo } }
    });

    const deceased = await prisma.patient.count({
      where: { status: 'deceased', updatedAt: { gte: from, lte: to } }
    });
    const deceasedPrev = await prisma.patient.count({
      where: { status: 'deceased', updatedAt: { gte: prevFrom, lte: prevTo } }
    });

    res.json({
      period,
      range: { from: from.toISOString(), to: to.toISOString() },
      admitted: { current: admitted, previous: admittedPrev, trend: admitted - admittedPrev },
      discharged: { current: discharged, previous: dischargedPrev, trend: discharged - dischargedPrev },
      deceased: { current: deceased, previous: deceasedPrev, trend: deceased - deceasedPrev },
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================================
// DEATHS BREAKDOWN
// ============================================================
router.get('/deaths-breakdown', async (req, res) => {
  try {
    const period = req.query.period || 'week';
    const { from, to } = getDateRange(period);

    const deaths = await prisma.patient.findMany({
      where: {
        status: 'deceased',
        updatedAt: { gte: from, lte: to }
      },
      include: { ward: { select: { name: true } } }
    });

    const byWard = {};
    deaths.forEach(d => {
      const ward = d.ward?.name || 'Unknown';
      byWard[ward] = (byWard[ward] || 0) + 1;
    });

    const byDiagnosis = {};
    deaths.forEach(d => {
      const diag = d.causeOfDeath || 'Not specified';
      byDiagnosis[diag] = (byDiagnosis[diag] || 0) + 1;
    });

    const byGender = { Male: 0, Female: 0, Unknown: 0 };
    deaths.forEach(d => {
      const g = d.gender || 'Unknown';
      if (byGender[g] !== undefined) byGender[g]++;
      else byGender.Unknown++;
    });

    const wardList = Object.entries(byWard)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
    const diagList = Object.entries(byDiagnosis)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    res.json({
      period,
      range: { from: from.toISOString(), to: to.toISOString() },
      total: deaths.length,
      byWard: wardList,
      byDiagnosis: diagList,
      byGender,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================================
// ALERTS
// ============================================================
router.get('/alerts', async (req, res) => {
  try {
    const alerts = await computeAlerts();
    res.json(alerts);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

async function computeAlerts() {
  const fiveDaysAgo = new Date(Date.now() - 5 * 86400000);
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);
  const fourteenDaysAgo = new Date(Date.now() - 14 * 86400000);

  const overdueFiles = await prisma.patientFile.count({
    where: { status: 'out', checkedOutAt: { lte: fiveDaysAgo } }
  });

  const blockedProjects = await prisma.project.findMany({
    where: { status: 'pending' },
    select: { id: true, name: true, department: true, updatedAt: true, obstacleReason: true },
    orderBy: { updatedAt: 'asc' },
    take: 5,
  });

  const staleProjects = await prisma.project.count({
    where: { status: 'ongoing', updatedAt: { lte: sevenDaysAgo } }
  });

  const outOfOrder = await prisma.equipment.findMany({
    where: { status: 'out_of_order' },
    select: { id: true, name: true, location: true },
    take: 5,
  });

  const openIncidents = await prisma.securityIncident.count({
    where: { status: 'open' }
  });

  const stalledTenders = await prisma.orderRequest.count({
    where: { status: 'pending', createdAt: { lte: fourteenDaysAgo } }
  });

  return {
    total: overdueFiles + blockedProjects.length + staleProjects + outOfOrder.length + openIncidents + stalledTenders,
    files: overdueFiles,
    projects: blockedProjects.length + staleProjects,
    tenders: stalledTenders,
    equipment: outOfOrder.length,
    incidents: openIncidents,
    details: {
      blockedProjects: blockedProjects.map(p => ({
        name: p.name,
        department: p.department,
        reason: p.obstacleReason,
        daysStale: Math.floor((Date.now() - new Date(p.updatedAt).getTime()) / 86400000)
      })),
      outOfOrder: outOfOrder.map(e => ({ name: e.name, location: e.location })),
    }
  };
}

// ============================================================
// DEPARTMENTS (unchanged)
// ============================================================
router.get('/departments', async (req, res) => {
  try {
    const [
      patientsAdmitted, patientsTreatment, followUpsDue,
      bodiesInMortuary, scansPending, scansInProgress,
      studentsActive, inventoryCritical, inventoryLow,
      tendersPending, tendersAwaiting,
      platesToday, laundrySentToday, laundryReceivedToday,
      incidentsOpen, filesOverdue,
      equipmentOperational, equipmentOutOfOrder,
      employeesActive, employeesOnLeave,
      transactionsToday,
    ] = await Promise.all([
      prisma.patient.count({ where: { status: 'admitted' } }),
      prisma.patient.count({ where: { status: 'treatment' } }),
      prisma.patient.count({
        where: {
          nextReviewDate: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
            lte: new Date(new Date().setHours(23, 59, 59, 999))
          }
        }
      }),
      prisma.mortuaryRecord.count({ where: { status: 'in_mortuary' } }),
      prisma.scanRequest.count({ where: { status: 'pending' } }),
      prisma.scanRequest.count({ where: { status: 'in_progress' } }),
      prisma.schoolStudent.count({ where: { status: 'active' } }),
      prisma.inventoryItem.count({ where: { quantity: { lt: 10 } } }),
      prisma.inventoryItem.count({ where: { quantity: { gte: 10, lt: 50 } } }),
      prisma.orderRequest.count({ where: { status: 'pending' } }),
      prisma.orderRequest.count({ where: { status: 'awaiting_quotation' } }),
      prisma.mealDelivery.aggregate({
        where: { createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } },
        _sum: { quantity: true }
      }),
      prisma.linenMovement.aggregate({
        where: { type: 'sent', createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } },
        _sum: { quantity: true }
      }),
      prisma.linenMovement.aggregate({
        where: { type: 'received', createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } },
        _sum: { quantity: true }
      }),
      prisma.securityIncident.count({ where: { status: 'open' } }),
      prisma.patientFile.count({ where: { status: 'out', checkedOutAt: { lte: new Date(Date.now() - 5 * 86400000) } } }),
      prisma.equipment.count({ where: { status: 'operational' } }),
      prisma.equipment.count({ where: { status: 'out_of_order' } }),
      prisma.employee.count({ where: { status: 'active' } }),
      prisma.employee.count({ where: { status: 'on_leave' } }),
      prisma.cashFlow.count({ where: { date: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } } }),
    ]);

    function health(criticalCount) {
      if (criticalCount > 0) return 'critical';
      return 'healthy';
    }

    res.json([
      { id: 'nurses', name: 'Nurses', category: 'Clinical', status: 'healthy',
        stats: { admitted: patientsAdmitted, followUps: followUpsDue } },
      { id: 'medical', name: 'Medical', category: 'Clinical', status: 'healthy',
        stats: { treatment: patientsTreatment, admitted: patientsAdmitted } },
      { id: 'mortuary', name: 'Mortuary', category: 'Clinical', status: 'healthy',
        stats: { inMortuary: bodiesInMortuary } },
      { id: 'radiography', name: 'Radiography', category: 'Clinical', status: 'healthy',
        stats: { pending: scansPending, inProgress: scansInProgress } },
      { id: 'schools', name: 'Schools', category: 'Clinical', status: 'healthy',
        stats: { active: studentsActive } },
      { id: 'stores', name: 'Stores', category: 'Operations', status: health(inventoryCritical),
        stats: { critical: inventoryCritical, low: inventoryLow } },
      { id: 'procurement', name: 'Procurement', category: 'Operations', status: health(tendersPending),
        stats: { pending: tendersPending, awaiting: tendersAwaiting } },
      { id: 'it', name: 'IT', category: 'Operations', status: 'healthy',
        stats: { users: 21 } },
      { id: 'catering', name: 'Catering', category: 'Operations', status: 'healthy',
        stats: { platesToday: platesToday._sum.quantity || 0 } },
      { id: 'laundry', name: 'Laundry', category: 'Operations', status: 'healthy',
        stats: { sent: laundrySentToday._sum.quantity || 0, received: laundryReceivedToday._sum.quantity || 0 } },
      { id: 'security', name: 'Security', category: 'Operations', status: health(incidentsOpen),
        stats: { openIncidents: incidentsOpen } },
      { id: 'biomedical', name: 'Biomedical', category: 'Operations', status: health(equipmentOutOfOrder),
        stats: { operational: equipmentOperational, outOfOrder: equipmentOutOfOrder } },
      { id: 'hr', name: 'HR', category: 'Admin', status: 'healthy',
        stats: { active: employeesActive, onLeave: employeesOnLeave } },
      { id: 'accounts', name: 'Accounts', category: 'Admin', status: 'healthy',
        stats: { transactionsToday: transactionsToday } },
      { id: 'healthinfo', name: 'Health Info', category: 'Admin', status: health(filesOverdue),
        stats: { overdueFiles: filesOverdue } },
    ]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================================
// ACTIVITY FEED
// ============================================================
router.get('/activity', async (req, res) => {
  try {
    const events = [];

    const patients = await prisma.patient.findMany({
      orderBy: { updatedAt: 'desc' },
      take: 5,
      select: { id: true, status: true, updatedAt: true, ward: { select: { name: true } } },
    });
    patients.forEach(p => events.push({
      type: 'patient',
      severity: 'info',
      message: `Patient #${p.id} — ${p.status}${p.ward ? ' at ' + p.ward.name : ''}`,
      timestamp: p.updatedAt,
      portal: 'nurses',
    }));

    const tenders = await prisma.orderRequest.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { id: true, itemName: true, status: true, createdAt: true },
    });
    tenders.forEach(t => events.push({
      type: 'tender',
      severity: t.status === 'pending' ? 'warning' : 'info',
      message: `Tender #${t.id} — ${t.itemName} (${t.status})`,
      timestamp: t.createdAt,
      portal: 'procurement',
    }));

    const incidents = await prisma.securityIncident.findMany({
      where: { status: 'open' },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { type: true, location: true, createdAt: true },
    });
    incidents.forEach(i => events.push({
      type: 'incident',
      severity: 'critical',
      message: `Security: ${i.type} at ${i.location}`,
      timestamp: i.createdAt,
      portal: 'security',
    }));

    const scans = await prisma.scanRequest.findMany({
      orderBy: { createdAt: 'desc' },
      take: 3,
      select: { id: true, scanType: true, status: true, createdAt: true, patientId: true },
    });
    scans.forEach(s => events.push({
      type: 'scan',
      severity: s.status === 'completed' ? 'info' : 'warning',
      message: `${s.scanType} for Patient #${s.patientId} — ${s.status}`,
      timestamp: s.createdAt,
      portal: 'radiography',
    }));

    events.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    res.json(events.slice(0, 20));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
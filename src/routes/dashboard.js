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

function daysSince(date) {
  if (!date) return 0;
  return Math.floor((Date.now() - new Date(date).getTime()) / 86400000);
}

async function patientsInCareAt(time) {
  const [admittedBefore, dischargedBefore, deceasedBefore] = await Promise.all([
    prisma.patient.count({ where: { admissionDate: { lte: time } } }),
    prisma.patient.count({ where: { status: 'discharged', dischargeDate: { lte: time } } }),
    prisma.patient.count({ where: { status: 'deceased', updatedAt: { lte: time } } }),
  ]);
  return Math.max(0, admittedBefore - dischargedBefore - deceasedBefore);
}

// ============================================================
// MORNING BRIEF
// ============================================================
router.get('/morning-brief', async (req, res) => {
  try {
    const now = new Date();
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);
    const fourteenDaysAgo = new Date(Date.now() - 14 * 86400000);
    const sixtyDaysFromNow = new Date(Date.now() + 60 * 86400000);

    const [
      blockedProjects, criticalBlockedProjects, stalledTenders,
      deathsThisWeek, deathsLastWeek, icuWard, icuOccupied,
      retirementsSoon, pendingApprovals, latestAudit
    ] = await Promise.all([
      prisma.project.count({ where: { status: 'pending' } }),
      prisma.project.count({ where: { status: 'pending', updatedAt: { lte: fourteenDaysAgo } } }),
      prisma.orderRequest.count({ where: { status: 'pending', createdAt: { lte: fourteenDaysAgo } } }),
      prisma.patient.count({ where: { status: 'deceased', updatedAt: { gte: sevenDaysAgo } } }),
      prisma.patient.count({ where: { status: 'deceased', updatedAt: { gte: new Date(Date.now() - 14 * 86400000), lt: sevenDaysAgo } } }),
      prisma.ward.findFirst({ where: { name: 'ICU' } }),
      prisma.patient.count({ where: { ward: { name: 'ICU' }, status: { in: ['admitted', 'treatment'] } } }),
      prisma.employeeMovement.count({ where: { movementType: 'retirement', plannedDate: { lte: sixtyDaysFromNow, gte: now } } }),
      prisma.orderRequest.count({ where: { status: 'pending' } }),
      prisma.auditLog.findFirst({ orderBy: { timestamp: 'desc' } })
    ]);

    let brief = ``; 

    if (blockedProjects > 0) brief += `${blockedProjects} blocked projects (${criticalBlockedProjects} critical, >14 days). `;
    if (stalledTenders > 0) brief += `${stalledTenders} stalled tenders. `;
    
    if (deathsThisWeek > 0) {
      const trend = deathsThisWeek >= deathsLastWeek ? 'up' : 'down';
      brief += `${deathsThisWeek} deaths this week, ${trend} from ${deathsLastWeek}. `;
    }

    if (icuWard && icuOccupied >= icuWard.capacity) {
      brief += `ICU at 100% occupancy. `;
    } else if (icuWard && icuOccupied >= icuWard.capacity * 0.9) {
      brief += `ICU at ${Math.round((icuOccupied / icuWard.capacity) * 100)}% occupancy. `;
    }

    if (retirementsSoon > 0) brief += `${retirementsSoon} retirements due in 60 days. `;
    if (pendingApprovals > 0) brief += `Procurement has ${pendingApprovals} approvals on your desk. `;

    const lastRefresh = latestAudit ? daysSince(latestAudit.timestamp) : 0;
    brief += `Last data refresh: ${lastRefresh === 0 ? 'today' : lastRefresh + ' days ago'}. `;
    brief += `No departments offline.`;

    res.json({ brief, generatedAt: now.toISOString() });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================================
// TOP STATS & CLINICAL OUTCOMES
// ============================================================
router.get('/stats', async (req, res) => {
  try {
    const period = req.query.period || 'today';
    const { from, to, prevFrom, prevTo } = getDateRange(period);

    const patientsCurrent = await prisma.patient.count({
      where: { status: { in: ['admitted', 'treatment'] } }
    });
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
      patients: { current: patientsCurrent, previous: patientsPrevious, trend: patientsTrend },
      employees: { active: employeesActive },
      tenders: { current: pendingTenders },
      distribution: { admitted, treatment, discharged, deceased },
      distributionTotal: admitted + treatment + discharged + deceased,
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

router.get('/clinical-outcomes', async (req, res) => {
  try {
    const period = req.query.period || 'today';
    const { from, to, prevFrom, prevTo } = getDateRange(period);

    const admitted = await prisma.patient.count({ where: { admissionDate: { gte: from, lte: to } } });
    const admittedPrev = await prisma.patient.count({ where: { admissionDate: { gte: prevFrom, lte: prevTo } } });
    const discharged = await prisma.patient.count({ where: { dischargeDate: { gte: from, lte: to } } });
    const dischargedPrev = await prisma.patient.count({ where: { dischargeDate: { gte: prevFrom, lte: prevTo } } });
    const deceased = await prisma.patient.count({ where: { status: 'deceased', updatedAt: { gte: from, lte: to } } });
    const deceasedPrev = await prisma.patient.count({ where: { status: 'deceased', updatedAt: { gte: prevFrom, lte: prevTo } } });

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
      where: { status: 'deceased', updatedAt: { gte: from, lte: to } },
      include: { ward: { select: { name: true } } }
    });

    const byWard = {};
    deaths.forEach(d => { const w = d.ward?.name || 'Unknown'; byWard[w] = (byWard[w] || 0) + 1; });

    const byDiagnosis = {};
    deaths.forEach(d => { const diag = d.causeOfDeath || 'Not specified'; byDiagnosis[diag] = (byDiagnosis[diag] || 0) + 1; });

    const byGender = { Male: 0, Female: 0, Unknown: 0 };
    deaths.forEach(d => {
      const g = d.gender || 'Unknown';
      if (byGender[g] !== undefined) byGender[g]++;
      else byGender.Unknown++;
    });

    const wardList = Object.entries(byWard).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
    const diagList = Object.entries(byDiagnosis).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);

    res.json({
      period,
      range: { from: from.toISOString(), to: to.toISOString() },
      total: deaths.length,
      byWard: wardList,
      byDiagnosis: diagList,
      byGender,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============================================================
// ALERTS
// ============================================================
router.get('/alerts', async (req, res) => {
  try {
    const alerts = await computeAlerts();
    res.json(alerts);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

async function computeAlerts() {
  const fiveDaysAgo = new Date(Date.now() - 5 * 86400000);
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);
  const fourteenDaysAgo = new Date(Date.now() - 14 * 86400000);

  const overdueFiles = await prisma.patientFile.count({ where: { status: 'out', checkedOutAt: { lte: fiveDaysAgo } } });
  const blockedProjects = await prisma.project.count({ where: { status: 'pending' } });
  const staleProjects = await prisma.project.count({ where: { status: 'ongoing', updatedAt: { lte: sevenDaysAgo } } });
  const outOfOrder = await prisma.equipment.count({ where: { status: 'out_of_order' } });
  const openIncidents = await prisma.securityIncident.count({ where: { status: 'open' } });
  const stalledTenders = await prisma.orderRequest.count({ where: { status: 'pending', createdAt: { lte: fourteenDaysAgo } } });

  return {
    total: overdueFiles + blockedProjects + staleProjects + outOfOrder + openIncidents + stalledTenders,
    files: overdueFiles,
    projects: blockedProjects + staleProjects,
    tenders: stalledTenders,
    equipment: outOfOrder,
    incidents: openIncidents,
  };
}

// ============================================================
// DEPARTMENTS (Public summary)
// ============================================================
router.get('/departments', async (req, res) => {
  try {
    const [
      patientsAdmitted, patientsTreatment, followUpsDue, bodiesInMortuary, scansPending, scansInProgress,
      studentsActive, inventoryCritical, inventoryLow, tendersPending, tendersAwaiting,
      platesToday, laundrySentToday, laundryReceivedToday, incidentsOpen, filesOverdue,
      equipmentOperational, equipmentOutOfOrder, employeesActive, employeesOnLeave, transactionsToday,
    ] = await Promise.all([
      prisma.patient.count({ where: { status: 'admitted' } }),
      prisma.patient.count({ where: { status: 'treatment' } }),
      prisma.patient.count({ where: { nextReviewDate: { gte: new Date(new Date().setHours(0, 0, 0, 0)), lte: new Date(new Date().setHours(23, 59, 59, 999)) } } }),
      prisma.mortuaryRecord.count({ where: { status: 'in_mortuary' } }),
      prisma.scanRequest.count({ where: { status: 'pending' } }),
      prisma.scanRequest.count({ where: { status: 'in_progress' } }),
      prisma.schoolStudent.count({ where: { status: 'active' } }),
      prisma.inventoryItem.count({ where: { quantity: { lt: 10 } } }),
      prisma.inventoryItem.count({ where: { quantity: { gte: 10, lt: 50 } } }),
      prisma.orderRequest.count({ where: { status: 'pending' } }),
      prisma.orderRequest.count({ where: { status: 'awaiting_quotation' } }),
      prisma.mealDelivery.aggregate({ where: { createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } }, _sum: { quantity: true } }),
      prisma.linenMovement.aggregate({ where: { type: 'sent', createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } }, _sum: { quantity: true } }),
      prisma.linenMovement.aggregate({ where: { type: 'received', createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } }, _sum: { quantity: true } }),
      prisma.securityIncident.count({ where: { status: 'open' } }),
      prisma.patientFile.count({ where: { status: 'out', checkedOutAt: { lte: new Date(Date.now() - 5 * 86400000) } } }),
      prisma.equipment.count({ where: { status: 'operational' } }),
      prisma.equipment.count({ where: { status: 'out_of_order' } }),
      prisma.employee.count({ where: { status: 'active' } }),
      prisma.employee.count({ where: { status: 'on_leave' } }),
      prisma.cashFlow.count({ where: { date: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } } }),
    ]);

    function health(c) { return c > 0 ? 'critical' : 'healthy'; }

    res.json([
      { id: 'nurses', name: 'Nurses', category: 'Clinical', status: 'healthy', stats: { admitted: patientsAdmitted, followUps: followUpsDue } },
      { id: 'medical', name: 'Medical', category: 'Clinical', status: 'healthy', stats: { treatment: patientsTreatment, admitted: patientsAdmitted } },
      { id: 'mortuary', name: 'Mortuary', category: 'Clinical', status: 'healthy', stats: { inMortuary: bodiesInMortuary } },
      { id: 'radiography', name: 'Radiography', category: 'Clinical', status: 'healthy', stats: { pending: scansPending, inProgress: scansInProgress } },
      { id: 'schools', name: 'Schools', category: 'Clinical', status: 'healthy', stats: { active: studentsActive } },
      { id: 'stores', name: 'Stores', category: 'Operations', status: health(inventoryCritical), stats: { critical: inventoryCritical, low: inventoryLow } },
      { id: 'procurement', name: 'Procurement', category: 'Operations', status: health(tendersPending), stats: { pending: tendersPending, awaiting: tendersAwaiting } },
      { id: 'it', name: 'IT', category: 'Operations', status: 'healthy', stats: { users: 21 } },
      { id: 'catering', name: 'Catering', category: 'Operations', status: 'healthy', stats: { platesToday: platesToday._sum.quantity || 0 } },
      { id: 'laundry', name: 'Laundry', category: 'Operations', status: 'healthy', stats: { sent: laundrySentToday._sum.quantity || 0, received: laundryReceivedToday._sum.quantity || 0 } },
      { id: 'security', name: 'Security', category: 'Operations', status: health(incidentsOpen), stats: { openIncidents: incidentsOpen } },
      { id: 'biomedical', name: 'Biomedical', category: 'Operations', status: health(equipmentOutOfOrder), stats: { operational: equipmentOperational, outOfOrder: equipmentOutOfOrder } },
      { id: 'hr', name: 'HR', category: 'Admin', status: 'healthy', stats: { active: employeesActive, onLeave: employeesOnLeave } },
      { id: 'accounts', name: 'Accounts', category: 'Admin', status: 'healthy', stats: { transactionsToday: transactionsToday } },
      { id: 'healthinfo', name: 'Health Info', category: 'Admin', status: health(filesOverdue), stats: { overdueFiles: filesOverdue } },
    ]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============================================================
// ACTIVITY FEED
// ============================================================
router.get('/activity', async (req, res) => {
  try {
    const events = [];
    const patients = await prisma.patient.findMany({ orderBy: { updatedAt: 'desc' }, take: 5, select: { id: true, status: true, updatedAt: true, ward: { select: { name: true } } } });
    patients.forEach(p => events.push({ type: 'patient', severity: 'info', message: `Patient #${p.id} - ${p.status}${p.ward ? ' at ' + p.ward.name : ''}`, timestamp: p.updatedAt, portal: 'nurses' }));
    
    const tenders = await prisma.orderRequest.findMany({ orderBy: { createdAt: 'desc' }, take: 5, select: { id: true, itemName: true, status: true, createdAt: true } });
    tenders.forEach(t => events.push({ type: 'tender', severity: t.status === 'pending' ? 'warning' : 'info', message: `Tender #${t.id} - ${t.itemName} (${t.status})`, timestamp: t.createdAt, portal: 'procurement' }));
    
    const incidents = await prisma.securityIncident.findMany({ where: { status: 'open' }, orderBy: { createdAt: 'desc' }, take: 5, select: { type: true, location: true, createdAt: true } });
    incidents.forEach(i => events.push({ type: 'incident', severity: 'critical', message: `Security: ${i.type} at ${i.location}`, timestamp: i.createdAt, portal: 'security' }));
    
    const scans = await prisma.scanRequest.findMany({ orderBy: { createdAt: 'desc' }, take: 3, select: { id: true, scanType: true, status: true, createdAt: true, patientId: true } });
    scans.forEach(s => events.push({ type: 'scan', severity: s.status === 'completed' ? 'info' : 'warning', message: `${s.scanType} for Patient #${s.patientId} - ${s.status}`, timestamp: s.createdAt, portal: 'radiography' }));

    const valid = events.filter(e => e.timestamp && !isNaN(new Date(e.timestamp).getTime()));
    valid.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    res.json(valid.slice(0, 20));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============================================================
// BREAKDOWN - Executive Aggregations
// ============================================================
router.get('/breakdown', async (req, res) => {
  try {
    const type = req.query.type;
    const period = req.query.period || 'today';
    const { from, to } = getDateRange(period);

    let title = '';
    let unit = '';
    let rows = [];
    let view = 'bars';

    const wards = await prisma.ward.findMany({ orderBy: { name: 'asc' } });

    function sortRows() {
      rows.sort((a, b) => b.value - a.value);
    }

    switch (type) {
      case 'patients-by-ward': {
        title = 'Patients In Care - Bed Occupancy';
        unit = 'patients';
        view = 'bars';
        const patients = await prisma.patient.findMany({ where: { status: { in: ['admitted', 'treatment'] } }, select: { wardId: true } });
        const counts = {};
        patients.forEach(p => { const wid = p.wardId || 0; counts[wid] = (counts[wid] || 0) + 1; });
        rows = wards.map(w => ({
          label: w.name, value: counts[w.id] || 0,
          capacity: w.capacity,
          occupancy: w.capacity > 0 ? ((counts[w.id] || 0) / w.capacity) * 100 : 0,
          extra: `${counts[w.id] || 0} / ${w.capacity} beds`
        }));
        if (counts[0]) rows.push({ label: 'Unassigned', value: counts[0], capacity: null, occupancy: 0 });
        break;
      }

      case 'employees-list': {
        title = 'Active Employees - Department & Role Mix';
        unit = 'employees';
        view = 'bars';
        const emps = await prisma.employee.groupBy({
          by: ['department', 'role'],
          where: { status: 'active' },
          _count: true
        });
        rows = emps.map(e => ({
          label: `${e.department} - ${e.role}`,
          value: e._count,
          extra: e.department
        }));
        break;
      }

      case 'admitted-list': {
        title = 'Top Admissions - Disease Burden (' + period + ')';
        unit = 'cases';
        view = 'bars';
        const pts = await prisma.patient.findMany({
          where: { admissionDate: { gte: from, lte: to } },
          select: { diagnosis: true }
        });
        const byDiag = {};
        pts.forEach(p => { const d = p.diagnosis || 'Unknown'; byDiag[d] = (byDiag[d] || 0) + 1; });
        rows = Object.entries(byDiag).map(([label, value]) => ({ label, value })).slice(0, 10);
        break;
      }

      case 'discharged-list': {
        title = 'Discharge Outcomes (' + period + ')';
        unit = 'patients';
        view = 'bars';
        const pts = await prisma.patient.findMany({
          where: { dischargeDate: { gte: from, lte: to } },
          select: { outcome: true, finalDiagnosis: true }
        });
        const byOutcome = {};
        pts.forEach(p => { const o = p.outcome || 'Unknown'; byOutcome[o] = (byOutcome[o] || 0) + 1; });
        rows = Object.entries(byOutcome).map(([label, value]) => ({ label, value }));
        break;
      }

      case 'distribution-admitted': {
        title = 'Active Admissions - By Ward';
        unit = 'patients';
        view = 'bars';
        const pts = await prisma.patient.findMany({ where: { status: 'admitted' }, select: { wardId: true } });
        const counts = {};
        pts.forEach(p => { const wid = p.wardId || 0; counts[wid] = (counts[wid] || 0) + 1; });
        rows = wards.map(w => ({ label: w.name, value: counts[w.id] || 0, capacity: w.capacity, extra: `${counts[w.id] || 0} / ${w.capacity} beds` }));
        break;
      }

      case 'distribution-treatment': {
        title = 'Active Treatments - By Ward';
        unit = 'patients';
        view = 'bars';
        const pts = await prisma.patient.findMany({ where: { status: 'treatment' }, select: { wardId: true } });
        const counts = {};
        pts.forEach(p => { const wid = p.wardId || 0; counts[wid] = (counts[wid] || 0) + 1; });
        rows = wards.map(w => ({ label: w.name, value: counts[w.id] || 0, capacity: w.capacity, extra: `${counts[w.id] || 0} / ${w.capacity} beds` }));
        break;
      }

      case 'distribution-discharged': {
        title = 'Discharged - Flow by Ward (' + period + ')';
        unit = 'patients';
        view = 'bars';
        const pts = await prisma.patient.findMany({ where: { dischargeDate: { gte: from, lte: to } }, select: { wardId: true } });
        const counts = {};
        pts.forEach(p => { const wid = p.wardId || 0; counts[wid] = (counts[wid] || 0) + 1; });
        rows = wards.map(w => ({ label: w.name, value: counts[w.id] || 0 }));
        break;
      }

      case 'distribution-deceased': {
        title = 'Deceased - By Ward (' + period + ')';
        unit = 'patients';
        view = 'bars';
        const pts = await prisma.patient.findMany({ where: { status: 'deceased', updatedAt: { gte: from, lte: to } }, select: { wardId: true } });
        const counts = {};
        pts.forEach(p => { const wid = p.wardId || 0; counts[wid] = (counts[wid] || 0) + 1; });
        rows = wards.map(w => ({ label: w.name, value: counts[w.id] || 0 }));
        break;
      }

      case 'tenders-list': {
        title = 'Departmental Slippage - Stalled Tenders';
        unit = 'tenders';
        view = 'bars';
        const tenders = await prisma.orderRequest.findMany({ where: { status: 'pending' } });
        const byDept = {};
        tenders.forEach(t => {
          const d = t.originatorDepartment || t.requestingDepartment;
          if (!byDept[d]) byDept[d] = 0;
          byDept[d]++;
        });
        rows = Object.entries(byDept).map(([label, value]) => ({ label, value }));
        break;
      }

      case 'projects-list': {
        const status = req.query.status;
        title = status ? `Projects - ${status.toUpperCase()}` : 'Projects - Blocked by Department';
        unit = 'projects';
        view = 'bars';
        const where = status ? { status } : { status: 'pending' };
        const projs = await prisma.project.findMany({ where });
        const byDept = {};
        projs.forEach(p => {
          if (!byDept[p.department]) byDept[p.department] = 0;
          byDept[p.department]++;
        });
        rows = Object.entries(byDept).map(([label, value]) => ({ label, value }));
        break;
      }

      case 'movements-list': {
        title = 'Establishment Movements (' + period + ')';
        unit = 'staff';
        view = 'bars';
        const movs = await prisma.employeeMovement.findMany({ where: { createdAt: { gte: from, lte: to } } });
        const byType = { transfer: 0, retirement: 0, resignation: 0 };
        movs.forEach(m => { if (byType[m.movementType] !== undefined) byType[m.movementType]++; });
        rows = Object.entries(byType).map(([label, value]) => ({ label, value }));
        break;
      }

      case 'disciplinary-list': {
        title = 'Disciplinary Cases - Departmental Conduct';
        unit = 'cases';
        view = 'bars';
        const cases = await prisma.disciplinaryCase.findMany({
          where: { reportedDate: { gte: from, lte: to } },
          include: { employee: { select: { department: true } } }
        });
        const byDept = {};
        cases.forEach(c => {
          const d = c.employee ? c.employee.department : 'Unknown';
          if (!byDept[d]) byDept[d] = 0;
          byDept[d]++;
        });
        rows = Object.entries(byDept).map(([label, value]) => ({ label, value }));
        break;
      }

      case 'inventory-list': {
        title = 'Inventory Stockout Risk';
        unit = 'items';
        view = 'bars';
        const items = await prisma.inventoryItem.findMany();
        const bucket = req.query.bucket;
        let filtered = items;
        if (bucket === 'critical') filtered = items.filter(i => i.quantity < 10);
        if (bucket === 'low') filtered = items.filter(i => i.quantity >= 10 && i.quantity < 50);
        if (bucket === 'adequate') filtered = items.filter(i => i.quantity >= 50);
        
        rows = filtered.map(i => ({
          label: i.name,
          value: i.quantity,
          extra: i.category || 'Uncategorised'
        }));
        break;
      }

      case 'equipment-out-of-order': {
        title = 'Equipment Downtime - By Category';
        unit = 'equipment';
        view = 'bars';
        const eq = await prisma.equipment.findMany({ where: { status: 'out_of_order' } });
        const byCat = {};
        eq.forEach(e => {
          if (!byCat[e.category]) byCat[e.category] = 0;
          byCat[e.category]++;
        });
        rows = Object.entries(byCat).map(([label, value]) => ({ label, value }));
        break;
      }

      case 'audit-recent': {
        title = 'Audit Log - Action Summary';
        unit = 'entries';
        view = 'bars';
        const logs = await prisma.auditLog.groupBy({ by: ['action'], _count: true });
        rows = logs.map(l => ({ label: l.action, value: l._count }));
        break;
      }

      case 'alerts-files': {
        title = 'Overdue Patient Files (>5 days)';
        unit = 'files';
        view = 'bars';
        const files = await prisma.patientFile.findMany({ where: { status: 'out', checkedOutAt: { lte: new Date(Date.now() - 5 * 86400000) } } });
        const byWard = {};
        files.forEach(f => {
          if (!byWard[f.ward]) byWard[f.ward] = 0;
          byWard[f.ward]++;
        });
        rows = Object.entries(byWard).map(([label, value]) => ({ label, value }));
        break;
      }

      case 'alerts-incidents': {
        title = 'Open Security Incidents - By Type';
        unit = 'incidents';
        view = 'bars';
        const inc = await prisma.securityIncident.findMany({ where: { status: 'open' } });
        const byType = {};
        inc.forEach(i => {
          if (!byType[i.type]) byType[i.type] = 0;
          byType[i.type]++;
        });
        rows = Object.entries(byType).map(([label, value]) => ({ label, value }));
        break;
      }

      case 'cashflow-list': {
        title = 'Finance - By Source (' + period + ')';
        unit = 'transactions';
        view = 'bars';
        const flows = await prisma.cashFlow.findMany({ where: { date: { gte: from, lte: to } } });
        const bySource = {};
        flows.forEach(f => {
          if (!bySource[f.source]) bySource[f.source] = 0;
          bySource[f.source] += f.amount;
        });
        rows = Object.entries(bySource).map(([label, value]) => ({ label, value }));
        break;
      }

      case 'users-by-department': {
        title = 'System Users - By Department';
        unit = 'users';
        view = 'bars';
        const users = await prisma.user.groupBy({ by: ['department'], _count: true });
        rows = users.map(u => ({ label: u.department, value: u._count }));
        break;
      }

      case 'headcount-by-dept': {
        title = 'Headcount vs Target - By Department';
        unit = 'staff';
        view = 'bars';
        const depts = await prisma.employee.groupBy({ by: ['department'], _count: true, where: { status: { in: ['active', 'on_leave', 'sick'] } } });
        const targets = await prisma.establishmentTarget.findMany();
        const tMap = {};
        targets.forEach(t => { tMap[t.department] = t; });
        rows = depts.map(d => {
          const t = tMap[d.department];
          let extra = '';
          if (t) {
            if (d._count < t.minHeadcount) extra = `UNDERSTAFFED (Min: ${t.minHeadcount})`;
            else if (t.maxHeadcount && d._count > t.maxHeadcount) extra = `OVERSTAFFED (Max: ${t.maxHeadcount})`;
            else extra = `Adequate`;
          }
          return { label: d.department, value: d._count, extra };
        });
        break;
      }

      default:
        return res.status(400).json({ error: 'Unknown breakdown type: ' + type });
    }

    sortRows();

    const total = rows.reduce((s, r) => s + r.value, 0);
    rows.forEach(r => {
      r.percentage = total > 0 ? parseFloat(((r.value / total) * 100).toFixed(1)) : 0;
    });

    res.json({ title, unit, view, rows, total, period });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
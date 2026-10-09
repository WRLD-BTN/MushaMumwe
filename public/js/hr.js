// ============================================================
// Sally Mugabe Central Hospital - HR Department
// ============================================================

let allEmployees = [];
let allTenders = [];
let allDisciplinaryCases = [];
let disciplinaryMetadata = { offenses: [], actions: [], statuses: [] };
let currentOpenCaseId = null;
let tenderFilter = 'all';
let staffSearchTimer = null;
let discSearchTimer = null;
let selectedEmployeeId = null;

async function init_hr() {
  await loadWards();
  await runStaffSearch();
  await loadStaffingSummary();
  await loadMyTenders();
  await loadDisciplinaryMetadata();
  await loadDisciplinarySummary();
  await runDisciplinarySearch();
  await populateEmployeeDropdown();
  wireDisciplinaryUpload();

  window.onEmployeeUpdated = () => {
    runStaffSearch();
    loadStaffingSummary();
  };
  window.onOrderUpdated = (payload) => {
    const myDept = String(currentDeptName || '').toLowerCase();
    const sub = String(payload?.department || '').toLowerCase();
    const orig = String(payload?.originator || '').toLowerCase();
    if (sub === myDept || orig === myDept) loadMyTenders();
  };
  window.onDisciplinaryUpdated = () => {
    loadDisciplinarySummary();
    runDisciplinarySearch();
  };
}

// ============================================================
// WARDS
// ============================================================
async function loadWards() {
  const res = await fetch('/api/wards', { headers: { Authorization: 'Bearer ' + token() } });
  if (!res.ok) return;
  const wards = await res.json();
  const empWard = document.getElementById('hr-empWard');
  if (empWard) {
    empWard.innerHTML = '<option value="">None</option>' +
      wards.map(w => '<option value="' + w.id + '">' + escapeHtml(w.name) + '</option>').join('');
  }
}

// ============================================================
// STAFF SEARCH
// ============================================================
function debouncedStaffSearch() {
  clearTimeout(staffSearchTimer);
  staffSearchTimer = setTimeout(runStaffSearch, 300);
}

function toggleAdvancedStaffFilters() {
  const el = document.getElementById('hr-advancedFilters');
  el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

async function runStaffSearch() {
  const params = new URLSearchParams();
  const search = document.getElementById('hr-empSearchBox').value.trim();
  const department = document.getElementById('hr-filterDept').value;
  const status = document.getElementById('hr-filterStatus').value;
  const role = document.getElementById('hr-filterRole').value.trim();
  const from = document.getElementById('hr-filterFrom').value;
  const to = document.getElementById('hr-filterTo').value;

  if (search) params.set('search', search);
  if (department && department !== 'all') params.set('department', department);
  if (status && status !== 'all') params.set('status', status);
  if (role) params.set('role', role);
  if (from) params.set('from', from);
  if (to) params.set('to', to);

  try {
    const res = await fetch('/api/employees?' + params, { headers: { Authorization: 'Bearer ' + token() } });
    if (!res.ok) throw new Error('Failed');
    allEmployees = await res.json();
    renderStaffRoster();
  } catch (e) {
    document.getElementById('hr-empRosterTable').innerHTML =
      '<p class="error">' + e.message + '</p>';
  }
}

function clearStaffFilters() {
  document.getElementById('hr-empSearchBox').value = '';
  document.getElementById('hr-filterDept').value = 'all';
  document.getElementById('hr-filterStatus').value = 'all';
  document.getElementById('hr-filterRole').value = '';
  document.getElementById('hr-filterFrom').value = '';
  document.getElementById('hr-filterTo').value = '';
  runStaffSearch();
}

function renderStaffRoster() {
  const el = document.getElementById('hr-empRosterTable');

  if (allEmployees.length === 0) {
    el.innerHTML = '<div class="empty-state">No Staff Found</div>';
    return;
  }

  el.innerHTML = '<table class="data-table">' +
    '<thead><tr>' +
    '<th>Name</th><th>Department</th><th>Role</th><th>Ward</th><th>Status</th><th>Action</th>' +
    '</tr></thead><tbody>' +
    allEmployees.map(e => {
      const wardName = e.ward ? e.ward.name : '-';
      const cls = {
        active: 'status-ok',
        on_leave: 'status-low',
        sick: 'status-critical',
        terminated: 'status-terminated',
      }[e.status] || 'status-ok';

      return '<tr>' +
        '<td>' + escapeHtml(e.name) + '</td>' +
        '<td>' + escapeHtml(e.department) + '</td>' +
        '<td>' + escapeHtml(e.role || '-') + '</td>' +
        '<td>' + escapeHtml(wardName) + '</td>' +
        '<td><span class="status-pill ' + cls + '">' + escapeHtml(e.status) + '</span></td>' +
        '<td><button class="pill-btn" onclick="openEmpModal(' + e.id + ', \'' +
        e.name.replace(/'/g, "\\'") + '\', \'' + e.status + '\')">Update</button></td>' +
        '</tr>';
    }).join('') +
    '</tbody></table>';
}

// ============================================================
// ADD EMPLOYEE
// ============================================================
async function addEmployee() {
  const name = document.getElementById('hr-empName').value.trim();
  const department = document.getElementById('hr-empDept').value;
  const role = document.getElementById('hr-empRole').value.trim();
  const wardId = document.getElementById('hr-empWard').value;
  const hireDate = document.getElementById('hr-empHireDate').value;
  const msg = document.getElementById('hr-empAddMessage');

  if (!name || !hireDate) {
    msg.innerHTML = '<div class="error">Name and hire date required</div>';
    return;
  }

  try {
    const res = await fetch('/api/employees', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token() },
      body: JSON.stringify({
        name, department, role,
        wardId: wardId ? parseInt(wardId) : null,
        hireDate,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    msg.innerHTML = '<div class="success">Employee hired</div>';
    document.getElementById('hr-empName').value = '';
    document.getElementById('hr-empRole').value = '';
    document.getElementById('hr-empHireDate').value = '';
    await runStaffSearch();
    await loadStaffingSummary();
    await populateEmployeeDropdown();
  } catch (e) {
    msg.innerHTML = '<div class="error">' + e.message + '</div>';
  }
}

// ============================================================
// EMPLOYEE STATUS MODAL
// ============================================================
function openEmpModal(id, name, status) {
  selectedEmployeeId = id;
  document.getElementById('modalEmpName').textContent = name;
  document.getElementById('empStatusSelect').value = status;
  document.getElementById('empStatusModal').classList.add('active');
  document.getElementById('modalBackdrop').classList.add('active');
}

function closeEmpModal() {
  document.getElementById('empStatusModal').classList.remove('active');
  document.getElementById('modalBackdrop').classList.remove('active');
  selectedEmployeeId = null;
}

async function updateEmployeeStatus() {
  const status = document.getElementById('empStatusSelect').value;
  if (!selectedEmployeeId) return;

  try {
    const res = await fetch('/api/employees/' + selectedEmployeeId + '/status', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token() },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) throw new Error('Update failed');
    closeEmpModal();
    await runStaffSearch();
    await loadStaffingSummary();
  } catch (e) {
    alert(e.message);
  }
}

// ============================================================
// STAFFING SUMMARY
// ============================================================
async function loadStaffingSummary() {
  try {
    const res = await fetch('/api/employees/summary', { headers: { Authorization: 'Bearer ' + token() } });
    if (!res.ok) return;
    const s = await res.json();

    document.getElementById('hr-empOnDuty').textContent = s.active || 0;
    document.getElementById('hr-empOnLeave').textContent = s.on_leave || 0;
    document.getElementById('hr-empSick').textContent = s.sick || 0;
    document.getElementById('hr-empTerminated').textContent = s.terminated || 0;
    document.getElementById('hr-empTotal').textContent = s.total || 0;
  } catch (e) {
    console.error(e);
  }
}

// ============================================================
// CSV EXPORT - STAFF
// ============================================================
async function exportStaffCSV() {
  const params = new URLSearchParams();
  const search = document.getElementById('hr-empSearchBox').value.trim();
  const department = document.getElementById('hr-filterDept').value;
  const status = document.getElementById('hr-filterStatus').value;
  const role = document.getElementById('hr-filterRole').value.trim();
  const from = document.getElementById('hr-filterFrom').value;
  const to = document.getElementById('hr-filterTo').value;

  if (search) params.set('search', search);
  if (department && department !== 'all') params.set('department', department);
  if (status && status !== 'all') params.set('status', status);
  if (role) params.set('role', role);
  if (from) params.set('from', from);
  if (to) params.set('to', to);

  try {
    const res = await fetch('/api/employees/export?' + params, {
      headers: { Authorization: 'Bearer ' + token() },
    });
    if (!res.ok) throw new Error('Export failed');
    const blob = await res.blob();
    downloadCSV(blob, 'staff-' + new Date().toISOString().split('T')[0] + '.csv');
  } catch (e) {
    alert('Export error: ' + e.message);
  }
}

// ============================================================
// PRINT - STAFF ROSTER
// ============================================================
function printStaffRoster() {
  if (allEmployees.length === 0) {
    alert('No employees to print. Adjust your filters.');
    return;
  }

  const hospitalName = (systemSettings.hospitalName || 'Sally Mugabe Central Hospital').toUpperCase();
  const phone = systemSettings.contactPhone || '';
  const address = systemSettings.contactAddress || '';

  const now = new Date();
  const rangeLabel = 'Generated ' + fmtDateTime(now);

  const filterParts = [];
  const search = document.getElementById('hr-empSearchBox').value.trim();
  const department = document.getElementById('hr-filterDept').value;
  const status = document.getElementById('hr-filterStatus').value;
  const role = document.getElementById('hr-filterRole').value.trim();
  const from = document.getElementById('hr-filterFrom').value;
  const to = document.getElementById('hr-filterTo').value;

  if (search) filterParts.push('Search="' + search + '"');
  if (department && department !== 'all') filterParts.push('Department=' + department);
  if (status && status !== 'all') filterParts.push('Status=' + status);
  if (role) filterParts.push('Role="' + role + '"');
  if (from) filterParts.push('Hired From=' + from);
  if (to) filterParts.push('Hired To=' + to);

  const filterLine = filterParts.length > 0
    ? 'Filters: ' + filterParts.join(', ')
    : 'Filters: none (all employees)';

  let html = '<div class="print-page a4">';
  html += '<div class="print-header">';
  html += '<h1>' + escapeHtml(hospitalName) + '</h1>';
  html += '<h2>Staff Roster</h2>';
  html += '</div>';

  if (phone || address) {
    html += '<div class="print-contact">';
    if (address) html += '<p>' + escapeHtml(address) + '</p>';
    if (phone) html += '<p>Tel: ' + escapeHtml(phone) + '</p>';
    html += '</div>';
  }

  html += '<div class="print-meta">';
  html += '<p><strong>Total Employees:</strong> ' + allEmployees.length + '</p>';
  html += '<p><strong>Report Generated:</strong> ' + rangeLabel + '</p>';
  html += '<p style="grid-column: span 2;"><strong>' + escapeHtml(filterLine) + '</strong></p>';
  html += '</div>';

  html += '<table class="print-table">';
  html += '<thead><tr>';
  html += '<th>#</th><th>Name</th><th>Department</th><th>Role</th><th>Ward</th><th>Status</th><th>Hired</th>';
  html += '</tr></thead><tbody>';

  allEmployees.forEach((e, i) => {
    const wardName = e.ward ? e.ward.name : '-';
    const hireDate = e.hireDate ? fmtDate(e.hireDate) : '-';
    html += '<tr>';
    html += '<td>' + (i + 1) + '</td>';
    html += '<td>' + escapeHtml(e.name) + '</td>';
    html += '<td>' + escapeHtml(e.department) + '</td>';
    html += '<td>' + escapeHtml(e.role || '-') + '</td>';
    html += '<td>' + escapeHtml(wardName) + '</td>';
    html += '<td>' + escapeHtml(e.status) + '</td>';
    html += '<td>' + hireDate + '</td>';
    html += '</tr>';
  });

  html += '</tbody></table>';
  html += '<div class="print-footer">';
  html += escapeHtml(hospitalName) + ' - Generated ' + fmtDateTime(now);
  html += '</div>';
  html += '</div>';

  document.getElementById('printArea').innerHTML = html;
  setTimeout(() => window.print(), 200);
}

// ============================================================
// TENDERS
// ============================================================
async function submitTenderRequest(deptKey) {
  const originatorDepartment = document.getElementById(deptKey + '-reqOriginator')?.value || currentDeptName;
  const itemName = document.getElementById(deptKey + '-reqItemName').value.trim();
  const quantity = document.getElementById(deptKey + '-reqQuantity').value;
  const reason = document.getElementById(deptKey + '-reqReason').value.trim();
  const msg = document.getElementById(deptKey + '-requestMessage');

  if (!itemName || !quantity || !reason) {
    msg.innerHTML = '<div class="error">All fields required</div>';
    return;
  }

  try {
    const res = await fetch('/api/orders/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token() },
      body: JSON.stringify({ itemName, quantity: parseInt(quantity), reason, originatorDepartment }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    msg.innerHTML = '<div class="success">Request submitted</div>';
    document.getElementById(deptKey + '-reqItemName').value = '';
    document.getElementById(deptKey + '-reqQuantity').value = '';
    document.getElementById(deptKey + '-reqReason').value = '';
    await loadMyTenders();
  } catch (e) {
    msg.innerHTML = '<div class="error">' + e.message + '</div>';
  }
}

async function loadMyTenders() {
  const res = await fetch('/api/orders/my', { headers: { Authorization: 'Bearer ' + token() } });
  if (!res.ok) return;
  allTenders = await res.json();
  renderTenderTracker();
}

function setTenderFilter(btn) {
  document.querySelectorAll('#hr-tenderFilters .filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  tenderFilter = btn.dataset.filter;
  renderTenderTracker();
}

function filterTenders() { renderTenderTracker(); }

function renderTenderTracker() {
  const el = document.getElementById('hr-tenderTrackerList');
  const q = (document.getElementById('hr-tenderSearch')?.value || '').toLowerCase();

  let list = allTenders;
  if (tenderFilter !== 'all') list = list.filter(t => t.status === tenderFilter);
  if (q) list = list.filter(t => String(t.itemName).toLowerCase().includes(q));

  if (list.length === 0) {
    el.innerHTML = '<div class="empty-state">No Tenders</div>';
    return;
  }

  const myDept = String(currentDeptName || '').toLowerCase();

  el.innerHTML = list.map(t => {
    const submitter = t.requestingDepartment || '';
    const originator = t.originatorDepartment || submitter;
    const submittedByMe = String(submitter).toLowerCase() === myDept;
    const submittedForMe = String(originator).toLowerCase() === myDept;

    let meta = 'Requested by: ' + escapeHtml(submitter);
    if (!submittedByMe && submittedForMe) {
      meta = 'Requested FOR your department by ' + escapeHtml(submitter);
    } else if (submittedByMe && originator.toLowerCase() !== submitter.toLowerCase()) {
      meta = 'Submitted by you FOR ' + escapeHtml(originator);
    }

    return '<div class="tender-card">' +
      '<div class="tender-head">' +
      '<div>' +
      '<strong>#' + t.id + ' - ' + escapeHtml(t.itemName) + ' x' + t.quantity + '</strong>' +
      '<div class="muted">' + meta + '</div>' +
      '</div>' +
      '<div>' + statusBadge(t.status) + '</div>' +
      '</div>' +
      '<div class="tender-body"><p><em>Reason:</em> ' + escapeHtml(t.reason) + '</p></div>' +
      '</div>';
  }).join('');
}

async function exportMyTenders() {
  const res = await fetch('/api/orders/my/export', { headers: { Authorization: 'Bearer ' + token() } });
  if (!res.ok) return alert('Export failed');
  const blob = await res.blob();
  downloadCSV(blob, 'tenders-hr-' + new Date().toISOString().split('T')[0] + '.csv');
}

// ============================================================
// LABOUR RELATIONS - METADATA
// ============================================================
async function loadDisciplinaryMetadata() {
  try {
    const res = await fetch('/api/disciplinary/metadata', {
      headers: { Authorization: 'Bearer ' + token() },
    });
    if (!res.ok) return;
    disciplinaryMetadata = await res.json();

    const offenseSel = document.getElementById('discFilterOffense');
    if (offenseSel) {
      offenseSel.innerHTML = '<option value="all">All</option>' +
        disciplinaryMetadata.offenses.map(o => '<option value="' + escapeHtml(o) + '">' + escapeHtml(o) + '</option>').join('');
    }

    const newOffenseSel = document.getElementById('discNewOffense');
    if (newOffenseSel) {
      newOffenseSel.innerHTML = '<option value="">-- Choose offense --</option>' +
        disciplinaryMetadata.offenses.map(o => '<option value="' + escapeHtml(o) + '">' + escapeHtml(o) + '</option>').join('');
    }

    const editActionSel = document.getElementById('discEditAction');
    if (editActionSel) {
      editActionSel.innerHTML = '<option value="">-- None --</option>' +
        disciplinaryMetadata.actions.map(a => '<option value="' + escapeHtml(a) + '">' + escapeHtml(a) + '</option>').join('');
    }
  } catch (e) {
    console.error(e);
  }
}

async function loadDisciplinarySummary() {
  try {
    const res = await fetch('/api/disciplinary/summary', {
      headers: { Authorization: 'Bearer ' + token() },
    });
    if (!res.ok) return;
    const s = await res.json();

    document.getElementById('discSummaryTotal').textContent = s.total || 0;
    document.getElementById('discSummaryOpen').textContent = s.byStatus.open || 0;
    document.getElementById('discSummaryInvestigation').textContent = s.byStatus.under_investigation || 0;
    document.getElementById('discSummaryResolved').textContent = s.byStatus.resolved || 0;
    document.getElementById('discSummaryDismissed').textContent = s.byStatus.dismissed || 0;
    document.getElementById('discSummary30Days').textContent = s.last30Days || 0;
  } catch (e) {
    console.error(e);
  }
}

async function populateEmployeeDropdown() {
  try {
    const res = await fetch('/api/employees', {
      headers: { Authorization: 'Bearer ' + token() },
    });
    if (!res.ok) return;
    const employees = await res.json();

    const sel = document.getElementById('discNewEmployee');
    if (sel) {
      sel.innerHTML = '<option value="">-- Choose employee --</option>' +
        employees.map(e => '<option value="' + e.id + '">' + escapeHtml(e.name) + ' - ' + escapeHtml(e.department) + '</option>').join('');
    }
  } catch (e) {
    console.error(e);
  }
}

// ============================================================
// LABOUR RELATIONS - SEARCH + RENDER
// ============================================================
function debouncedDisciplinarySearch() {
  clearTimeout(discSearchTimer);
  discSearchTimer = setTimeout(runDisciplinarySearch, 300);
}

async function runDisciplinarySearch() {
  const params = new URLSearchParams();
  const search = document.getElementById('discSearchBox').value.trim();
  const status = document.getElementById('discFilterStatus').value;
  const offense = document.getElementById('discFilterOffense').value;
  const department = document.getElementById('discFilterDept').value;
  const from = document.getElementById('discFilterFrom').value;
  const to = document.getElementById('discFilterTo').value;

  if (search) params.set('search', search);
  if (status && status !== 'all') params.set('status', status);
  if (offense && offense !== 'all') params.set('offense', offense);
  if (department && department !== 'all') params.set('department', department);
  if (from) params.set('from', from);
  if (to) params.set('to', to);

  try {
    const res = await fetch('/api/disciplinary?' + params, {
      headers: { Authorization: 'Bearer ' + token() },
    });
    if (!res.ok) throw new Error('Failed to load cases');
    allDisciplinaryCases = await res.json();
    renderDisciplinaryCases();
  } catch (e) {
    document.getElementById('discCaseList').innerHTML = '<p class="error">' + e.message + '</p>';
  }
}

function clearDisciplinaryFilters() {
  document.getElementById('discSearchBox').value = '';
  document.getElementById('discFilterStatus').value = 'all';
  document.getElementById('discFilterOffense').value = 'all';
  document.getElementById('discFilterDept').value = 'all';
  document.getElementById('discFilterFrom').value = '';
  document.getElementById('discFilterTo').value = '';
  runDisciplinarySearch();
}

function disciplinaryStatusBadge(status) {
  const cls = 'badge-disc-' + status;
  const labels = {
    open: 'OPEN',
    under_investigation: 'INVESTIGATING',
    resolved: 'RESOLVED',
    dismissed: 'DISMISSED',
  };
  return '<span class="badge ' + cls + '">' + (labels[status] || status.toUpperCase()) + '</span>';
}

function renderDisciplinaryCases() {
  const el = document.getElementById('discCaseList');

  if (allDisciplinaryCases.length === 0) {
    el.innerHTML = '<div class="empty-state">No disciplinary cases on record</div>';
    return;
  }

  el.innerHTML = '<table class="data-table">' +
    '<thead><tr>' +
    '<th>Case #</th><th>Employee</th><th>Dept</th><th>Offense</th>' +
    '<th>Status</th><th>Reported</th><th>Action</th>' +
    '</tr></thead><tbody>' +
    allDisciplinaryCases.map(c => {
      const empName = c.employee ? c.employee.name : '-';
      const empDept = c.employee ? c.employee.department : '-';
      const reported = c.reportedDate ? fmtDate(c.reportedDate) : '-';

      return '<tr>' +
        '<td><strong>' + escapeHtml(c.caseNumber) + '</strong></td>' +
        '<td>' + escapeHtml(empName) + '</td>' +
        '<td>' + escapeHtml(empDept) + '</td>' +
        '<td>' + escapeHtml(c.offenseType) + '</td>' +
        '<td>' + disciplinaryStatusBadge(c.status) + '</td>' +
        '<td>' + reported + '</td>' +
        '<td><button class="pill-btn" onclick="openDisciplinaryDetail(' + c.id + ')">Open</button></td>' +
        '</tr>';
    }).join('') +
    '</tbody></table>';
}

async function exportDisciplinaryCSV() {
  const params = new URLSearchParams();
  const search = document.getElementById('discSearchBox').value.trim();
  const status = document.getElementById('discFilterStatus').value;
  const offense = document.getElementById('discFilterOffense').value;
  const department = document.getElementById('discFilterDept').value;
  const from = document.getElementById('discFilterFrom').value;
  const to = document.getElementById('discFilterTo').value;

  if (search) params.set('search', search);
  if (status && status !== 'all') params.set('status', status);
  if (offense && offense !== 'all') params.set('offense', offense);
  if (department && department !== 'all') params.set('department', department);
  if (from) params.set('from', from);
  if (to) params.set('to', to);

  try {
    const res = await fetch('/api/disciplinary/export?' + params, {
      headers: { Authorization: 'Bearer ' + token() },
    });
    if (!res.ok) throw new Error('Export failed');
    const blob = await res.blob();
    downloadCSV(blob, 'labour-relations-' + new Date().toISOString().split('T')[0] + '.csv');
  } catch (e) {
    alert(e.message);
  }
}

// ============================================================
// LABOUR RELATIONS - NEW CASE
// ============================================================
function openDisciplinaryNewModal() {
  document.getElementById('discNewEmployee').value = '';
  document.getElementById('discNewOffense').value = '';
  document.getElementById('discNewDescription').value = '';
  document.getElementById('discNewReportedBy').value = '';
  document.getElementById('discNewReportedDate').value = toInputDate(new Date());
  document.getElementById('discNewWitnesses').value = '';
  document.getElementById('discNewMessage').innerHTML = '';

  document.getElementById('disciplinaryNewModal').classList.add('active');
  document.getElementById('modalBackdrop').classList.add('active');
}

function closeDisciplinaryNewModal() {
  document.getElementById('disciplinaryNewModal').classList.remove('active');
  document.getElementById('modalBackdrop').classList.remove('active');
}

async function submitNewDisciplinaryCase() {
  const msg = document.getElementById('discNewMessage');
  const employeeId = document.getElementById('discNewEmployee').value;
  const offenseType = document.getElementById('discNewOffense').value;
  const description = document.getElementById('discNewDescription').value.trim();
  const reportedBy = document.getElementById('discNewReportedBy').value.trim();
  const reportedDate = document.getElementById('discNewReportedDate').value;
  const witnesses = document.getElementById('discNewWitnesses').value.trim();

  if (!employeeId || !offenseType || !description || !reportedBy || !reportedDate) {
    msg.innerHTML = '<div class="error">All required fields must be filled</div>';
    return;
  }

  try {
    const res = await fetch('/api/disciplinary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token() },
      body: JSON.stringify({ employeeId, offenseType, description, reportedBy, reportedDate, witnesses }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    msg.innerHTML = '<div class="success">Case ' + data.caseNumber + ' filed</div>';
    setTimeout(() => {
      closeDisciplinaryNewModal();
      loadDisciplinarySummary();
      runDisciplinarySearch();
    }, 900);
  } catch (e) {
    msg.innerHTML = '<div class="error">' + e.message + '</div>';
  }
}

// ============================================================
// LABOUR RELATIONS - DETAIL MODAL
// ============================================================
async function openDisciplinaryDetail(caseId) {
  try {
    const res = await fetch('/api/disciplinary/' + caseId, {
      headers: { Authorization: 'Bearer ' + token() },
    });
    if (!res.ok) throw new Error('Failed to load case');
    const c = await res.json();

    currentOpenCaseId = caseId;

    document.getElementById('discDetailTitle').textContent = c.caseNumber;
    document.getElementById('discDetailMeta').textContent =
      (c.employee ? c.employee.name + ' - ' + c.employee.department : '') +
      (c.employee && c.employee.role ? ' - ' + c.employee.role : '');

    document.getElementById('discDetailStatusRow').innerHTML =
      disciplinaryStatusBadge(c.status) +
      (c.closedBy ? '<span class="muted" style="margin-left:10px;">Closed by ' + escapeHtml(c.closedBy) + ' on ' + fmtDate(c.closedDate) + '</span>' : '') +
      (c.reopenedBy ? '<span class="muted" style="margin-left:10px;">Reopened by ' + escapeHtml(c.reopenedBy) + ' on ' + fmtDate(c.reopenedDate) + '</span>' : '');

    document.getElementById('discDetailOffense').textContent = c.offenseType;
    document.getElementById('discDetailDescription').textContent = c.description;
    document.getElementById('discDetailReportedBy').textContent = c.reportedBy;
    document.getElementById('discDetailReportedDate').textContent = fmtDate(c.reportedDate);
    document.getElementById('discDetailWitnesses').textContent = c.witnesses || 'None';

    document.getElementById('discEditAction').value = c.actionTaken || '';
    document.getElementById('discEditHearingDate').value = c.hearingDate ? toInputDate(new Date(c.hearingDate)) : '';
    document.getElementById('discEditActionDetails').value = c.actionDetails || '';
    document.getElementById('discEditHearingNotes').value = c.hearingNotes || '';
    document.getElementById('discEditEffectiveDate').value = c.effectiveDate ? toInputDate(new Date(c.effectiveDate)) : '';
    document.getElementById('discEditDuration').value = c.durationDays || '';
    document.getElementById('discEditOutcome').value = c.outcome || '';

    renderAttachments(c.attachments || []);
    renderCaseTimeline(c.statusLogs || []);

    const isClosed = c.status === 'resolved' || c.status === 'dismissed';
    document.getElementById('discSaveDetailsBtn').style.display = isClosed ? 'none' : 'inline-block';
    document.getElementById('discStatusBtn').style.display = isClosed ? 'none' : 'inline-block';
    document.getElementById('discReopenBtn').style.display = isClosed ? 'inline-block' : 'none';
    document.getElementById('discUploadZone').style.display = isClosed ? 'none' : 'block';

    document.getElementById('discDetailSaveMessage').innerHTML = '';

    document.getElementById('disciplinaryDetailModal').classList.add('active');
    document.getElementById('modalBackdrop').classList.add('active');
  } catch (e) {
    alert(e.message);
  }
}

function closeDisciplinaryDetail() {
  document.getElementById('disciplinaryDetailModal').classList.remove('active');
  document.getElementById('modalBackdrop').classList.remove('active');
  currentOpenCaseId = null;
}

async function saveDisciplinaryDetails() {
  if (!currentOpenCaseId) return;
  const msg = document.getElementById('discDetailSaveMessage');

  const payload = {
    actionTaken: document.getElementById('discEditAction').value || null,
    hearingDate: document.getElementById('discEditHearingDate').value || null,
    actionDetails: document.getElementById('discEditActionDetails').value.trim() || null,
    hearingNotes: document.getElementById('discEditHearingNotes').value.trim() || null,
    effectiveDate: document.getElementById('discEditEffectiveDate').value || null,
    durationDays: document.getElementById('discEditDuration').value || null,
    outcome: document.getElementById('discEditOutcome').value.trim() || null,
  };

  try {
    const res = await fetch('/api/disciplinary/' + currentOpenCaseId, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token() },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    msg.innerHTML = '<div class="success">Details saved</div>';
    setTimeout(() => { msg.innerHTML = ''; }, 1500);
  } catch (e) {
    msg.innerHTML = '<div class="error">' + e.message + '</div>';
  }
}

function renderCaseTimeline(logs) {
  const el = document.getElementById('discDetailTimeline');
  if (!logs || logs.length === 0) {
    el.innerHTML = '<p class="muted">No status history yet</p>';
    return;
  }

  el.innerHTML = logs.map(log =>
    '<div class="tl-item">' +
    '<span class="tl-dot"></span>' +
    '<span><strong>' + log.newStatus.toUpperCase() + '</strong> - ' +
    escapeHtml(log.changedBy) + ' - ' + fmtDateTime(log.timestamp) + '</span>' +
    (log.notes ? '<div class="muted" style="margin-left:16px;">' + escapeHtml(log.notes) + '</div>' : '') +
    '</div>'
  ).join('');
}

// ============================================================
// LABOUR RELATIONS - STATUS CHANGE
// ============================================================
function openStatusChangeOptions() {
  if (!currentOpenCaseId) return;
  document.getElementById('discStatusNewStatus').value = 'under_investigation';
  document.getElementById('discStatusNotes').value = '';
  document.getElementById('discStatusMessage').innerHTML = '';
  document.getElementById('disciplinaryStatusModal').classList.add('active');
  document.getElementById('modalBackdrop').classList.add('active');
}

function closeStatusChangeModal() {
  document.getElementById('disciplinaryStatusModal').classList.remove('active');
}

async function submitStatusChange() {
  if (!currentOpenCaseId) return;
  const msg = document.getElementById('discStatusMessage');
  const newStatus = document.getElementById('discStatusNewStatus').value;
  const notes = document.getElementById('discStatusNotes').value.trim();

  try {
    const res = await fetch('/api/disciplinary/' + currentOpenCaseId + '/status', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token() },
      body: JSON.stringify({ newStatus, notes }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    document.getElementById('disciplinaryStatusModal').classList.remove('active');
    await openDisciplinaryDetail(currentOpenCaseId);
    loadDisciplinarySummary();
    runDisciplinarySearch();
  } catch (e) {
    msg.innerHTML = '<div class="error">' + e.message + '</div>';
  }
}

// ============================================================
// LABOUR RELATIONS - REOPEN
// ============================================================
function openReopenModal() {
  if (!currentOpenCaseId) return;
  document.getElementById('discReopenReason').value = '';
  document.getElementById('discReopenStatus').value = 'under_investigation';
  document.getElementById('discReopenMessage').innerHTML = '';
  document.getElementById('disciplinaryReopenModal').classList.add('active');
  document.getElementById('modalBackdrop').classList.add('active');
}

function closeReopenModal() {
  document.getElementById('disciplinaryReopenModal').classList.remove('active');
}

async function submitReopen() {
  if (!currentOpenCaseId) return;
  const msg = document.getElementById('discReopenMessage');
  const reason = document.getElementById('discReopenReason').value.trim();
  const newStatus = document.getElementById('discReopenStatus').value;

  if (!reason) {
    msg.innerHTML = '<div class="error">Reason is required</div>';
    return;
  }

  try {
    const res = await fetch('/api/disciplinary/' + currentOpenCaseId + '/reopen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token() },
      body: JSON.stringify({ reason, newStatus }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    document.getElementById('disciplinaryReopenModal').classList.remove('active');
    await openDisciplinaryDetail(currentOpenCaseId);
    loadDisciplinarySummary();
    runDisciplinarySearch();
  } catch (e) {
    msg.innerHTML = '<div class="error">' + e.message + '</div>';
  }
}

// ============================================================
// LABOUR RELATIONS - ATTACHMENTS
// ============================================================
function renderAttachments(attachments) {
  const el = document.getElementById('discAttachList');
  document.getElementById('discAttachCount').textContent = attachments.length;

  if (attachments.length === 0) {
    el.innerHTML = '<p class="muted" style="margin-bottom:12px;">No attachments yet</p>';
    return;
  }

  el.innerHTML = attachments.map(a => {
    const sizeKb = Math.round(a.sizeBytes / 1024);
    return '<div class="disc-attach-item">' +
      '<div style="flex:1;">' +
      '<div class="disc-attach-name">' + escapeHtml(a.originalName) + '</div>' +
      '<div class="disc-attach-meta">' + sizeKb + ' KB - ' + escapeHtml(a.uploadedBy) + ' - ' + fmtDate(a.uploadedAt) + '</div>' +
      '</div>' +
      '<div class="disc-attach-actions">' +
      '<a class="pill-btn" href="/api/disciplinary/' + currentOpenCaseId + '/attachments/' + a.id + '?token=' + encodeURIComponent(token()) + '" target="_blank">View</a>' +
      '<button class="danger-btn" style="padding:6px 12px; font-size:12px;" onclick="deleteAttachment(' + a.id + ')">Delete</button>' +
      '</div>' +
      '</div>';
  }).join('');
}

function wireDisciplinaryUpload() {
  const input = document.getElementById('discAttachInput');
  if (!input) return;

  input.addEventListener('change', async () => {
    if (!currentOpenCaseId) return;
    if (!input.files || input.files.length === 0) return;

    const msg = document.getElementById('discUploadMessage');
    msg.innerHTML = 'Uploading...';

    const formData = new FormData();
    for (const file of input.files) {
      formData.append('files', file);
    }

    try {
      const res = await fetch('/api/disciplinary/' + currentOpenCaseId + '/attachments', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token() },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      msg.innerHTML = '<span style="color:var(--success);">' + data.message + '</span>';
      input.value = '';
      await openDisciplinaryDetail(currentOpenCaseId);
    } catch (e) {
      msg.innerHTML = '<span style="color:var(--error);">' + e.message + '</span>';
    }
  });
}

async function deleteAttachment(attachmentId) {
  if (!currentOpenCaseId) return;
  if (!confirm('Delete this attachment?')) return;

  try {
    const res = await fetch('/api/disciplinary/' + currentOpenCaseId + '/attachments/' + attachmentId, {
      method: 'DELETE',
      headers: { Authorization: 'Bearer ' + token() },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    await openDisciplinaryDetail(currentOpenCaseId);
  } catch (e) {
    alert(e.message);
  }
}
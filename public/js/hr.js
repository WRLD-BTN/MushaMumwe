// ============================================================
// MushaMumwe - HR Department
// ============================================================

let allEmployees = [];
let allTenders = [];
let tenderFilter = 'all';
let staffSearchTimer = null;
let selectedEmployeeId = null;

async function init_hr() {
  await loadWards();
  await runStaffSearch();
  await loadStaffingSummary();
  await loadMyTenders();
  window.onEmployeeUpdated = () => {
    runStaffSearch();
    loadStaffingSummary();
  };
  window.onOrderUpdated = (p) => {
    if (String(p?.department || '').toLowerCase() === 'hr') loadMyTenders();
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
// CSV EXPORT
// ============================================================
async function exportStaffCSV() {
  const msg = document.getElementById('hr-exportMessage');
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
    msg.innerHTML = '<div class="success">CSV downloaded</div>';
  } catch (e) {
    msg.innerHTML = '<div class="error">' + e.message + '</div>';
  }
}

// ============================================================
// TENDERS
// ============================================================
async function submitTenderRequest(deptKey) {
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
      body: JSON.stringify({ itemName, quantity: parseInt(quantity), reason }),
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

  el.innerHTML = list.map(t =>
    '<div class="tender-card">' +
    '<div class="tender-head">' +
    '<div><strong>#' + t.id + ' - ' + escapeHtml(t.itemName) + ' x' + t.quantity + '</strong></div>' +
    '<div>' + statusBadge(t.status) + '</div>' +
    '</div>' +
    '<div class="tender-body"><p><em>Reason:</em> ' + escapeHtml(t.reason) + '</p></div>' +
    '</div>'
  ).join('');
}

async function exportMyTenders() {
  const res = await fetch('/api/orders/my/export', { headers: { Authorization: 'Bearer ' + token() } });
  if (!res.ok) return alert('Export failed');
  const blob = await res.blob();
  downloadCSV(blob, 'tenders-hr-' + new Date().toISOString().split('T')[0] + '.csv');
}
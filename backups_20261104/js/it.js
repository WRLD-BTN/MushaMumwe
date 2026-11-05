// ============================================================
// Sally Mugabe Central Hospital - IT Department
// ============================================================

let allUsers = [];
let allTenders = [];
let tenderFilter = 'all';

async function init_it() {
  await loadSystemStatus();
  await loadUserList();
  await loadMyTenders();

  window.onOrderUpdated = (payload) => {
    const myDept = String(currentDeptName || '').toLowerCase();
    const sub  = String(payload?.department || '').toLowerCase();
    const orig = String(payload?.originator || '').toLowerCase();
    if (sub === myDept || orig === myDept) loadMyTenders();
  };
}

// ============================================================
// TENDER SUBMISSION
// ============================================================
async function submitITTender() {
  const originatorDepartment = document.getElementById('it-reqOriginator').value;
  const itemName = document.getElementById('it-reqItemName').value.trim();
  const quantity = document.getElementById('it-reqQuantity').value;
  const reason = document.getElementById('it-reqReason').value.trim();
  const msg = document.getElementById('it-requestMessage');

  if (!itemName || !quantity || !reason) {
    msg.innerHTML = '<span style="color: var(--error);">All fields required</span>';
    return;
  }

  const btn = document.querySelector('button[onclick="submitITTender()"]');
  if (btn && btn.disabled) return;
  if (btn) { btn.disabled = true; btn.textContent = 'Submitting...'; }

  try {
    const res = await fetch('/api/orders/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token() },
      body: JSON.stringify({ itemName, quantity: parseInt(quantity), reason, originatorDepartment }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    msg.innerHTML = '<span style="color: var(--success);">Request submitted</span>';
    document.getElementById('it-reqItemName').value = '';
    document.getElementById('it-reqQuantity').value = '';
    document.getElementById('it-reqReason').value = '';
    await loadMyTenders();
  } catch (e) {
    msg.innerHTML = '<span style="color: var(--error);">' + e.message + '</span>';
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Submit Request'; }
  }
}

// ============================================================
// USER MANAGEMENT
// ============================================================
async function createUser() {
  const username = document.getElementById('it-newUsername').value.trim();
  const fullName = document.getElementById('it-newUserFullName').value.trim();
  const department = document.getElementById('it-newUserDept').value;
  const msg = document.getElementById('it-createUserMessage');

  if (!username || !fullName) { msg.innerHTML = '<div class="error">All fields required</div>'; return; }

  try {
    const res = await fetch('/api/auth/admin/create-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token() },
      body: JSON.stringify({ username, fullName, department }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    msg.innerHTML = '<div class="success">User <strong>' + escapeHtml(data.user.username) + '</strong> created<br>Temp Password: <code>' + data.tempPassword + '</code></div>';
    document.getElementById('it-newUsername').value = '';
    document.getElementById('it-newUserFullName').value = '';
    await loadUserList();
  } catch (e) {
    msg.innerHTML = '<div class="error">' + e.message + '</div>';
  }
}

async function loadUserList() {
  try {
    const res = await fetch('/api/auth/admin/users', { headers: { Authorization: 'Bearer ' + token() } });
    if (!res.ok) throw new Error('Failed');
    allUsers = await res.json();
    renderUserList();
  } catch (e) {
    document.getElementById('it-userList').innerHTML = '<p class="error">' + e.message + '</p>';
  }
}

function renderUserList() {
  const el = document.getElementById('it-userList');
  const q = (document.getElementById('it-userSearch')?.value || '').toLowerCase();
  const filtered = q ? allUsers.filter(u => u.username.toLowerCase().includes(q) || u.fullName.toLowerCase().includes(q) || u.department.toLowerCase().includes(q)) : allUsers;

  if (filtered.length === 0) { el.innerHTML = '<p class="muted">No users</p>'; return; }

  el.innerHTML = '<table class="data-table"><thead><tr><th>Username</th><th>Full Name</th><th>Department</th><th>Role</th><th>Action</th></tr></thead><tbody>' +
    filtered.map(u => '<tr><td>' + escapeHtml(u.username) + '</td><td>' + escapeHtml(u.fullName) + '</td><td><span class="dept-pill">' + escapeHtml(u.department) + '</span></td><td>' + escapeHtml(u.role) + '</td><td><button class="pill-btn" onclick="resetUserPassword(' + u.id + ', \'' + u.username + '\')">Reset Password</button></td></tr>').join('') +
    '</tbody></table>';
}

function filterUserList() { renderUserList(); }

async function resetUserPassword(userId, username) {
  if (!confirm('Reset password for "' + username + '"?')) return;
  try {
    const res = await fetch('/api/auth/admin/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token() },
      body: JSON.stringify({ userId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    alert('New temporary password:\n' + data.tempPassword);
  } catch (e) {
    alert('Error: ' + e.message);
  }
}

async function loadSystemStatus() {
  try {
    const res = await fetch('/api/auth/system-status', { headers: { Authorization: 'Bearer ' + token() } });
    if (!res.ok) return;
    const data = await res.json();
    document.getElementById('it-totalUsers').textContent = data.totalUsers;
  } catch (e) {}
}

// ============================================================
// TENDERS — LOAD
// ============================================================
async function loadMyTenders() {
  try {
    const res = await fetch('/api/orders/my', { headers: { Authorization: 'Bearer ' + token() } });
    if (!res.ok) return;
    allTenders = await res.json();
    renderTenderTracker();
  } catch (e) {
    console.error('Failed to load tenders:', e);
  }
}

// ============================================================
// TENDERS — FILTERS
// ============================================================
function setTenderFilter(btn) {
  const bar = btn.closest('.tender-filters, .filter-bar');
  if (bar) bar.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  tenderFilter = btn.dataset.filter;
  renderTenderTracker();
}

function filterTenders() {
  renderTenderTracker();
}

// ============================================================
// TENDERS — RENDER (honors status filter + search)
// ============================================================
function renderTenderTracker() {
  const el = document.getElementById('it-tenderTrackerList');
  if (!el) return;

  const q = (document.getElementById('it-tenderSearch')?.value || '').trim().toLowerCase();

  let list = allTenders;

  if (tenderFilter !== 'all') {
    if (tenderFilter === 'received') {
      list = list.filter(t => t.status === 'received' || t.status === 'in_storage');
    } else {
      list = list.filter(t => t.status === tenderFilter);
    }
  }

  if (q) {
    list = list.filter(t =>
      String(t.itemName || '').toLowerCase().includes(q) ||
      String(t.reason || '').toLowerCase().includes(q) ||
      String(t.requestingBy || '').toLowerCase().includes(q) ||
      String(t.requestingDepartment || '').toLowerCase().includes(q) ||
      String(t.originatorDepartment || '').toLowerCase().includes(q) ||
      String(t.id).includes(q)
    );
  }

  const countEl = document.getElementById('it-tenderResultCount');
  if (countEl) {
    const bits = [];
    if (tenderFilter !== 'all') bits.push('status=' + tenderFilter.replace('_', ' '));
    if (q) bits.push('search="' + q + '"');
    const desc = bits.length ? ' (filters: ' + bits.join(', ') + ')' : ' (no filters - showing all)';
    countEl.textContent = list.length + ' tender' + (list.length === 1 ? '' : 's') + desc;
  }

  if (list.length === 0) {
    el.innerHTML = '<div class="empty-state">No Tenders</div>';
    return;
  }

  el.innerHTML = list.map(t => {
    const submitter  = t.requestingDepartment || '';
    const originator = t.originatorDepartment || submitter;
    let meta = 'Requested by: ' + escapeHtml(t.requestingBy || '-');
    if (submitter.toLowerCase() !== originator.toLowerCase()) {
      meta += ' <span class="muted">(submitted by ' + escapeHtml(submitter) + ' for ' + escapeHtml(originator) + ')</span>';
    }

    const supplier = t.procurementOrder && t.procurementOrder.supplierName
      ? '<p><em>Supplier:</em> ' + escapeHtml(t.procurementOrder.supplierName) + '</p>'
      : '';

    return '<div class="tender-card">' +
      '<div class="tender-head">' +
      '<div>' +
      '<strong>#' + t.id + ' - ' + escapeHtml(t.itemName) + ' x' + t.quantity + '</strong>' +
      '<div class="muted">' + meta + ' - ' + fmtDate(t.createdAt) + '</div>' +
      '</div>' +
      '<div>' + statusBadge(t.status) + '</div>' +
      '</div>' +
      '<div class="tender-body">' +
      '<p><em>Reason:</em> ' + escapeHtml(t.reason) + '</p>' +
      supplier +
      '</div>' +
      '</div>';
  }).join('');
}

// ============================================================
// PRINT
// ============================================================
function printMyTenders() {
  if (allTenders.length === 0) { alert('No tenders to print.'); return; }
  const hospitalName = (systemSettings.hospitalName || 'Sally Mugabe Central Hospital').toUpperCase();
  const now = new Date();
  let html = '<div class="print-page a4"><div class="print-header"><h1>' + escapeHtml(hospitalName) + '</h1><h2>IT Department Tenders</h2></div>';
  html += '<div class="print-meta"><p><strong>Total:</strong> ' + allTenders.length + '</p><p><strong>Generated:</strong> ' + fmtDateTime(now) + '</p></div>';
  html += '<table class="print-table"><thead><tr><th>#</th><th>Item</th><th>Qty</th><th>Status</th><th>Date</th></tr></thead><tbody>';
  allTenders.forEach((t, i) => {
    html += '<tr><td>' + (i + 1) + '</td><td>' + escapeHtml(t.itemName) + '</td><td>' + t.quantity + '</td><td>' + String(t.status).toUpperCase() + '</td><td>' + fmtDate(t.createdAt) + '</td></tr>';
  });
  html += '</tbody></table><div class="print-footer">' + escapeHtml(hospitalName) + ' - Generated ' + fmtDateTime(now) + '</div></div>';
  printContent(html);
}
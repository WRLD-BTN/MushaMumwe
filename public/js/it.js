// ============================================================
// MushaMumwe - IT Department
// ============================================================

let allUsers = [];
let allTenders = [];
let tenderFilter = 'all';

async function init_it() {
  await loadSystemStatus();
  await loadUserList();
  await loadMyTenders();
  window.onOrderUpdated = (p) => {
    if (String(p?.department || '').toLowerCase() === 'it') loadMyTenders();
  };
}

// ============================================================
// USER MANAGEMENT
// ============================================================
async function createUser() {
  const username = document.getElementById('it-newUsername').value.trim();
  const fullName = document.getElementById('it-newUserFullName').value.trim();
  const department = document.getElementById('it-newUserDept').value;
  const msg = document.getElementById('it-createUserMessage');

  if (!username || !fullName) {
    msg.innerHTML = '<div class="error">All fields required</div>';
    return;
  }

  try {
    const res = await fetch('/api/auth/admin/create-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token() },
      body: JSON.stringify({ username, fullName, department }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    msg.innerHTML = '<div class="success">User <strong>' + escapeHtml(data.user.username) +
      '</strong> created<br>Temp Password: <code>' + data.tempPassword + '</code></div>';
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

  const filtered = q
    ? allUsers.filter(u =>
        u.username.toLowerCase().includes(q) ||
        u.fullName.toLowerCase().includes(q) ||
        u.department.toLowerCase().includes(q))
    : allUsers;

  if (filtered.length === 0) {
    el.innerHTML = '<p class="muted">No users</p>';
    return;
  }

  el.innerHTML = '<table class="data-table">' +
    '<thead><tr>' +
    '<th>Username</th><th>Full Name</th><th>Department</th><th>Role</th><th>Action</th>' +
    '</tr></thead><tbody>' +
    filtered.map(u =>
      '<tr>' +
      '<td>' + escapeHtml(u.username) + '</td>' +
      '<td>' + escapeHtml(u.fullName) + '</td>' +
      '<td><span class="dept-pill">' + escapeHtml(u.department) + '</span></td>' +
      '<td>' + escapeHtml(u.role) + '</td>' +
      '<td><button class="pill-btn" onclick="resetUserPassword(' + u.id + ', \'' + u.username + '\')">Reset Password</button></td>' +
      '</tr>'
    ).join('') +
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
  document.querySelectorAll('#it-tenderFilters .filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  tenderFilter = btn.dataset.filter;
  renderTenderTracker();
}

function filterTenders() { renderTenderTracker(); }

function renderTenderTracker() {
  const el = document.getElementById('it-tenderTrackerList');
  const q = (document.getElementById('it-tenderSearch')?.value || '').toLowerCase();

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
  downloadCSV(blob, 'tenders-it-' + new Date().toISOString().split('T')[0] + '.csv');
}
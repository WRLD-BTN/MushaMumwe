// ============================================================
// Sally Mugabe Central Hospital - IT Department
// ============================================================

let allUsers = [];

// ============================================================
// TAB SWITCHING
// ============================================================
function switchITTab(btn, tabId) {
  const tabs = btn.parentElement.querySelectorAll('.dept-tab');
  tabs.forEach(t => t.classList.remove('active'));
  btn.classList.add('active');

  const panels = document.querySelectorAll('.portal[data-dept="IT"] .proc-tab-panel');
  panels.forEach(p => p.style.display = 'none');

  const target = document.getElementById(tabId);
  if (target) target.style.display = 'block';
}

// ============================================================
// INIT
// ============================================================
async function init_it() {
  await loadSystemStatus();
  await loadUserList();
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

  if (filtered.length === 0) { 
    el.innerHTML = '<div class="empty-state">No users match</div>'; 
    return; 
  }

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
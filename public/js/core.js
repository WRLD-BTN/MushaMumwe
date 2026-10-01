// ============================================================
// Sally Mugabe Central Hospital - Core shared module
// Authentication, routing, socket, modals, helpers, settings
// ============================================================

const socket = io();
let currentUser = null;
let currentDeptKey = null;
let currentDeptName = null;
let systemSettings = {
  hospitalName: 'Sally Mugabe Central Hospital',
  hospitalSubtitle: 'Department Dashboard',
  contactPhone: '',
  contactAddress: '',
};

function token() { return localStorage.getItem('token'); }

const DEPT_MAP = {
  Nurses:      { key: 'nurses', fragment: 'portals/nurses.html',      script: 'js/nurses.js' },
  IT:          { key: 'it',     fragment: 'portals/it.html',          script: 'js/it.js' },
  Procurement: { key: 'proc',   fragment: 'portals/procurement.html', script: 'js/procurement.js' },
  Stores:      { key: 'stores', fragment: 'portals/stores.html',      script: 'js/stores.js' },
  HR:          { key: 'hr',     fragment: 'portals/hr.html',          script: 'js/hr.js' },
  SuperAdmin:  { key: 'super',  fragment: 'portals/superadmin.html',  script: 'js/superadmin.js' },
};

// ============================================================
// SYSTEM SETTINGS - load and apply
// ============================================================
async function loadSystemSettings() {
  try {
    const res = await fetch('/api/settings/public');
    if (!res.ok) return;
    const data = await res.json();
    systemSettings = {
      hospitalName: data.hospitalName || 'Sally Mugabe Central Hospital',
      hospitalSubtitle: data.hospitalSubtitle || 'Department Dashboard',
      contactPhone: data.contactPhone || '',
      contactAddress: data.contactAddress || '',
    };
    applySettingsToShell();
  } catch (e) {
    console.error('Failed to load settings:', e);
  }
}

function applySettingsToShell() {
  const title = document.getElementById('appTitle');
  const subtitle = document.getElementById('appSubtitle');
  if (title) title.textContent = systemSettings.hospitalName;
  if (subtitle) subtitle.textContent = systemSettings.hospitalSubtitle;
  document.title = systemSettings.hospitalName + ' - Dashboard';
}

// ============================================================
// AUTH
// ============================================================
async function login() {
  const dept = document.getElementById('department').value;
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;

  if (!username || !password) {
    return showLoginError('Username and password required');
  }

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, department: dept }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login failed');

    localStorage.setItem('token', data.token);
    currentUser = data.user;
    currentDeptName = data.user.department;
    currentDeptKey = DEPT_MAP[currentDeptName]?.key;

    await loadPortal(currentDeptName);
  } catch (e) {
    showLoginError(e.message);
  }
}

function showLoginError(msg) {
  const el = document.getElementById('loginError');
  el.textContent = msg;
  el.style.display = 'block';
}

async function loadPortal(deptName) {
  const dept = DEPT_MAP[deptName];
  if (!dept) return showLoginError('Unknown department');

  try {
    const htmlRes = await fetch(dept.fragment);
    if (!htmlRes.ok) throw new Error('Could not load ' + dept.fragment);
    const html = await htmlRes.text();
    document.getElementById('portalContainer').innerHTML = html;

    await loadScript(dept.script);

    document.getElementById('login').style.display = 'none';
    document.getElementById('headerUser').style.display = 'flex';
    document.getElementById('headerUserLabel').textContent =
      currentUser.fullName + ' (' + currentDeptName + ')';

    // Super Admin gets no Change Password button (password in .env)
    const btnOwnPwd = document.getElementById('btnOwnPwd');
    const btnBackHome = document.getElementById('btnBackHome');
    if (currentDeptName === 'SuperAdmin') {
      btnOwnPwd.style.display = 'none';
      btnBackHome.style.display = 'inline-block';
    } else {
      btnOwnPwd.style.display = 'inline-block';
      btnBackHome.style.display = 'none';
    }

    const initFn = window['init_' + dept.key];
    if (typeof initFn === 'function') initFn();
  } catch (e) {
    showLoginError(e.message);
  }
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector('script[src="' + src + '"]')) return resolve();
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error('Failed to load ' + src));
    document.body.appendChild(s);
  });
}

function logout() {
  localStorage.removeItem('token');
  location.reload();
}

// ============================================================
// SUPER ADMIN - Load a portal from the launcher
// ============================================================
async function openPortalAsSuperAdmin(deptName) {
  // Update the current "department context" so portal-specific logic works
  currentDeptName = deptName;
  currentDeptKey = DEPT_MAP[deptName]?.key;

  // Swap the portal content
  await loadPortal(deptName);

  // Update the header to reflect acting-as dept
  document.getElementById('headerUserLabel').textContent =
    'Super Admin (acting as ' + deptName + ')';
}

function backToSuperAdminHome() {
  currentDeptName = 'SuperAdmin';
  currentDeptKey = 'super';
  loadPortal('SuperAdmin');
}

// ============================================================
// OWN PASSWORD MODAL
// ============================================================
function openOwnPasswordModal() {
  if (currentDeptName === 'SuperAdmin') {
    alert('Super Admin password is managed in server configuration.');
    return;
  }
  document.getElementById('ownPwdModal').classList.add('active');
  document.getElementById('modalBackdrop').classList.add('active');
  document.getElementById('ownCurrentPwd').value = '';
  document.getElementById('ownNewPwd').value = '';
  document.getElementById('ownPwdMessage').innerHTML = '';
}

function closeOwnPasswordModal() {
  document.getElementById('ownPwdModal').classList.remove('active');
  document.getElementById('modalBackdrop').classList.remove('active');
}

function closeAllModals() {
  document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
  document.getElementById('modalBackdrop').classList.remove('active');
}

async function changeOwnPassword() {
  const currentPassword = document.getElementById('ownCurrentPwd').value;
  const newPassword = document.getElementById('ownNewPwd').value;
  const msg = document.getElementById('ownPwdMessage');

  if (!currentPassword || !newPassword) {
    msg.innerHTML = '<div class="error">Both fields required</div>';
    return;
  }
  if (newPassword.length < 6) {
    msg.innerHTML = '<div class="error">Minimum 6 characters</div>';
    return;
  }

  try {
    const res = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token() },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed');
    msg.innerHTML = '<div class="success">Password updated</div>';
    setTimeout(closeOwnPasswordModal, 1200);
  } catch (e) {
    msg.innerHTML = '<div class="error">' + e.message + '</div>';
  }
}

// ============================================================
// SYSTEM SETTINGS MODAL (Super Admin only)
// ============================================================
async function openSettingsModal() {
  if (currentDeptName !== 'SuperAdmin') return;

  document.getElementById('settingsModal').classList.add('active');
  document.getElementById('modalBackdrop').classList.add('active');
  document.getElementById('settingsMessage').innerHTML = '';

  try {
    const res = await fetch('/api/settings/admin', {
      headers: { Authorization: 'Bearer ' + token() },
    });
    if (!res.ok) throw new Error('Failed to load settings');
    const data = await res.json();

    document.getElementById('settingsHospitalName').value = data.hospital_name || '';
    document.getElementById('settingsSubtitle').value = data.hospital_subtitle || '';
    document.getElementById('settingsPhone').value = data.contact_phone || '';
    document.getElementById('settingsAddress').value = data.contact_address || '';
  } catch (e) {
    document.getElementById('settingsMessage').innerHTML = '<div class="error">' + e.message + '</div>';
  }
}

function closeSettingsModal() {
  document.getElementById('settingsModal').classList.remove('active');
  document.getElementById('modalBackdrop').classList.remove('active');
}

async function saveSystemSettings() {
  const msg = document.getElementById('settingsMessage');
  const payload = {
    hospital_name: document.getElementById('settingsHospitalName').value.trim(),
    hospital_subtitle: document.getElementById('settingsSubtitle').value.trim(),
    contact_phone: document.getElementById('settingsPhone').value.trim(),
    contact_address: document.getElementById('settingsAddress').value.trim(),
  };

  if (!payload.hospital_name) {
    msg.innerHTML = '<div class="error">Hospital name is required</div>';
    return;
  }

  try {
    const res = await fetch('/api/settings/admin', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token() },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed');

    // Update local cache + shell UI
    systemSettings.hospitalName = payload.hospital_name;
    systemSettings.hospitalSubtitle = payload.hospital_subtitle;
    systemSettings.contactPhone = payload.contact_phone;
    systemSettings.contactAddress = payload.contact_address;
    applySettingsToShell();

    msg.innerHTML = '<div class="success">Settings saved</div>';
    setTimeout(closeSettingsModal, 1000);
  } catch (e) {
    msg.innerHTML = '<div class="error">' + e.message + '</div>';
  }
}

// ============================================================
// SHARED HELPERS
// ============================================================
function statusBadge(status) {
  const map = {
    pending: 'badge-pending',
    approved: 'badge-approved',
    rejected: 'badge-rejected',
    ordered: 'badge-ordered',
    received: 'badge-received',
    in_storage: 'badge-received',
  };
  const cls = map[status] || 'badge-pending';
  return '<span class="badge ' + cls + '">' + String(status).toUpperCase() + '</span>';
}

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function fmtDate(d) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('en-GB');
}

function fmtDateTime(d) {
  if (!d) return '-';
  return new Date(d).toLocaleString('en-GB');
}

function downloadCSV(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ============================================================
// SOCKET DISPATCH
// ============================================================
socket.on('patient:updated', (p) => window.onPatientUpdated?.(p));
socket.on('patient:created', (p) => window.onPatientCreated?.(p));
socket.on('order:updated', (p) => window.onOrderUpdated?.(p));
socket.on('order:created', (p) => window.onOrderCreated?.(p));
socket.on('inventory:updated', (p) => window.onInventoryUpdated?.(p));
socket.on('employee:updated', (p) => window.onEmployeeUpdated?.(p));

// ============================================================
// LOGIN - ENTER KEY SUPPORT (password field only)
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  loadSystemSettings();

  const pwd = document.getElementById('password');
  if (pwd) {
    pwd.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        login();
      }
    });
  }
});
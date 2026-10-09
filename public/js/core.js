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
  Nurses:      { key: 'nurses', fragment: 'portals/nurses.html',      script: 'js/nurses.js',      url: '/nurses' },
  IT:          { key: 'it',     fragment: 'portals/it.html',          script: 'js/it.js',          url: '/it' },
  Procurement: { key: 'proc',   fragment: 'portals/procurement.html', script: 'js/procurement.js', url: '/procurement' },
  Stores:      { key: 'stores', fragment: 'portals/stores.html',      script: 'js/stores.js',      url: '/stores' },
  HR:          { key: 'hr',     fragment: 'portals/hr.html',          script: 'js/hr.js',          url: '/hr' },
  SuperAdmin:  { key: 'super',  fragment: 'portals/superadmin.html',  script: 'js/superadmin.js',  url: '/admin' },
};

// Map URL paths -> dept names (for auto-load on refresh)
const URL_TO_DEPT = {
  '/dashboard': null,
  '/portal': null,
  '/login': null,
  '/nurses': 'Nurses',
  '/it': 'IT',
  '/procurement': 'Procurement',
  '/stores': 'Stores',
  '/hr': 'HR',
  '/admin': 'SuperAdmin',
};

// ============================================================
// SYSTEM SETTINGS
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
// URL SYNC
// ============================================================
function setURL(path, replace = false) {
  try {
    if (replace) {
      window.history.replaceState({}, '', path);
    } else {
      window.history.pushState({}, '', path);
    }
  } catch (e) {
    console.warn('Could not update URL:', e);
  }
}

function getDeptFromURL() {
  const path = window.location.pathname;
  return URL_TO_DEPT[path] || null;
}

// ============================================================
// AUTH
// ============================================================
async function login() {
  const dept = document.getElementById('department').value;
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;

  const isSuperAdminAttempt = username === 'Admin';

  if (!username || !password) {
    return showLoginError('Username and password required');
  }

  if (!isSuperAdminAttempt && !dept) {
    return showLoginError('Please select a department');
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

function updateLoginButton() {
  const dept = document.getElementById('department').value;
  const btn = document.getElementById('loginBtn');
  if (btn) btn.disabled = !dept;
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

    const btnOwnPwd = document.getElementById('btnOwnPwd');
    const btnBackHome = document.getElementById('btnBackHome');
    if (currentDeptName === 'SuperAdmin') {
      btnOwnPwd.style.display = 'none';
      btnBackHome.style.display = 'inline-block';
    } else {
      btnOwnPwd.style.display = 'inline-block';
      btnBackHome.style.display = 'none';
    }

    // Update URL
    setURL(dept.url);

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
  window.location.href = '/dashboard';
}

// ============================================================
// SUPER ADMIN
// ============================================================
async function openPortalAsSuperAdmin(deptName) {
  currentDeptName = deptName;
  currentDeptKey = DEPT_MAP[deptName]?.key;

  await loadPortal(deptName);

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
// SYSTEM SETTINGS MODAL
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
    awaiting_quotation: 'badge-awaiting_quotation',
    ordered: 'badge-ordered',
    received: 'badge-received',
    in_storage: 'badge-received',
  };
  const cls = map[status] || 'badge-pending';
  return '<span class="badge ' + cls + '">' + String(status).toUpperCase().replace('_', ' ') + '</span>';
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

function toInputDate(d) {
  const dt = d instanceof Date ? d : new Date(d);
  const yyyy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return yyyy + '-' + mm + '-' + dd;
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
// GENERIC PRINT HELPER
// ============================================================
function printContent(html) {
  const area = document.getElementById('printArea');
  if (!area) {
    console.error('printArea element not found');
    return;
  }
  area.innerHTML = html;
  setTimeout(() => {
    window.print();
    // Clear print area after the dialog closes
    setTimeout(() => { area.innerHTML = ''; }, 500);
  }, 200);
}

function buildPrintHeader(title, filterLine, totalLabel) {
  const hospitalName = (systemSettings.hospitalName || 'Sally Mugabe Central Hospital').toUpperCase();
  const phone = systemSettings.contactPhone || '';
  const address = systemSettings.contactAddress || '';

  let html = '<div class="print-header">';
  html += '<h1>' + escapeHtml(hospitalName) + '</h1>';
  html += '<h2>' + escapeHtml(title) + '</h2>';
  html += '</div>';

  if (phone || address) {
    html += '<div class="print-contact">';
    if (address) html += '<p>' + escapeHtml(address) + '</p>';
    if (phone) html += '<p>Tel: ' + escapeHtml(phone) + '</p>';
    html += '</div>';
  }

  html += '<div class="print-meta">';
  if (totalLabel) html += '<p><strong>' + escapeHtml(totalLabel) + '</strong></p>';
  html += '<p><strong>Generated:</strong> ' + fmtDateTime(new Date()) + '</p>';
  if (filterLine) html += '<p style="grid-column: span 2;"><strong>' + escapeHtml(filterLine) + '</strong></p>';
  html += '</div>';

  return html;
}

function buildPrintFooter() {
  const hospitalName = (systemSettings.hospitalName || 'Sally Mugabe Central Hospital').toUpperCase();
  return '<div class="print-footer">' + escapeHtml(hospitalName) + ' - Generated ' + fmtDateTime(new Date()) + '</div>';
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
socket.on('disciplinary:created', (p) => window.onDisciplinaryUpdated?.(p));
socket.on('disciplinary:updated', (p) => window.onDisciplinaryUpdated?.(p));

// ============================================================
// AUTO-LOGIN FROM URL
// ============================================================
async function tryAutoLogin() {
  const t = token();
  if (!t) return false;

  try {
    const res = await fetch('/api/auth/me', {
      headers: { Authorization: 'Bearer ' + t },
    });
    if (!res.ok) return false;
    const user = await res.json();
    currentUser = user;
    currentDeptName = user.department;
    currentDeptKey = DEPT_MAP[currentDeptName]?.key;
    return true;
  } catch (e) {
    return false;
  }
}

// ============================================================
// INIT
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
  loadSystemSettings();
  updateLoginButton();

  const pwd = document.getElementById('password');
  if (pwd) {
    pwd.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        login();
      }
    });
  }

  // If logged in, auto-load the portal (based on URL or last used dept)
  const urlDept = getDeptFromURL();
  if (urlDept) {
    const ok = await tryAutoLogin();
    if (ok) {
      // If URL says /hr but user is HR, load HR. If mismatch, load user's actual dept.
      const targetDept = (urlDept === currentUser.department || currentUser.department === 'SuperAdmin')
        ? urlDept
        : currentUser.department;
      await loadPortal(targetDept);
    }
  }
});
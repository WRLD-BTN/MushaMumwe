let allIncidents = [];
let allGateLogs = [];

async function init_security() {
  await loadSecurityData();
}

async function loadSecurityData() {
  await Promise.all([
    loadIncidents(),
    loadGateLogs()
  ]);
}

function switchSecTab(btn, tabId) {
  const tabs = btn.parentElement.querySelectorAll('.dept-tab');
  tabs.forEach(t => t.classList.remove('active'));
  btn.classList.add('active');

  const panels = document.querySelectorAll('.portal[data-dept="Security"] .proc-tab-panel');
  panels.forEach(p => p.style.display = 'none');

  const target = document.getElementById(tabId);
  if (target) target.style.display = 'block';
}

// ============================================================
// INCIDENTS
// ============================================================
async function loadIncidents() {
  try {
    const res = await fetch('/api/security/incidents', { headers: { Authorization: 'Bearer ' + token() } });
    if (!res.ok) return;
    allIncidents = await res.json();
    
    const open = allIncidents.filter(i => i.status === 'open').length;
    const resolved = allIncidents.filter(i => i.status === 'resolved').length;
    document.getElementById('sec-incidentCount').textContent = open;
    document.getElementById('sec-resolvedCount').textContent = resolved;
    
    renderIncidents();
  } catch (e) { console.error(e); }
}

function renderIncidents() {
  const el = document.getElementById('sec-incidentList');
  const q = (document.getElementById('sec-incSearch')?.value || '').toLowerCase();
  
  let filtered = allIncidents;
  if (q) {
    filtered = allIncidents.filter(i => 
      String(i.type || '').toLowerCase().includes(q) ||
      String(i.location || '').toLowerCase().includes(q) ||
      String(i.description || '').toLowerCase().includes(q)
    );
  }

  if (filtered.length === 0) {
    el.innerHTML = '<div class="empty-state">No incidents recorded</div>';
    return;
  }

  el.innerHTML = '<table class="data-table"><thead><tr><th>Type</th><th>Location</th><th>Severity</th><th>Status</th><th>Date</th><th>Action</th></tr></thead><tbody>' +
    filtered.map(i => {
      const sevClass = {
        low: 'status-ok',
        medium: 'status-low',
        high: 'status-critical'
      }[i.severity] || 'status-ok';
      
      const statusClass = i.status === 'open' ? 'badge-pending' : i.status === 'resolved' ? 'badge-received' : 'badge-ordered';

      return '<tr>' +
        '<td><strong>' + escapeHtml(i.type) + '</strong></td>' +
        '<td>' + escapeHtml(i.location) + '</td>' +
        '<td><span class="status-pill ' + sevClass + '">' + i.severity.toUpperCase() + '</span></td>' +
        '<td><span class="badge ' + statusClass + '">' + i.status.toUpperCase() + '</span></td>' +
        '<td>' + fmtDate(i.createdAt) + '</td>' +
        '<td>' + (i.status === 'open' ? '<button class="pill-btn" onclick="resolveIncident(' + i.id + ')">Resolve</button>' : '-') + '</td>' +
        '</tr>';
    }).join('') + '</tbody></table>';
}

function filterIncidents() { renderIncidents(); }

async function submitIncident() {
  const type = document.getElementById('sec-incType').value;
  const location = document.getElementById('sec-incLocation').value.trim();
  const severity = document.getElementById('sec-incSeverity').value;
  const description = document.getElementById('sec-incDescription').value.trim();
  const msg = document.getElementById('sec-incMessage');

  if (!location || !description) {
    msg.innerHTML = '<span style="color: var(--error);">Location and description required</span>';
    return;
  }

  try {
    const res = await fetch('/api/security/incidents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token() },
      body: JSON.stringify({ type, location, description, severity }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    msg.innerHTML = '<span style="color: var(--success);">Incident filed</span>';
    document.getElementById('sec-incLocation').value = '';
    document.getElementById('sec-incDescription').value = '';
    await loadIncidents();
    setTimeout(() => { msg.innerHTML = ''; }, 3000);
  } catch (e) {
    msg.innerHTML = '<span style="color: var(--error);">' + e.message + '</span>';
  }
}

async function resolveIncident(id) {
  if (!confirm('Mark this incident as resolved?')) return;
  try {
    await fetch('/api/security/incidents/' + id + '/status', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token() },
      body: JSON.stringify({ status: 'resolved' })
    });
    await loadIncidents();
  } catch (e) {
    alert(e.message);
  }
}

// ============================================================
// GATE LOGS
// ============================================================
async function loadGateLogs() {
  try {
    const res = await fetch('/api/security/gatelogs', { headers: { Authorization: 'Bearer ' + token() } });
    if (!res.ok) return;
    allGateLogs = await res.json();
    
    const active = allGateLogs.filter(g => !g.timeOut).length;
    document.getElementById('sec-gateCount').textContent = active;
    
    renderGateLogs();
  } catch (e) { console.error(e); }
}

function renderGateLogs() {
  const el = document.getElementById('sec-gateList');
  const q = (document.getElementById('sec-gateSearch')?.value || '').toLowerCase();
  
  let filtered = allGateLogs;
  if (q) {
    filtered = allGateLogs.filter(g => 
      String(g.name || '').toLowerCase().includes(q) ||
      String(g.idNumber || '').toLowerCase().includes(q) ||
      String(g.purpose || '').toLowerCase().includes(q)
    );
  }

  if (filtered.length === 0) {
    el.innerHTML = '<div class="empty-state">No gate logs recorded</div>';
    return;
  }

  el.innerHTML = '<table class="data-table"><thead><tr><th>Name</th><th>ID</th><th>Purpose</th><th>In</th><th>Out</th><th>Action</th></tr></thead><tbody>' +
    filtered.map(g => {
      const inTime = new Date(g.timeIn).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
      const outTime = g.timeOut ? new Date(g.timeOut).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '-';
      
      return '<tr>' +
        '<td><strong>' + escapeHtml(g.name) + '</strong></td>' +
        '<td>' + escapeHtml(g.idNumber) + '</td>' +
        '<td>' + escapeHtml(g.purpose) + '</td>' +
        '<td>' + inTime + '</td>' +
        '<td>' + outTime + '</td>' +
        '<td>' + (!g.timeOut ? '<button class="pill-btn" onclick="logGateOut(' + g.id + ')">Log Out</button>' : '-') + '</td>' +
        '</tr>';
    }).join('') + '</tbody></table>';
}

function filterGateLogs() { renderGateLogs(); }

async function submitGateLog() {
  const name = document.getElementById('sec-gateName').value.trim();
  const idNumber = document.getElementById('sec-gateId').value.trim();
  const purpose = document.getElementById('sec-gatePurpose').value.trim();
  const msg = document.getElementById('sec-gateMessage');

  if (!name || !idNumber || !purpose) {
    msg.innerHTML = '<span style="color: var(--error);">All fields required</span>';
    return;
  }

  try {
    const res = await fetch('/api/security/gatelogs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token() },
      body: JSON.stringify({ name, idNumber, purpose }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    msg.innerHTML = '<span style="color: var(--success);">Entry logged</span>';
    document.getElementById('sec-gateName').value = '';
    document.getElementById('sec-gateId').value = '';
    document.getElementById('sec-gatePurpose').value = '';
    await loadGateLogs();
    setTimeout(() => { msg.innerHTML = ''; }, 3000);
  } catch (e) {
    msg.innerHTML = '<span style="color: var(--error);">' + e.message + '</span>';
  }
}

async function logGateOut(id) {
  if (!confirm('Log this visitor out?')) return;
  try {
    await fetch('/api/security/gatelogs/' + id + '/out', {
      method: 'PATCH',
      headers: { Authorization: 'Bearer ' + token() }
    });
    await loadGateLogs();
  } catch (e) {
    alert(e.message);
  }
}

// ============================================================
// PRINT
// ============================================================
function printIncidents() {
  if (allIncidents.length === 0) { alert('No incidents to print.'); return; }
  const hospitalName = (systemSettings.hospitalName || 'Hospital').toUpperCase();
  const now = new Date();
  
  let html = '<div class="print-page a4">';
  html += '<div class="print-header"><h1>' + escapeHtml(hospitalName) + '</h1><h2>Security Incident Report</h2></div>';
  html += '<div class="print-meta"><p><strong>Total:</strong> ' + allIncidents.length + '</p><p><strong>Generated:</strong> ' + fmtDateTime(now) + '</p></div>';
  html += '<table class="print-table"><thead><tr><th>#</th><th>Type</th><th>Location</th><th>Severity</th><th>Status</th><th>Reported By</th><th>Date</th></tr></thead><tbody>';
  
  allIncidents.forEach((i, idx) => {
    html += '<tr><td>' + (idx + 1) + '</td><td>' + escapeHtml(i.type) + '</td><td>' + escapeHtml(i.location) + '</td><td>' + i.severity.toUpperCase() + '</td><td>' + i.status.toUpperCase() + '</td><td>' + escapeHtml(i.reportedBy) + '</td><td>' + fmtDate(i.createdAt) + '</td></tr>';
  });
  
  html += '</tbody></table><div class="print-footer">' + escapeHtml(hospitalName) + ' - Generated ' + fmtDateTime(now) + '</div></div>';
  printContent(html);
}

function printGateLogs() {
  if (allGateLogs.length === 0) { alert('No gate logs to print.'); return; }
  const hospitalName = (systemSettings.hospitalName || 'Hospital').toUpperCase();
  const now = new Date();
  
  let html = '<div class="print-page a4">';
  html += '<div class="print-header"><h1>' + escapeHtml(hospitalName) + '</h1><h2>Gate Access Log</h2></div>';
  html += '<div class="print-meta"><p><strong>Total:</strong> ' + allGateLogs.length + '</p><p><strong>Generated:</strong> ' + fmtDateTime(now) + '</p></div>';
  html += '<table class="print-table"><thead><tr><th>#</th><th>Name</th><th>ID</th><th>Purpose</th><th>Time In</th><th>Time Out</th><th>Logged By</th></tr></thead><tbody>';
  
  allGateLogs.forEach((g, idx) => {
    html += '<tr><td>' + (idx + 1) + '</td><td>' + escapeHtml(g.name) + '</td><td>' + escapeHtml(g.idNumber) + '</td><td>' + escapeHtml(g.purpose) + '</td><td>' + fmtDateTime(g.timeIn) + '</td><td>' + (g.timeOut ? fmtDateTime(g.timeOut) : '-') + '</td><td>' + escapeHtml(g.loggedBy) + '</td></tr>';
  });
  
  html += '</tbody></table><div class="print-footer">' + escapeHtml(hospitalName) + ' - Generated ' + fmtDateTime(now) + '</div></div>';
  printContent(html);
}
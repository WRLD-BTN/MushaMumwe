// ============================================================
// Sally Mugabe Central Hospital - Radiography Department
// ============================================================

let allScans = [];
let allPatients = [];
let selectedPatient = null;
let radStatusFilter = 'all';
let radDateRange = 'today';

async function init_radiography() {
  await loadPatients();
  await setRadDate('today');
  window.onRadiographyUpdated = () => loadScans();
  
  // Close patient search dropdown when clicking outside
  document.addEventListener('click', (e) => {
    const results = document.getElementById('rad-patientResults');
    const searchBox = document.getElementById('rad-patientSearch');
    if (results && searchBox && !results.contains(e.target) && e.target !== searchBox) {
      results.style.display = 'none';
    }
  });
}

// ============================================================
// PATIENT SEARCH (Live Dropdown)
// ============================================================
async function loadPatients() {
  try {
    const res = await fetch('/api/radiography/patients', { headers: { Authorization: 'Bearer ' + token() } });
    if (!res.ok) return;
    allPatients = await res.json();
  } catch (e) { console.error(e); }
}

function searchPatients() {
  const q = (document.getElementById('rad-patientSearch')?.value || '').toLowerCase();
  const resultsEl = document.getElementById('rad-patientResults');
  
  if (!q) {
    resultsEl.style.display = 'none';
    return;
  }

  const filtered = allPatients.filter(p => 
    String(p.name || '').toLowerCase().includes(q) ||
    String(p.ward?.name || '').toLowerCase().includes(q)
  ).slice(0, 10);

  if (filtered.length === 0) {
    resultsEl.innerHTML = '<div style="padding: 10px 14px; color: var(--text-muted); font-size: 13px;">No patients found</div>';
  } else {
    resultsEl.innerHTML = filtered.map(p => 
      '<div onclick="selectPatient(' + p.id + ')" style="padding: 10px 14px; cursor: pointer; border-bottom: 1px solid var(--border-soft); font-size: 13px; transition: background 0.15s;" onmouseover="this.style.background=\'var(--surface-alt)\'" onmouseout="this.style.background=\'\'">' +
      '<strong>' + escapeHtml(p.name) + '</strong>' +
      '<span class="muted" style="margin-left: 8px;">' + escapeHtml(p.ward?.name || '-') + '</span>' +
      '</div>'
    ).join('');
  }
  
  resultsEl.style.display = 'block';
}

function showPatientResults() {
  const q = (document.getElementById('rad-patientSearch')?.value || '').toLowerCase();
  if (q) searchPatients();
}

function selectPatient(id) {
  const p = allPatients.find(x => x.id === id);
  if (!p) return;

  selectedPatient = p;
  document.getElementById('rad-patientSearch').value = p.name;
  document.getElementById('rad-patientResults').style.display = 'none';
  
  const chip = document.getElementById('rad-selectedPatient');
  chip.style.display = 'block';
  chip.innerHTML = '✓ Selected: ' + escapeHtml(p.name) + ' (' + escapeHtml(p.ward?.name || '-') + ') <span onclick="clearSelectedPatient()" style="float: right; cursor: pointer; color: var(--error);">✕</span>';
}

function clearSelectedPatient() {
  selectedPatient = null;
  document.getElementById('rad-patientSearch').value = '';
  document.getElementById('rad-selectedPatient').style.display = 'none';
}

// ============================================================
// DATE FILTER
// ============================================================
function toInputDate(d) {
  const dt = d instanceof Date ? d : new Date(d);
  const yyyy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return yyyy + '-' + mm + '-' + dd;
}

function setRadDate(range) {
  radDateRange = range;
  
  ['today', 'week', 'month', 'all'].forEach(r => {
    const btn = document.getElementById('rad-date-' + r);
    if (btn) btn.classList.toggle('active', r === range);
  });

  const fromEl = document.getElementById('rad-from');
  const toEl = document.getElementById('rad-to');
  const now = new Date();

  if (range === 'today') {
    fromEl.value = toInputDate(now);
    toEl.value = toInputDate(now);
  } else if (range === 'week') {
    const day = now.getDay();
    const sunday = new Date(now);
    sunday.setDate(now.getDate() - day);
    fromEl.value = toInputDate(sunday);
    toEl.value = toInputDate(now);
  } else if (range === 'month') {
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    fromEl.value = toInputDate(first);
    toEl.value = toInputDate(now);
  } else if (range === 'all') {
    fromEl.value = '';
    toEl.value = '';
  }

  loadScans();
}

// ============================================================
// LOAD & RENDER SCANS
// ============================================================
async function loadScans() {
  try {
    const from = document.getElementById('rad-from').value;
    const to = document.getElementById('rad-to').value;
    
    let url = '/api/radiography/scans';
    if (from && to) url += `?from=${from}&to=${to}`;

    const res = await fetch(url, { headers: { Authorization: 'Bearer ' + token() } });
    if (!res.ok) return;
    allScans = await res.json();
    
    const pending = allScans.filter(s => s.status === 'pending').length;
    const inProgress = allScans.filter(s => s.status === 'in_progress').length;
    const completed = allScans.filter(s => s.status === 'completed').length;
    
    document.getElementById('rad-pendingCount').textContent = pending;
    document.getElementById('rad-inProgressCount').textContent = inProgress;
    document.getElementById('rad-completedCount').textContent = completed;
    
    renderScans();
  } catch (e) { console.error(e); }
}

function renderScans() {
  const el = document.getElementById('rad-scanList');
  if (!el) return;

  const q = (document.getElementById('rad-scanSearch')?.value || '').toLowerCase();
  
  let filtered = allScans;
  if (radStatusFilter !== 'all') filtered = filtered.filter(s => s.status === radStatusFilter);
  if (q) filtered = filtered.filter(s => String(s.patient?.name || '').toLowerCase().includes(q));

  if (filtered.length === 0) {
    el.innerHTML = '<div class="empty-state">No scan requests match</div>';
    return;
  }

  el.innerHTML = '<table class="data-table"><thead><tr><th>Patient</th><th>Scan Type</th><th>Requested By</th><th>Status</th><th>Date</th><th>Action</th></tr></thead><tbody>' +
    filtered.map(s => {
      const statusCls = {
        pending: 'badge-pending',
        in_progress: 'badge-ordered',
        completed: 'badge-received'
      }[s.status] || 'badge-pending';

      const typeCls = {
        'X-Ray': 'status-low',
        'CT Scan': 'status-critical',
        'MRI': 'status-low',
        'Ultrasound': 'status-ok',
        'ECG': 'status-ok'
      }[s.scanType] || 'status-ok';
      
      let actions = '';
      if (s.status === 'pending') actions = '<button class="pill-btn" onclick="updateScanStatus(' + s.id + ', \'in_progress\')">Start</button>';
      if (s.status === 'in_progress') actions = '<button class="success-btn" style="padding:4px 10px; font-size:11px;" onclick="updateScanStatus(' + s.id + ', \'completed\')">Complete</button>';
      
      return '<tr>' +
        '<td><strong>' + escapeHtml(s.patient?.name || '-') + '</strong></td>' +
        '<td><span class="status-pill ' + typeCls + '">' + escapeHtml(s.scanType) + '</span></td>' +
        '<td>' + escapeHtml(s.requestedBy) + '</td>' +
        '<td><span class="badge ' + statusCls + '">' + s.status.replace('_', ' ').toUpperCase() + '</span></td>' +
        '<td>' + fmtDate(s.createdAt) + '</td>' +
        '<td>' + actions + '</td>' +
        '</tr>';
    }).join('') + '</tbody></table>';
}

function setRadFilter(btn) {
  const bar = document.getElementById('rad-scanFilters');
  if (bar) bar.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  radStatusFilter = btn.dataset.filter;
  renderScans();
}

// ============================================================
// SUBMIT NEW SCAN REQUEST
// ============================================================
async function submitScanRequest() {
  const scanType = document.getElementById('rad-scanType').value;
  const notes = document.getElementById('rad-notes').value.trim();
  const msg = document.getElementById('rad-requestMessage');

  if (!selectedPatient) {
    msg.innerHTML = '<span style="color: var(--error);">Please search and select a patient</span>';
    return;
  }

  try {
    const res = await fetch('/api/radiography/scans', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token() },
      body: JSON.stringify({ patientId: selectedPatient.id, scanType, notes }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    msg.innerHTML = '<span style="color: var(--success);">Scan request submitted</span>';
    clearSelectedPatient();
    document.getElementById('rad-notes').value = '';
    await loadScans();
    setTimeout(() => { msg.innerHTML = ''; }, 3000);
  } catch (e) {
    msg.innerHTML = '<span style="color: var(--error);">' + e.message + '</span>';
  }
}

async function updateScanStatus(id, status) {
  try {
    await fetch('/api/radiography/scans/' + id + '/status', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token() },
      body: JSON.stringify({ status })
    });
    await loadScans();
  } catch (e) {
    alert(e.message);
  }
}

// ============================================================
// PRINT
// ============================================================
function printScanQueue() {
  if (allScans.length === 0) { alert('No scans to print.'); return; }
  const hospitalName = (systemSettings.hospitalName || 'Hospital').toUpperCase();
  const now = new Date();
  const from = document.getElementById('rad-from').value;
  const to = document.getElementById('rad-to').value;
  
  let html = '<div class="print-page a4">';
  html += '<div class="print-header"><h1>' + escapeHtml(hospitalName) + '</h1><h2>Radiography Scan Queue</h2></div>';
  html += '<div class="print-meta">';
  if (from && to) html += '<p><strong>Period:</strong> ' + from + ' to ' + to + '</p>';
  else html += '<p><strong>Period:</strong> All Time</p>';
  html += '<p><strong>Generated:</strong> ' + fmtDateTime(now) + '</p></div>';
  html += '<table class="print-table"><thead><tr><th>#</th><th>Patient</th><th>Scan Type</th><th>Requested By</th><th>Status</th><th>Date</th></tr></thead><tbody>';
  
  allScans.forEach((s, idx) => {
    html += '<tr><td>' + (idx + 1) + '</td><td>' + escapeHtml(s.patient?.name || '-') + '</td><td>' + escapeHtml(s.scanType) + '</td><td>' + escapeHtml(s.requestedBy) + '</td><td>' + s.status.toUpperCase() + '</td><td>' + fmtDate(s.createdAt) + '</td></tr>';
  });
  
  html += '</tbody></table><div class="print-footer">' + escapeHtml(hospitalName) + ' - Generated ' + fmtDateTime(now) + '</div></div>';
  printContent(html);
}
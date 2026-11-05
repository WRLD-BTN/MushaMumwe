// ============================================================
// Sally Mugabe Central Hospital - Mortuary Department
// ============================================================

let allMortuaryRecords = [];
let morFilter = 'all';
let morDateRange = 'today';

async function init_mortuary() {
  await setMorDate('today');
  window.onMortuaryUpdated = () => loadMortuaryRecords();
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

function setMorDate(range) {
  morDateRange = range;
  
  ['today', 'week', 'month', 'all'].forEach(r => {
    const btn = document.getElementById('mor-date-' + r);
    if (btn) btn.classList.toggle('active', r === range);
  });

  const fromEl = document.getElementById('mor-from');
  const toEl = document.getElementById('mor-to');
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

  loadMortuaryRecords();
}

// ============================================================
// LOAD & RENDER
// ============================================================
async function loadMortuaryRecords() {
  const from = document.getElementById('mor-from').value;
  const to = document.getElementById('mor-to').value;
  
  try {
    let url = '/api/mortuary/records';
    if (from && to) url += `?from=${from}&to=${to}`;
    
    const res = await fetch(url, { headers: { Authorization: 'Bearer ' + token() } });
    if (!res.ok) return;
    allMortuaryRecords = await res.json();
    
    // Get current in_mortuary count (always across all time)
    const allRes = await fetch('/api/mortuary/records?status=in_mortuary', { headers: { Authorization: 'Bearer ' + token() } });
    const inMortuary = allRes.ok ? await allRes.json() : [];
    
    // Summary for the selected period
    let received = 0, released = 0;
    allMortuaryRecords.forEach(r => {
      if (r.status === 'in_mortuary') received++;
      if (r.status === 'released') released++;
    });
    
    document.getElementById('mor-inPeriod').textContent = received;
    document.getElementById('mor-releasedPeriod').textContent = released;
    document.getElementById('mor-current').textContent = inMortuary.length;
    
    renderMortuaryRecords();
  } catch (e) { console.error(e); }
}

function renderMortuaryRecords() {
  const el = document.getElementById('mor-recordList');
  if (!el) return;

  const q = (document.getElementById('mor-search')?.value || '').toLowerCase();
  
  let filtered = allMortuaryRecords;
  if (morFilter !== 'all') filtered = filtered.filter(r => r.status === morFilter);
  if (q) filtered = filtered.filter(r => 
    String(r.patientName).toLowerCase().includes(q) ||
    String(r.bodyId).toLowerCase().includes(q)
  );

  if (filtered.length === 0) {
    el.innerHTML = '<div class="empty-state">No mortuary records match</div>';
    return;
  }

  el.innerHTML = '<table class="data-table"><thead><tr><th>Body ID</th><th>Name</th><th>Cause</th><th>Status</th><th>Date</th><th>Action</th></tr></thead><tbody>' +
    filtered.map(r => {
      const statusCls = r.status === 'in_mortuary' ? 'badge-pending' : 'badge-received';
      const statusLabel = r.status === 'in_mortuary' ? 'IN MORTUARY' : 'RELEASED';
      
      let action = '';
      if (r.status === 'in_mortuary') {
        action = '<button class="success-btn" style="padding:4px 10px; font-size:11px;" onclick="openReleaseModal(' + r.id + ')">Release</button>';
      }
      
      return '<tr>' +
        '<td><strong style="font-family: monospace; font-size: 11px;">' + escapeHtml(r.bodyId) + '</strong></td>' +
        '<td>' + escapeHtml(r.patientName) + '</td>' +
        '<td>' + escapeHtml(r.causeOfDeath) + '</td>' +
        '<td><span class="badge ' + statusCls + '">' + statusLabel + '</span></td>' +
        '<td>' + fmtDate(r.dateOfDeath) + '</td>' +
        '<td>' + action + '</td>' +
        '</tr>';
    }).join('') + '</tbody></table>';
}

function setMorFilter(btn) {
  const bar = document.getElementById('mor-filters');
  if (bar) bar.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  morFilter = btn.dataset.filter;
  renderMortuaryRecords();
}

// ============================================================
// SUBMIT INTAKE
// ============================================================
async function submitMortuaryIntake() {
  const patientName = document.getElementById('mor-patientName').value.trim();
  const age = document.getElementById('mor-age').value;
  const gender = document.getElementById('mor-gender').value;
  const dateOfDeath = document.getElementById('mor-dateOfDeath').value;
  const causeOfDeath = document.getElementById('mor-causeOfDeath').value.trim();
  const nextOfKin = document.getElementById('mor-nextOfKin').value.trim();
  const contactPhone = document.getElementById('mor-contactPhone').value.trim();
  const msg = document.getElementById('mor-intakeMessage');

  if (!patientName || !dateOfDeath || !causeOfDeath) {
    msg.innerHTML = '<span style="color: var(--error);">Name, date of death, and cause required</span>';
    return;
  }

  try {
    const res = await fetch('/api/mortuary/records', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token() },
      body: JSON.stringify({ patientName, age, gender, dateOfDeath, causeOfDeath, nextOfKin, contactPhone }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    msg.innerHTML = '<span style="color: var(--success);">Body received — ID: ' + data.bodyId + '</span>';
    document.getElementById('mor-patientName').value = '';
    document.getElementById('mor-age').value = '';
    document.getElementById('mor-gender').value = '';
    document.getElementById('mor-dateOfDeath').value = '';
    document.getElementById('mor-causeOfDeath').value = '';
    document.getElementById('mor-nextOfKin').value = '';
    document.getElementById('mor-contactPhone').value = '';
    
    await loadMortuaryRecords();
    setTimeout(() => { msg.innerHTML = ''; }, 4000);
  } catch (e) {
    msg.innerHTML = '<span style="color: var(--error);">' + e.message + '</span>';
  }
}

// ============================================================
// RELEASE MODAL
// ============================================================
function openReleaseModal(recordId) {
  if (!document.getElementById('releaseRecordId')) {
    const f = document.createElement('input');
    f.type = 'hidden';
    f.id = 'releaseRecordId';
    document.body.appendChild(f);
  }
  
  const record = allMortuaryRecords.find(r => r.id === recordId);
  if (!record) return;
  
  document.getElementById('releaseRecordId').value = recordId;
  document.getElementById('releaseLabel').textContent = record.bodyId + ' — ' + record.patientName;
  document.getElementById('releaseTo').value = '';
  document.getElementById('releaseNotes').value = '';
  document.getElementById('releaseMessage').innerHTML = '';
  
  document.getElementById('mortuaryReleaseModal').classList.add('active');
  document.getElementById('modalBackdrop').classList.add('active');
}

function closeReleaseModal() {
  document.getElementById('mortuaryReleaseModal').classList.remove('active');
  document.getElementById('modalBackdrop').classList.remove('active');
}

async function confirmRelease() {
  const id = document.getElementById('releaseRecordId').value;
  const releasedTo = document.getElementById('releaseTo').value.trim();
  const releaseNotes = document.getElementById('releaseNotes').value.trim();
  const msg = document.getElementById('releaseMessage');

  if (!releasedTo) {
    msg.innerHTML = '<span style="color: var(--error);">Released to is required</span>';
    return;
  }

  try {
    const res = await fetch('/api/mortuary/records/' + id + '/release', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token() },
      body: JSON.stringify({ releasedTo, releaseNotes }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    closeReleaseModal();
    await loadMortuaryRecords();
  } catch (e) {
    msg.innerHTML = '<span style="color: var(--error);">' + e.message + '</span>';
  }
}

// ============================================================
// PRINT
// ============================================================
function printMortuaryRecords() {
  if (allMortuaryRecords.length === 0) { alert('No records to print.'); return; }
  const hospitalName = (systemSettings.hospitalName || 'Hospital').toUpperCase();
  const now = new Date();
  const from = document.getElementById('mor-from').value;
  const to = document.getElementById('mor-to').value;
  
  let html = '<div class="print-page a4">';
  html += '<div class="print-header"><h1>' + escapeHtml(hospitalName) + '</h1><h2>Mortuary Records</h2></div>';
  html += '<div class="print-meta">';
  if (from && to) html += '<p><strong>Period:</strong> ' + from + ' to ' + to + '</p>';
  else html += '<p><strong>Period:</strong> All Time</p>';
  html += '<p><strong>Total:</strong> ' + allMortuaryRecords.length + '</p>';
  html += '<p><strong>Generated:</strong> ' + fmtDateTime(now) + '</p></div>';
  html += '<table class="print-table"><thead><tr><th>#</th><th>Body ID</th><th>Name</th><th>Cause</th><th>Status</th><th>Date of Death</th><th>Released To</th></tr></thead><tbody>';
  
  allMortuaryRecords.forEach((r, idx) => {
    html += '<tr><td>' + (idx + 1) + '</td><td>' + escapeHtml(r.bodyId) + '</td><td>' + escapeHtml(r.patientName) + '</td><td>' + escapeHtml(r.causeOfDeath) + '</td><td>' + r.status.toUpperCase() + '</td><td>' + fmtDate(r.dateOfDeath) + '</td><td>' + escapeHtml(r.releasedTo || '-') + '</td></tr>';
  });
  
  html += '</tbody></table><div class="print-footer">' + escapeHtml(hospitalName) + ' - Generated ' + fmtDateTime(now) + '</div></div>';
  printContent(html);
}
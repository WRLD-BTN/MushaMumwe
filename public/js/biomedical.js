// ============================================================
// Sally Mugabe Central Hospital - Biomedical Equipment
// ============================================================

let allEquipment = [];
let bioFilter = 'all';
let currentEquipmentId = null;

async function init_biomedical() {
  await loadEquipment();
  await loadSummary();
  window.onBiomedicalUpdated = () => { loadEquipment(); loadSummary(); };
}

// ============================================================
// LOAD EQUIPMENT
// ============================================================
async function loadEquipment() {
  try {
    const res = await fetch('/api/biomedical/equipment', { headers: { Authorization: 'Bearer ' + token() } });
    if (!res.ok) return;
    allEquipment = await res.json();
    renderEquipment();
  } catch (e) { console.error(e); }
}

async function loadSummary() {
  try {
    const res = await fetch('/api/biomedical/summary', { headers: { Authorization: 'Bearer ' + token() } });
    if (!res.ok) return;
    const s = await res.json();
    
    document.getElementById('bio-total').textContent = s.total;
    document.getElementById('bio-operational').textContent = s.operational;
    document.getElementById('bio-maintenance').textContent = s.maintenance;
    document.getElementById('bio-outOfOrder').textContent = s.outOfOrder;
  } catch (e) { console.error(e); }
}

function renderEquipment() {
  const el = document.getElementById('bio-equipmentList');
  if (!el) return;

  const q = (document.getElementById('bio-search')?.value || '').toLowerCase();
  
  let filtered = allEquipment;
  if (bioFilter !== 'all') filtered = filtered.filter(e => e.status === bioFilter);
  if (q) filtered = filtered.filter(e =>
    String(e.name).toLowerCase().includes(q) ||
    String(e.equipmentId).toLowerCase().includes(q) ||
    String(e.location).toLowerCase().includes(q)
  );

  if (filtered.length === 0) {
    el.innerHTML = '<div class="empty-state">No equipment matches</div>';
    return;
  }

  el.innerHTML = '<table class="data-table"><thead><tr><th>ID</th><th>Name</th><th>Location</th><th>Status</th><th>Last Service</th><th>Action</th></tr></thead><tbody>' +
    filtered.map(e => {
      const statusCls = {
        operational: 'status-ok',
        maintenance: 'status-low',
        out_of_order: 'status-critical'
      }[e.status] || 'status-ok';
      
      const lastService = e.lastServiced ? fmtDate(e.lastServiced) : '-';
      
      return '<tr>' +
        '<td><strong style="font-family: monospace; font-size: 11px;">' + escapeHtml(e.equipmentId) + '</strong></td>' +
        '<td>' + escapeHtml(e.name) + '</td>' +
        '<td>' + escapeHtml(e.location) + '</td>' +
        '<td><span class="status-pill ' + statusCls + '">' + e.status.replace('_', ' ').toUpperCase() + '</span></td>' +
        '<td>' + lastService + '</td>' +
        '<td><button class="pill-btn" onclick="openBioLogModal(' + e.id + ')">Log</button></td>' +
        '</tr>';
    }).join('') + '</tbody></table>';
}

function setBioFilter(btn) {
  const bar = document.getElementById('bio-statusFilters');
  if (bar) bar.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  bioFilter = btn.dataset.filter;
  renderEquipment();
}

// ============================================================
// REGISTER EQUIPMENT
// ============================================================
async function registerEquipment() {
  const name = document.getElementById('bio-name').value.trim();
  const category = document.getElementById('bio-category').value;
  const location = document.getElementById('bio-location').value;
  const lastServiced = document.getElementById('bio-lastServiced').value;
  const nextService = document.getElementById('bio-nextService').value;
  const notes = document.getElementById('bio-notes').value.trim();
  const msg = document.getElementById('bio-registerMessage');

  if (!name) {
    msg.innerHTML = '<span style="color: var(--error);">Equipment name required</span>';
    return;
  }

  try {
    const res = await fetch('/api/biomedical/equipment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token() },
      body: JSON.stringify({ name, category, location, lastServiced, nextService, notes }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    msg.innerHTML = '<span style="color: var(--success);">Equipment ' + data.equipmentId + ' registered</span>';
    document.getElementById('bio-name').value = '';
    document.getElementById('bio-notes').value = '';
    document.getElementById('bio-lastServiced').value = '';
    document.getElementById('bio-nextService').value = '';
    
    await loadEquipment();
    await loadSummary();
    setTimeout(() => { msg.innerHTML = ''; }, 4000);
  } catch (e) {
    msg.innerHTML = '<span style="color: var(--error);">' + e.message + '</span>';
  }
}

// ============================================================
// MAINTENANCE LOG MODAL
// ============================================================
function openBioLogModal(id) {
  const equipment = allEquipment.find(e => e.id === id);
  if (!equipment) return;
  
  currentEquipmentId = id;
  document.getElementById('bioLogEquipmentName').textContent = equipment.name;
  document.getElementById('bioLogEquipmentId').textContent = equipment.equipmentId + ' — ' + equipment.location;
  document.getElementById('bio-logType').value = 'routine';
  document.getElementById('bio-logDescription').value = '';
  document.getElementById('bio-logPerformedBy').value = '';
  document.getElementById('bio-logCost').value = '';
  document.getElementById('bio-logStatusAfter').value = '';
  document.getElementById('bio-logMessage').innerHTML = '';
  
  document.getElementById('bioLogModal').classList.add('active');
  document.getElementById('modalBackdrop').classList.add('active');
  
  loadEquipmentLogs(id);
}

function closeBioLogModal() {
  document.getElementById('bioLogModal').classList.remove('active');
  document.getElementById('modalBackdrop').classList.remove('active');
  currentEquipmentId = null;
}

async function loadEquipmentLogs(id) {
  try {
    const res = await fetch('/api/biomedical/equipment/' + id + '/logs', { headers: { Authorization: 'Bearer ' + token() } });
    if (!res.ok) return;
    const logs = await res.json();
    
    const el = document.getElementById('bio-logsList');
    if (logs.length === 0) {
      el.innerHTML = '<p class="muted" style="font-size: 12px; padding: 8px;">No maintenance logs yet</p>';
      return;
    }
    
    el.innerHTML = logs.map(l => 
      '<div style="padding: 8px 0; border-bottom: 1px solid var(--border-soft); font-size: 12px;">' +
      '<div style="display: flex; justify-content: space-between; margin-bottom: 4px;">' +
      '<strong>' + l.logType.toUpperCase() + '</strong>' +
      '<span class="muted">' + fmtDateTime(l.loggedAt) + '</span>' +
      '</div>' +
      '<div>' + escapeHtml(l.description) + '</div>' +
      '<div class="muted" style="font-size: 11px;">By ' + escapeHtml(l.performedBy) + (l.cost ? ' — $' + l.cost.toFixed(2) : '') + '</div>' +
      '</div>'
    ).join('');
  } catch (e) { console.error(e); }
}

async function submitMaintenanceLog() {
  if (!currentEquipmentId) return;
  
  const logType = document.getElementById('bio-logType').value;
  const description = document.getElementById('bio-logDescription').value.trim();
  const performedBy = document.getElementById('bio-logPerformedBy').value.trim();
  const cost = document.getElementById('bio-logCost').value;
  const statusAfter = document.getElementById('bio-logStatusAfter').value;
  const msg = document.getElementById('bio-logMessage');

  if (!description || !performedBy) {
    msg.innerHTML = '<span style="color: var(--error);">Description and performed by required</span>';
    return;
  }

  try {
    const res = await fetch('/api/biomedical/equipment/' + currentEquipmentId + '/logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token() },
      body: JSON.stringify({ logType, description, performedBy, cost, statusAfter }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    msg.innerHTML = '<span style="color: var(--success);">Log added</span>';
    document.getElementById('bio-logDescription').value = '';
    document.getElementById('bio-logPerformedBy').value = '';
    document.getElementById('bio-logCost').value = '';
    document.getElementById('bio-logStatusAfter').value = '';
    
    await loadEquipmentLogs(currentEquipmentId);
    await loadEquipment();
    await loadSummary();
    
    setTimeout(() => { msg.innerHTML = ''; }, 3000);
  } catch (e) {
    msg.innerHTML = '<span style="color: var(--error);">' + e.message + '</span>';
  }
}

// ============================================================
// PRINT
// ============================================================
function printEquipment() {
  if (allEquipment.length === 0) { alert('No equipment to print.'); return; }
  const hospitalName = (systemSettings.hospitalName || 'Hospital').toUpperCase();
  const now = new Date();
  
  let html = '<div class="print-page a4">';
  html += '<div class="print-header"><h1>' + escapeHtml(hospitalName) + '</h1><h2>Biomedical Equipment Register</h2></div>';
  html += '<div class="print-meta"><p><strong>Total Equipment:</strong> ' + allEquipment.length + '</p><p><strong>Generated:</strong> ' + fmtDateTime(now) + '</p></div>';
  html += '<table class="print-table"><thead><tr><th>#</th><th>ID</th><th>Name</th><th>Category</th><th>Location</th><th>Status</th><th>Last Service</th></tr></thead><tbody>';
  
  allEquipment.forEach((e, idx) => {
    html += '<tr><td>' + (idx + 1) + '</td><td>' + escapeHtml(e.equipmentId) + '</td><td>' + escapeHtml(e.name) + '</td><td>' + escapeHtml(e.category) + '</td><td>' + escapeHtml(e.location) + '</td><td>' + e.status.replace('_', ' ').toUpperCase() + '</td><td>' + (e.lastServiced ? fmtDate(e.lastServiced) : '-') + '</td></tr>';
  });
  
  html += '</tbody></table><div class="print-footer">' + escapeHtml(hospitalName) + ' - Generated ' + fmtDateTime(now) + '</div></div>';
  printContent(html);
}
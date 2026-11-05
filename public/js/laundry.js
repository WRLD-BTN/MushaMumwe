// ============================================================
// Sally Mugabe Central Hospital - Laundry Department
// ============================================================

let allMovements = [];
let allLauWards = [];
let allLinenTypes = ['Bed Sheets', 'Towels', 'Pillow Cases', 'Gowns', 'Blankets', 'Curtains'];
let selectedLauWard = null;
let linenBatch = [];
let lauFilter = 'all';

async function init_laundry() {
  await loadLauWards();
  await loadLaundryMovements();
  addLinenItemRow();
  window.onLaundryUpdated = () => loadLaundryMovements();

  document.addEventListener('click', (e) => {
    const wardRes = document.getElementById('lau-wardResults');
    const wardSearch = document.getElementById('lau-wardSearch');
    if (wardRes && wardSearch && !wardRes.contains(e.target) && e.target !== wardSearch) {
      wardRes.style.display = 'none';
    }
  });
}

// ============================================================
// LOAD WARDS
// ============================================================
async function loadLauWards() {
  try {
    const res = await fetch('/api/catering/wards', { headers: { Authorization: 'Bearer ' + token() } });
    if (!res.ok) return;
    allLauWards = await res.json();
  } catch (e) { console.error(e); }
}

// ============================================================
// WARD SEARCH
// ============================================================
function searchLauWards() {
  const q = (document.getElementById('lau-wardSearch')?.value || '').trim().toLowerCase();
  const resultsEl = document.getElementById('lau-wardResults');
  if (!q) { resultsEl.style.display = 'none'; return; }

  const exact = allLauWards.find(w => w.name.toLowerCase() === q);
  const partial = allLauWards.filter(w => w.name.toLowerCase().includes(q)).slice(0, 8);

  if (exact) {
    resultsEl.innerHTML = '<div onclick="selectLauWard(' + exact.id + ')" style="padding: 10px 14px; cursor: pointer; font-size: 13px; color: var(--success); font-weight: 700;">✓ ' + escapeHtml(exact.name) + '</div>';
  } else if (partial.length > 0) {
    resultsEl.innerHTML = '<div style="padding: 6px 14px; font-size: 11px; font-weight: 700; color: var(--text-muted); background: var(--surface-alt);">Did you mean?</div>' +
      partial.map(w => '<div onclick="selectLauWard(' + w.id + ')" style="padding: 10px 14px; cursor: pointer; border-bottom: 1px solid var(--border-soft); font-size: 13px;" onmouseover="this.style.background=\'var(--surface-alt)\'" onmouseout="this.style.background=\'\'">' + escapeHtml(w.name) + '</div>').join('') +
      '<div onclick="addNewLauWard(\'' + q.replace(/'/g, "\\'") + '\')" style="padding: 10px 14px; cursor: pointer; font-size: 13px; font-weight: 700; color: var(--primary); border-top: 1px solid var(--border);">➕ Add "' + escapeHtml(q) + '" as new ward</div>';
  } else {
    resultsEl.innerHTML = '<div onclick="addNewLauWard(\'' + q.replace(/'/g, "\\'") + '\')" style="padding: 10px 14px; cursor: pointer; font-size: 13px; font-weight: 700; color: var(--primary);">➕ Add "' + escapeHtml(q) + '" as new ward</div>';
  }
  resultsEl.style.display = 'block';
}

function showLauWardResults() {
  if (document.getElementById('lau-wardSearch').value.trim()) searchLauWards();
}

function selectLauWard(id) {
  const w = allLauWards.find(x => x.id === id);
  if (!w) return;
  selectedLauWard = w;
  document.getElementById('lau-wardSearch').value = w.name;
  document.getElementById('lau-wardResults').style.display = 'none';
  document.getElementById('lau-selectedWard').style.display = 'block';
  document.getElementById('lau-selectedWard').innerHTML = '✓ Ward: <strong>' + escapeHtml(w.name) + '</strong> <span onclick="clearLauWard()" style="float: right; cursor: pointer; color: var(--error);">✕</span>';
}

function clearLauWard() {
  selectedLauWard = null;
  document.getElementById('lau-wardSearch').value = '';
  document.getElementById('lau-selectedWard').style.display = 'none';
}

async function addNewLauWard(name) {
  try {
    const res = await fetch('/api/catering/wards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token() },
      body: JSON.stringify({ name: name.trim() })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    if (!allLauWards.find(w => w.id === data.id)) allLauWards.push(data);
    selectLauWard(data.id);
    document.getElementById('lau-wardResults').style.display = 'none';
  } catch (e) { alert('Failed to add ward: ' + e.message); }
}

// ============================================================
// ITEM BATCH BUILDER
// ============================================================
function addLinenItemRow() {
  const rowId = 'lrow-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);
  const container = document.getElementById('lau-itemBatchList');
  
  const row = document.createElement('div');
  row.id = rowId;
  row.style.cssText = 'display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 8px; align-items: flex-start; padding: 10px; background: var(--surface); border: 1.5px solid var(--border-soft); border-radius: var(--radius-sm);';
  
  row.innerHTML = `
    <div>
      <select class="linen-type" style="width: 100%; min-height: 38px; font-size: 12px;">
        ${allLinenTypes.map(t => '<option value="' + t + '">' + t + '</option>').join('')}
      </select>
    </div>
    <input type="number" class="linen-qty" placeholder="Qty" min="1" style="width: 100%; min-height: 38px; font-size: 12px;">
    <div style="display: flex; gap: 4px;">
      <select class="linen-condition" style="flex: 1; min-height: 38px; font-size: 11px;">
        <option value="good">Good</option>
        <option value="damaged">Damaged</option>
        <option value="lost">Lost</option>
      </select>
      <button class="danger-btn" style="padding: 8px 10px;" onclick="removeLinenRow('${rowId}')">✕</button>
    </div>
  `;
  
  container.appendChild(row);
  updateLinenBatch();
}

function removeLinenRow(rowId) {
  const row = document.getElementById(rowId);
  if (row) row.remove();
  updateLinenBatch();
}

function updateLinenBatch() {
  const rows = document.querySelectorAll('[id^="lrow-"]');
  linenBatch = [];
  rows.forEach(row => {
    const type = row.querySelector('.linen-type').value;
    const qty = parseInt(row.querySelector('.linen-qty').value);
    const condition = row.querySelector('.linen-condition').value;
    if (!type || !qty) return;
    linenBatch.push({ itemType: type, quantity: qty, condition });
  });
}

// ============================================================
// SUBMIT BATCH
// ============================================================
async function submitLinenBatch() {
  const type = document.getElementById('lau-type').value;
  const notes = document.getElementById('lau-notes').value.trim();
  const msg = document.getElementById('lau-message');

  if (!selectedLauWard) {
    msg.innerHTML = '<span style="color: var(--error);">Please select a ward</span>';
    return;
  }

  updateLinenBatch();
  if (linenBatch.length === 0) {
    msg.innerHTML = '<span style="color: var(--error);">Add at least one item with quantity</span>';
    return;
  }

  // Attach ward to each item
  const items = linenBatch.map(item => ({ ...item, ward: selectedLauWard.name }));

  try {
    const res = await fetch('/api/laundry/movements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token() },
      body: JSON.stringify({ type, items }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    msg.innerHTML = '<span style="color: var(--success);">Logged ' + data.count + ' items</span>';
    
    clearLauWard();
    document.getElementById('lau-notes').value = '';
    document.getElementById('lau-itemBatchList').innerHTML = '';
    addLinenItemRow();
    await loadLaundryMovements();
    
    setTimeout(() => { msg.innerHTML = ''; }, 4000);
  } catch (e) {
    msg.innerHTML = '<span style="color: var(--error);">' + e.message + '</span>';
  }
}

// ============================================================
// LOAD & RENDER
// ============================================================
async function loadLaundryMovements() {
  const now = new Date();
  const today = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
  
  try {
    const res = await fetch(`/api/laundry/movements?from=${today}&to=${today}`, { headers: { Authorization: 'Bearer ' + token() } });
    if (!res.ok) return;
    allMovements = await res.json();
    
    let sent = 0, received = 0, damaged = 0;
    allMovements.forEach(m => {
      if (m.type === 'sent') sent += m.quantity;
      if (m.type === 'received') received += m.quantity;
      if (m.condition === 'damaged' || m.condition === 'lost') damaged += m.quantity;
    });
    
    document.getElementById('lau-sentToday').textContent = sent;
    document.getElementById('lau-receivedToday').textContent = received;
    document.getElementById('lau-damagedToday').textContent = damaged;
    document.getElementById('lau-netBalance').textContent = received - sent;
    
    renderLauMovements();
  } catch (e) { console.error(e); }
}

function renderLauMovements() {
  const el = document.getElementById('lau-movementList');
  if (!el) return;

  const q = (document.getElementById('lau-search')?.value || '').toLowerCase();
  
  let filtered = allMovements;
  if (lauFilter === 'damaged') {
    filtered = filtered.filter(m => m.condition === 'damaged' || m.condition === 'lost');
  } else if (lauFilter !== 'all') {
    filtered = filtered.filter(m => m.type === lauFilter);
  }
  if (q) filtered = filtered.filter(m => 
    String(m.ward).toLowerCase().includes(q) || 
    String(m.itemType).toLowerCase().includes(q)
  );

  if (filtered.length === 0) {
    el.innerHTML = '<div class="empty-state">No movements recorded today</div>';
    return;
  }

  el.innerHTML = '<table class="data-table"><thead><tr><th>Type</th><th>Ward</th><th>Item</th><th>Qty</th><th>Condition</th><th>Time</th></tr></thead><tbody>' +
    filtered.map(m => {
      const typeCls = m.type === 'sent' ? 'badge-ordered' : 'badge-received';
      const typeLabel = m.type === 'sent' ? 'SENT' : 'RECEIVED';
      const condCls = {
        good: 'status-ok',
        damaged: 'status-critical',
        lost: 'status-critical'
      }[m.condition] || 'status-ok';
      const timeStr = new Date(m.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
      
      return '<tr>' +
        '<td><span class="badge ' + typeCls + '">' + typeLabel + '</span></td>' +
        '<td><strong>' + escapeHtml(m.ward) + '</strong></td>' +
        '<td>' + escapeHtml(m.itemType) + '</td>' +
        '<td><strong>' + m.quantity + '</strong></td>' +
        '<td><span class="status-pill ' + condCls + '">' + m.condition.toUpperCase() + '</span></td>' +
        '<td>' + timeStr + '</td>' +
        '</tr>';
    }).join('') + '</tbody></table>';
}

function setLauFilter(btn) {
  const bar = document.getElementById('lau-filters');
  if (bar) bar.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  lauFilter = btn.dataset.filter;
  renderLauMovements();
}

// ============================================================
// PRINT
// ============================================================
function printLauMovements() {
  if (allMovements.length === 0) { alert('No movements to print.'); return; }
  const hospitalName = (systemSettings.hospitalName || 'Hospital').toUpperCase();
  const now = new Date();
  
  let html = '<div class="print-page a4">';
  html += '<div class="print-header"><h1>' + escapeHtml(hospitalName) + '</h1><h2>Laundry Movement Report (Today)</h2></div>';
  html += '<div class="print-meta"><p><strong>Total Movements:</strong> ' + allMovements.length + '</p><p><strong>Generated:</strong> ' + fmtDateTime(now) + '</p></div>';
  html += '<table class="print-table"><thead><tr><th>#</th><th>Type</th><th>Ward</th><th>Item</th><th>Qty</th><th>Condition</th><th>Time</th></tr></thead><tbody>';
  
  allMovements.forEach((m, idx) => {
    const timeStr = new Date(m.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    html += '<tr><td>' + (idx + 1) + '</td><td>' + m.type.toUpperCase() + '</td><td>' + escapeHtml(m.ward) + '</td><td>' + escapeHtml(m.itemType) + '</td><td>' + m.quantity + '</td><td>' + m.condition.toUpperCase() + '</td><td>' + timeStr + '</td></tr>';
  });
  
  html += '</tbody></table><div class="print-footer">' + escapeHtml(hospitalName) + ' - Generated ' + fmtDateTime(now) + '</div></div>';
  printContent(html);
}
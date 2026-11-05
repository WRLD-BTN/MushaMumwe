// ============================================================
// Sally Mugabe Central Hospital - Catering Department
// ============================================================

let allDeliveries = [];
let allWards = [];
let allMealTypes = [];
let selectedWard = null;
let mealBatch = []; // Array of { mealTypeId, quantity }
let batchFilter = 'all';
let wardBlurTimer = null;

async function init_catering() {
  await Promise.all([loadWards(), loadMealTypes()]);
  await loadDeliveries();
  addMealRow(); // Start with one empty row
  window.onCateringUpdated = () => loadDeliveries();
  
  // Close dropdowns on outside click
  document.addEventListener('click', (e) => {
    const wardRes = document.getElementById('cat-wardResults');
    const wardSearch = document.getElementById('cat-wardSearch');
    if (wardRes && wardSearch && !wardRes.contains(e.target) && e.target !== wardSearch) {
      wardRes.style.display = 'none';
    }
    const mealRes = document.querySelectorAll('[id^="cat-mealResults-"]');
    mealRes.forEach(r => {
      const search = r.previousElementSibling;
      if (!r.contains(e.target) && e.target !== search) r.style.display = 'none';
    });
  });
}

// ============================================================
// LOAD WARDS & MEAL TYPES
// ============================================================
async function loadWards() {
  try {
    const res = await fetch('/api/catering/wards', { headers: { Authorization: 'Bearer ' + token() } });
    if (!res.ok) return;
    allWards = await res.json();
  } catch (e) { console.error(e); }
}

async function loadMealTypes() {
  try {
    const res = await fetch('/api/catering/meals', { headers: { Authorization: 'Bearer ' + token() } });
    if (!res.ok) return;
    allMealTypes = await res.json();
  } catch (e) { console.error(e); }
}

// ============================================================
// WARD SEARCH (with fuzzy matching)
// ============================================================
function searchWards() {
  const q = (document.getElementById('cat-wardSearch')?.value || '').trim();
  const resultsEl = document.getElementById('cat-wardResults');
  
  if (!q) { resultsEl.style.display = 'none'; return; }

  const lower = q.toLowerCase();
  const exact = allWards.find(w => w.name.toLowerCase() === lower);
  const partial = allWards.filter(w => w.name.toLowerCase().includes(lower)).slice(0, 8);

  if (exact) {
    resultsEl.innerHTML = '<div style="padding: 10px 14px; font-size: 13px; color: var(--success); font-weight: 700;">✓ ' + escapeHtml(exact.name) + ' (existing)</div>';
  } else if (partial.length > 0) {
    resultsEl.innerHTML = 
      '<div style="padding: 6px 14px; font-size: 11px; font-weight: 700; color: var(--text-muted); background: var(--surface-alt);">Did you mean one of these?</div>' +
      partial.map(w => 
        '<div onclick="selectWard(' + w.id + ')" style="padding: 10px 14px; cursor: pointer; border-bottom: 1px solid var(--border-soft); font-size: 13px;" onmouseover="this.style.background=\'var(--surface-alt)\'" onmouseout="this.style.background=\'\'">' +
        '<strong>' + escapeHtml(w.name) + '</strong>' +
        '</div>'
      ).join('') +
      '<div onclick="addNewWard(\'' + q.replace(/'/g, "\\'") + '\')" style="padding: 10px 14px; cursor: pointer; font-size: 13px; font-weight: 700; color: var(--primary); border-top: 1px solid var(--border);">➕ Add "' + escapeHtml(q) + '" as new ward</div>';
  } else {
    resultsEl.innerHTML = 
      '<div style="padding: 10px 14px; color: var(--text-muted); font-size: 13px;">No ward matches "' + escapeHtml(q) + '"</div>' +
      '<div onclick="addNewWard(\'' + q.replace(/'/g, "\\'") + '\')" style="padding: 10px 14px; cursor: pointer; font-size: 13px; font-weight: 700; color: var(--primary); border-top: 1px solid var(--border);">➕ Add "' + escapeHtml(q) + '" as new ward</div>';
  }
  
  resultsEl.style.display = 'block';
}

function showWardResults() {
  const q = (document.getElementById('cat-wardSearch')?.value || '').trim();
  if (q) searchWards();
}

function onWardBlur() {
  // Delay to allow clicking on dropdown items
  clearTimeout(wardBlurTimer);
  wardBlurTimer = setTimeout(() => {
    const q = (document.getElementById('cat-wardSearch')?.value || '').trim();
    if (!q || selectedWard) return;
    
    const lower = q.toLowerCase();
    const matches = allWards.filter(w => w.name.toLowerCase().includes(lower));
    
    if (matches.length === 0) {
      // No match at all → prompt to add
      if (confirm('"' + q + '" is not in the system. Add it as a new ward?')) {
        addNewWard(q);
      } else {
        document.getElementById('cat-wardSearch').value = '';
      }
    } else if (matches.length === 1) {
      // Single match → auto-select
      selectWard(matches[0].id);
    }
    // Multiple matches → let user pick from dropdown (do nothing on blur)
  }, 300);
}

function selectWard(id) {
  const w = allWards.find(x => x.id === id);
  if (!w) return;
  selectedWard = w;
  document.getElementById('cat-wardSearch').value = w.name;
  document.getElementById('cat-wardResults').style.display = 'none';
  document.getElementById('cat-selectedWard').style.display = 'block';
  document.getElementById('cat-selectedWard').innerHTML = '✓ Ward: <strong>' + escapeHtml(w.name) + '</strong> <span onclick="clearWard()" style="float: right; cursor: pointer; color: var(--error);">✕</span>';
}

function clearWard() {
  selectedWard = null;
  document.getElementById('cat-wardSearch').value = '';
  document.getElementById('cat-selectedWard').style.display = 'none';
}

async function addNewWard(name) {
  try {
    const res = await fetch('/api/catering/wards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token() },
      body: JSON.stringify({ name: name.trim() })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    
    // Add to local list if not there
    if (!allWards.find(w => w.id === data.id)) allWards.push(data);
    
    selectWard(data.id);
    document.getElementById('cat-wardResults').style.display = 'none';
  } catch (e) {
    alert('Failed to add ward: ' + e.message);
  }
}

// ============================================================
// MEAL BATCH BUILDER
// ============================================================
function addMealRow() {
  const rowId = 'row-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);
  const container = document.getElementById('cat-mealBatchList');
  
  const row = document.createElement('div');
  row.id = rowId;
  row.style.cssText = 'display: flex; gap: 8px; align-items: flex-start; padding: 10px; background: var(--surface); border: 1.5px solid var(--border-soft); border-radius: var(--radius-sm);';
  
  row.innerHTML = `
    <div style="flex: 1; position: relative;">
      <input type="text" class="meal-search" placeholder="Type meal (Breakfast, Lunch...)" oninput="searchMeals(this)" onfocus="showMealResults(this)" style="width: 100%;">
      <div class="meal-results" style="display: none; position: absolute; z-index: 100; top: 100%; left: 0; right: 0; background: var(--surface); border: 1.5px solid var(--border); border-top: none; border-radius: 0 0 var(--radius-sm) var(--radius-sm); max-height: 150px; overflow-y: auto; box-shadow: var(--shadow);"></div>
    </div>
    <input type="number" class="meal-qty" placeholder="Qty" min="1" style="width: 90px;" oninput="updateBatchFromDOM()">
    <button class="danger-btn" style="padding: 10px 14px; flex: 0 0 auto;" onclick="removeMealRow('${rowId}')">✕</button>
  `;
  
  container.appendChild(row);
  updateBatchFromDOM();
}

function removeMealRow(rowId) {
  const row = document.getElementById(rowId);
  if (row) row.remove();
  updateBatchFromDOM();
}

function searchMeals(inputEl) {
  const q = (inputEl.value || '').trim().toLowerCase();
  const resultsEl = inputEl.parentElement.querySelector('.meal-results');
  
  if (!q) { resultsEl.style.display = 'none'; return; }

  const exact = allMealTypes.find(m => m.name.toLowerCase() === q);
  const partial = allMealTypes.filter(m => m.name.toLowerCase().includes(q)).slice(0, 6);

  if (exact) {
    resultsEl.innerHTML = '<div onclick="selectMealType(this, ' + exact.id + ')" style="padding: 10px 14px; cursor: pointer; font-size: 13px; color: var(--success); font-weight: 700;">✓ ' + escapeHtml(exact.name) + '</div>';
  } else if (partial.length > 0) {
    resultsEl.innerHTML = partial.map(m => 
      '<div onclick="selectMealType(this, ' + m.id + ')" style="padding: 10px 14px; cursor: pointer; border-bottom: 1px solid var(--border-soft); font-size: 13px;" onmouseover="this.style.background=\'var(--surface-alt)\'" onmouseout="this.style.background=\'\'">' +
      '<strong>' + escapeHtml(m.name) + '</strong>' +
      '</div>'
    ).join('') +
    '<div onclick="addNewMealType(this, \'' + q.replace(/'/g, "\\'") + '\')" style="padding: 10px 14px; cursor: pointer; font-size: 13px; font-weight: 700; color: var(--primary); border-top: 1px solid var(--border);">➕ Add "' + escapeHtml(q) + '" as new meal</div>';
  } else {
    resultsEl.innerHTML = 
      '<div onclick="addNewMealType(this, \'' + q.replace(/'/g, "\\'") + '\')" style="padding: 10px 14px; cursor: pointer; font-size: 13px; font-weight: 700; color: var(--primary);">➕ Add "' + escapeHtml(q) + '" as new meal</div>';
  }
  
  resultsEl.style.display = 'block';
}

function showMealResults(inputEl) {
  if (inputEl.value.trim()) searchMeals(inputEl);
}

function selectMealType(btnEl, mealTypeId) {
  const row = btnEl.closest('[id^="row-"]');
  const input = row.querySelector('.meal-search');
  const meal = allMealTypes.find(m => m.id === mealTypeId);
  if (meal) input.value = meal.name;
  row.querySelector('.meal-results').style.display = 'none';
  row.querySelector('.meal-qty').focus();
  updateBatchFromDOM();
}

async function addNewMealType(btnEl, name) {
  try {
    const res = await fetch('/api/catering/meals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token() },
      body: JSON.stringify({ name: name.trim() })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    
    if (!allMealTypes.find(m => m.id === data.id)) allMealTypes.push(data);
    
    selectMealType(btnEl, data.id);
  } catch (e) {
    alert('Failed to add meal type: ' + e.message);
  }
}

function updateBatchFromDOM() {
  const rows = document.querySelectorAll('[id^="row-"]');
  mealBatch = [];
  rows.forEach(row => {
    const name = row.querySelector('.meal-search').value.trim();
    const qty = parseInt(row.querySelector('.meal-qty').value);
    if (!name || !qty) return;
    
    const meal = allMealTypes.find(m => m.name.toLowerCase() === name.toLowerCase());
    if (meal) {
      mealBatch.push({ mealTypeId: meal.id, quantity: qty });
    }
  });
}

// ============================================================
// SUBMIT BATCH
// ============================================================
async function submitBatchDelivery() {
  const notes = document.getElementById('cat-notes').value.trim();
  const msg = document.getElementById('cat-deliveryMessage');

  if (!selectedWard) {
    msg.innerHTML = '<span style="color: var(--error);">Please select a ward</span>';
    return;
  }

  updateBatchFromDOM();

  if (mealBatch.length === 0) {
    msg.innerHTML = '<span style="color: var(--error);">Add at least one meal with quantity</span>';
    return;
  }

  try {
    const res = await fetch('/api/catering/deliveries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token() },
      body: JSON.stringify({ wardId: selectedWard.id, notes, meals: mealBatch }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    msg.innerHTML = '<span style="color: var(--success);">Batch ' + data.batchId + ' logged (' + data.count + ' meals)</span>';
    
    clearWard();
    document.getElementById('cat-notes').value = '';
    document.getElementById('cat-mealBatchList').innerHTML = '';
    addMealRow();
    await loadDeliveries();
    
    setTimeout(() => { msg.innerHTML = ''; }, 4000);
  } catch (e) {
    msg.innerHTML = '<span style="color: var(--error);">' + e.message + '</span>';
  }
}

// ============================================================
// LOAD & RENDER DELIVERIES (Grouped by Batch)
// ============================================================
async function loadDeliveries() {
  const now = new Date();
  const today = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
  
  try {
    const res = await fetch(`/api/catering/deliveries?from=${today}&to=${today}`, { headers: { Authorization: 'Bearer ' + token() } });
    if (!res.ok) return;
    allDeliveries = await res.json();
    
    // Summary
    let breakfast = 0, lunch = 0, dinner = 0, total = 0;
    allDeliveries.forEach(d => {
      total += d.quantity;
      const name = (d.mealType?.name || '').toLowerCase();
      if (name.includes('breakfast')) breakfast += d.quantity;
      if (name.includes('lunch')) lunch += d.quantity;
      if (name.includes('dinner')) dinner += d.quantity;
    });
    
    document.getElementById('cat-totalMeals').textContent = total;
    document.getElementById('cat-breakfastCount').textContent = breakfast;
    document.getElementById('cat-lunchCount').textContent = lunch;
    document.getElementById('cat-dinnerCount').textContent = dinner;
    
    renderBatches();
  } catch (e) { console.error(e); }
}

function renderBatches() {
  const el = document.getElementById('cat-batchList');
  if (!el) return;

  // Group by batchId
  const batches = {};
  allDeliveries.forEach(d => {
    if (!batches[d.batchId]) {
      batches[d.batchId] = {
        batchId: d.batchId,
        ward: d.ward?.name || '-',
        time: d.createdAt,
        meals: [],
        status: d.status,
        notes: d.notes
      };
    }
    batches[d.batchId].meals.push({ name: d.mealType?.name || '-', qty: d.quantity });
    if (d.status === 'prepared') batches[d.batchId].status = 'prepared';
  });

  let batchList = Object.values(batches);
  if (batchFilter !== 'all') batchList = batchList.filter(b => b.status === batchFilter);

  if (batchList.length === 0) {
    el.innerHTML = '<div class="empty-state">No deliveries recorded today</div>';
    return;
  }

  el.innerHTML = '<table class="data-table"><thead><tr><th>Batch</th><th>Ward</th><th>Meals</th><th>Total</th><th>Status</th><th>Action</th></tr></thead><tbody>' +
    batchList.map(b => {
      const total = b.meals.reduce((s, m) => s + m.qty, 0);
      const mealsSummary = b.meals.map(m => m.name + ': ' + m.qty).join(', ');
      const timeStr = new Date(b.time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
      const statusCls = b.status === 'prepared' ? 'badge-ordered' : 'badge-received';
      
      let action = '';
      if (b.status === 'prepared') {
        action = '<button class="success-btn" style="padding:4px 10px; font-size:11px;" onclick="markBatchDelivered(\'' + b.batchId + '\')">Deliver</button>';
      }
      
      return '<tr>' +
        '<td><strong style="font-family: monospace; font-size: 11px;">' + b.batchId + '</strong><br><span class="muted" style="font-size: 10px;">' + timeStr + '</span></td>' +
        '<td>' + escapeHtml(b.ward) + '</td>' +
        '<td style="font-size: 11px;">' + escapeHtml(mealsSummary) + '</td>' +
        '<td><strong>' + total + '</strong></td>' +
        '<td><span class="badge ' + statusCls + '">' + b.status.toUpperCase() + '</span></td>' +
        '<td>' + action + '</td>' +
        '</tr>';
    }).join('') + '</tbody></table>';
}

function setBatchFilter(btn) {
  const bar = document.getElementById('cat-batchFilters');
  if (bar) bar.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  batchFilter = btn.dataset.filter;
  renderBatches();
}

async function markBatchDelivered(batchId) {
  try {
    await fetch('/api/catering/deliveries/batch/' + batchId + '/deliver', {
      method: 'PATCH',
      headers: { Authorization: 'Bearer ' + token() }
    });
    await loadDeliveries();
  } catch (e) {
    alert(e.message);
  }
}

// ============================================================
// PRINT - DELIVERY SLIPS (one slip per batch)
// ============================================================
function printDeliverySlips() {
  if (allDeliveries.length === 0) { alert('No deliveries to print.'); return; }
  
  const batches = {};
  allDeliveries.forEach(d => {
    if (!batches[d.batchId]) {
      batches[d.batchId] = {
        batchId: d.batchId,
        ward: d.ward?.name || '-',
        time: d.createdAt,
        meals: [],
        notes: d.notes
      };
    }
    batches[d.batchId].meals.push({ name: d.mealType?.name || '-', qty: d.quantity });
  });

  const hospitalName = (systemSettings.hospitalName || 'Hospital').toUpperCase();
  const now = new Date();
  
  let html = '';
  Object.values(batches).forEach((b, idx) => {
    const total = b.meals.reduce((s, m) => s + m.qty, 0);
    const timeStr = new Date(b.time).toLocaleString('en-GB');
    
    html += '<div class="print-page a4">';
    if (idx > 0) html = html.replace('<div class="print-page a4">', '<div class="print-page a4" style="page-break-before: always;">');
    html += '<div class="print-header"><h1>' + escapeHtml(hospitalName) + '</h1><h2>Meal Delivery Slip</h2></div>';
    html += '<div class="print-meta">' +
      '<p><strong>Batch:</strong> ' + escapeHtml(b.batchId) + '</p>' +
      '<p><strong>Ward:</strong> ' + escapeHtml(b.ward) + '</p>' +
      '<p><strong>Time:</strong> ' + timeStr + '</p>' +
      '<p><strong>Delivered By:</strong> Catering</p>' +
      '</div>';
    html += '<table class="print-table"><thead><tr><th>Meal</th><th>Quantity</th></tr></thead><tbody>';
    b.meals.forEach(m => {
      html += '<tr><td>' + escapeHtml(m.name) + '</td><td>' + m.qty + ' plates</td></tr>';
    });
    html += '<tr style="background:#f0f0f0; font-weight:700;"><td>TOTAL</td><td>' + total + ' plates</td></tr>';
    html += '</tbody></table>';
    if (b.notes) html += '<div class="print-section"><h3>Notes</h3><p>' + escapeHtml(b.notes) + '</p></div>';
    html += '<div class="print-signatures">' +
      '<div><span>Delivered By (Catering)</span><div class="sig-line"></div></div>' +
      '<div><span>Received By (Ward)</span><div class="sig-line"></div></div>' +
      '</div>';
    html += '<div class="print-footer">' + escapeHtml(hospitalName) + ' - Generated ' + fmtDateTime(now) + '</div>';
    html += '</div>';
  });

  printContent(html);
}

// ============================================================
// PRINT - KITCHEN PRODUCTION SHEET (one row per meal type)
// ============================================================
function printProductionSheet() {
  if (allDeliveries.length === 0) { alert('No deliveries to print.'); return; }

  // Aggregate by meal type
  const totals = {};
  allDeliveries.forEach(d => {
    const name = d.mealType?.name || '-';
    if (!totals[name]) totals[name] = 0;
    totals[name] += d.quantity;
  });

  const hospitalName = (systemSettings.hospitalName || 'Hospital').toUpperCase();
  const now = new Date();
  
  let html = '<div class="print-page a4">';
  html += '<div class="print-header"><h1>' + escapeHtml(hospitalName) + '</h1><h2>Kitchen Production Sheet</h2></div>';
  html += '<div class="print-meta"><p><strong>Date:</strong> ' + fmtDate(now) + '</p><p><strong>Generated:</strong> ' + fmtDateTime(now) + '</p></div>';
  html += '<table class="print-table"><thead><tr><th>#</th><th>Meal Type</th><th>Total Plates Required</th></tr></thead><tbody>';
  
  Object.keys(totals).sort().forEach((name, idx) => {
    html += '<tr><td>' + (idx + 1) + '</td><td><strong>' + escapeHtml(name) + '</strong></td><td>' + totals[name] + '</td></tr>';
  });
  
  const grandTotal = Object.values(totals).reduce((s, v) => s + v, 0);
  html += '<tr style="background:#f0f0f0; font-weight:700;"><td colspan="2">GRAND TOTAL</td><td>' + grandTotal + ' plates</td></tr>';
  
  html += '</tbody></table><div class="print-footer">' + escapeHtml(hospitalName) + ' - Generated ' + fmtDateTime(now) + '</div></div>';
  printContent(html);
}
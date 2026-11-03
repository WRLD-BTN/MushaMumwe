let allCashFlows = [];
let allProcurementOrders = [];
let currentAccRange = 'today';
let currentProcRange = 'month';
let cashFlowTypeFilter = 'all'; // NEW: Tracks "in", "out", or "all"

async function init_accounts() {
  await loadAccountsData();
}

function toInputDate(d) {
  const dt = d instanceof Date ? d : new Date(d);
  const yyyy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return yyyy + '-' + mm + '-' + dd;
}

// ============================================================
// CASH FLOW DATE FILTERS
// ============================================================
function setAccountRange(range) {
  currentAccRange = range;
  
  ['today', 'week', 'month'].forEach(r => {
    const btn = document.getElementById('acc-range-' + r);
    if (btn) btn.classList.toggle('active', r === range);
  });

  const fromEl = document.getElementById('acc-from');
  const toEl = document.getElementById('acc-to');

  const now = new Date();
  if (range === 'today') {
    fromEl.value = toInputDate(now);
    toEl.value = toInputDate(now);
    document.getElementById('acc-summary-title').textContent = "Today's Cash Flow";
  } else if (range === 'week') {
    const day = now.getDay();
    const sunday = new Date(now);
    sunday.setDate(now.getDate() - day);
    fromEl.value = toInputDate(sunday);
    toEl.value = toInputDate(now);
    document.getElementById('acc-summary-title').textContent = "This Week's Cash Flow";
  } else if (range === 'month') {
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    fromEl.value = toInputDate(first);
    toEl.value = toInputDate(now);
    document.getElementById('acc-summary-title').textContent = "This Month's Cash Flow";
  } else if (range === 'custom') {
    document.getElementById('acc-summary-title').textContent = "Custom Range Cash Flow";
  }

  loadCashFlowSummary();
}

// ============================================================
// PROCUREMENT DATE FILTERS
// ============================================================
function setProcRange(range) {
  currentProcRange = range;
  
  ['today', 'week', 'month', 'year', 'all'].forEach(r => {
    const btn = document.getElementById('proc-range-' + r);
    if (btn) btn.classList.toggle('active', r === range);
  });

  const fromEl = document.getElementById('proc-from');
  const toEl = document.getElementById('proc-to');

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
  } else if (range === 'year') {
    const first = new Date(now.getFullYear(), 0, 1);
    fromEl.value = toInputDate(first);
    toEl.value = toInputDate(now);
  } else if (range === 'all') {
    fromEl.value = '';
    toEl.value = '';
  } else if (range === 'custom') {
    // Leave as user set them
  }

  loadProcurementOrders();
}

// ============================================================
// CASH FLOW TYPE FILTER
// ============================================================
function setCashFlowTypeFilter(btn) {
  const bar = document.getElementById('acc-cashTypeFilters');
  if (bar) bar.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  cashFlowTypeFilter = btn.dataset.type;
  renderCashFlows();
}

// ============================================================
// EDITABLE SOURCE
// ============================================================
function handleSourceChange(selectEl) {
  if (selectEl.value === 'Other') {
    const newSource = prompt('Enter the new cash source (e.g., Cafeteria, VIP Ward):');
    
    if (newSource && newSource.trim() !== '') {
      const cleanSource = newSource.trim();
      
      const newOption = document.createElement('option');
      newOption.value = cleanSource;
      newOption.textContent = cleanSource;
      
      selectEl.insertBefore(newOption, selectEl.lastElementChild);
      selectEl.value = cleanSource;
    } else {
      selectEl.selectedIndex = 0;
    }
  }
}

async function loadAccountsData() {
  await Promise.all([
    loadCashFlowSummary(),
    loadProcurementOrders()
  ]);
}

// ============================================================
// CASH FLOW
// ============================================================
async function loadCashFlowSummary() {
  try {
    const from = document.getElementById('acc-from').value;
    const to = document.getElementById('acc-to').value;
    
    let url = '/api/accounts/summary';
    if (from && to) {
      url += `?from=${from}&to=${to}`;
    }

    const res = await fetch(url, { headers: { Authorization: 'Bearer ' + token() } });
    if (!res.ok) return;
    const data = await res.json();

    document.getElementById('acc-usdTotal').textContent = '$' + data.usdNet.toFixed(2);
    document.getElementById('acc-zwgTotal').textContent = 'Z$' + data.zwgNet.toFixed(2);

    allCashFlows = data.flows || [];
    
    renderCashFlows();
    renderSourceBreakdown(data.sourceBreakdown || {});
  } catch (e) { console.error(e); }
}

function renderSourceBreakdown(breakdown) {
  const el = document.getElementById('acc-sourceBreakdown');
  const keys = Object.keys(breakdown);

  if (keys.length === 0) {
    el.innerHTML = '<div class="empty-state" style="padding: 12px; font-size: 12px;">No revenue data</div>';
    return;
  }

  el.innerHTML = '<table class="data-table" style="font-size: 11px;"><thead><tr><th>Source</th><th>USD</th><th>ZWG</th></tr></thead><tbody>' +
    keys.map(k => {
      const row = breakdown[k];
      const usd = row.USD ? '$' + row.USD.toFixed(2) : '-';
      const zwg = row.ZWG ? 'Z$' + row.ZWG.toFixed(2) : '-';
      return `<tr><td><strong>${escapeHtml(k)}</strong></td><td style="color:var(--success);">${usd}</td><td style="color:var(--success);">${zwg}</td></tr>`;
    }).join('') + '</tbody></table>';
}

function renderCashFlows() {
  const el = document.getElementById('acc-recentList');
  if (!el) return;

  const q = (document.getElementById('acc-cashSearch')?.value || '').toLowerCase();
  let filtered = allCashFlows;

  // Apply Type Filter (In / Out)
  if (cashFlowTypeFilter !== 'all') {
    filtered = filtered.filter(f => f.type === cashFlowTypeFilter);
  }
  
  // Apply Search Filter
  if (q) {
    filtered = filtered.filter(f => 
      String(f.source || '').toLowerCase().includes(q) || 
      String(f.reason || '').toLowerCase().includes(q)
    );
  }

  if (filtered.length === 0) {
    el.innerHTML = '<div class="empty-state" style="padding: 20px;">No transactions match</div>';
    return;
  }

  el.innerHTML = '<table class="data-table"><thead><tr><th>Date</th><th>Type</th><th>Source</th><th>Amount</th><th>Note</th></tr></thead><tbody>' +
    filtered.map(f => {
      const isIn = f.type === 'in';
      const color = isIn ? 'var(--success)' : 'var(--error)';
      const sign = isIn ? '+' : '-';
      const symbol = f.currency === 'USD' ? '$' : 'Z$';
      
      return '<tr>' +
        '<td>' + fmtDate(f.date) + '</td>' +
        '<td><span style="color:' + color + '; font-weight:700;">' + (isIn ? 'IN' : 'OUT') + '</span></td>' +
        '<td>' + escapeHtml(f.source) + '</td>' +
        '<td><span style="color:' + color + '; font-weight:700;">' + sign + symbol + f.amount.toFixed(2) + '</span></td>' +
        '<td class="muted">' + escapeHtml(f.reason || '-') + '</td>' +
        '</tr>';
    }).join('') + '</tbody></table>';
}

async function saveCashFlow() {
  const type = document.getElementById('acc-type').value;
  const currency = document.getElementById('acc-currency').value;
  const amount = document.getElementById('acc-amount').value;
  const source = document.getElementById('acc-source').value;
  const reason = document.getElementById('acc-reason').value.trim();
  const msg = document.getElementById('acc-message');

  if (!amount) {
    msg.innerHTML = '<span style="color: var(--error);">Amount is required</span>';
    return;
  }

  const btn = document.querySelector('button[onclick="saveCashFlow()"]');
  if (btn && btn.disabled) return;
  if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }

  try {
    const res = await fetch('/api/accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token() },
      body: JSON.stringify({ type, currency, amount: parseFloat(amount), source, reason }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    msg.innerHTML = '<span style="color: var(--success);">Transaction saved</span>';
    document.getElementById('acc-amount').value = '';
    document.getElementById('acc-reason').value = '';
    
    await loadCashFlowSummary();
    
    setTimeout(() => { msg.innerHTML = ''; }, 3000);
  } catch (e) {
    msg.innerHTML = '<span style="color: var(--error);">' + e.message + '</span>';
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Save Transaction'; }
  }
}

// ============================================================
// PROCUREMENT SPENDING
// ============================================================
async function loadProcurementOrders() {
  try {
    const from = document.getElementById('proc-from')?.value || '';
    const to = document.getElementById('proc-to')?.value || '';
    
    let url = '/api/accounts/procurement-orders';
    if (from && to) {
      url += `?from=${from}&to=${to}`;
    }

    const res = await fetch(url, { headers: { Authorization: 'Bearer ' + token() } });
    if (!res.ok) return;
    allProcurementOrders = await res.json();
    renderProcurementOrders();
  } catch (e) { console.error(e); }
}

function renderProcurementOrders() {
  const el = document.getElementById('acc-procurementList');
  if (!el) return;

  const q = (document.getElementById('acc-procSearch')?.value || '').toLowerCase();
  let filtered = allProcurementOrders;

  if (q) {
    filtered = allProcurementOrders.filter(o => 
      String(o.orderRequest?.itemName || '').toLowerCase().includes(q) || 
      String(o.supplierName || '').toLowerCase().includes(q)
    );
  }

  if (filtered.length === 0) {
    el.innerHTML = '<div class="empty-state" style="padding: 20px;">No orders match</div>';
    return;
  }

  let totalUsd = 0;
  let totalZwg = 0;

  el.innerHTML = '<table class="data-table"><thead><tr><th>Date</th><th>Item</th><th>Supplier</th><th>Dept</th><th>USD</th><th>ZWG</th></tr></thead><tbody>' +
    filtered.map(o => {
      const req = o.orderRequest;
      
      if (o.priceUsd) totalUsd += o.priceUsd;
      if (o.priceZwg) totalZwg += o.priceZwg;

      const usd = o.priceUsd ? '$' + o.priceUsd.toFixed(2) : '-';
      const zwg = o.priceZwg ? 'Z$' + o.priceZwg.toFixed(2) : '-';
      
      return '<tr>' +
        '<td>' + fmtDate(o.orderDate) + '</td>' +
        '<td><strong>' + escapeHtml(req.itemName) + '</strong> x' + req.quantity + '</td>' +
        '<td>' + escapeHtml(o.supplierName) + '</td>' +
        '<td><span class="dept-pill">' + escapeHtml(req.originatorDepartment || req.requestingDepartment) + '</span></td>' +
        '<td style="font-weight:700; color:var(--success);">' + usd + '</td>' +
        '<td style="font-weight:700; color:var(--success);">' + zwg + '</td>' +
        '</tr>';
    }).join('') + '</tbody></table>' +
    '<div style="margin-top:10px; text-align:right; font-weight:700;">' +
    'Total: $' + totalUsd.toFixed(2) + ' | Z$' + totalZwg.toFixed(2) +
    '</div>';
}

// ============================================================
// PRINT FUNCTIONS
// ============================================================
function printCashFlow() {
  if (allCashFlows.length === 0) { alert('No transactions to print.'); return; }
  
  const hospitalName = (systemSettings.hospitalName || 'Sally Mugabe Central Hospital').toUpperCase();
  const now = new Date();
  const from = document.getElementById('acc-from').value;
  const to = document.getElementById('acc-to').value;
  
  let html = '<div class="print-page a4">';
  html += '<div class="print-header"><h1>' + escapeHtml(hospitalName) + '</h1><h2>Cash Flow Report</h2></div>';
  html += '<div class="print-meta">';
  html += '<p><strong>Period:</strong> ' + from + ' to ' + to + '</p>';
  html += '<p><strong>Generated:</strong> ' + fmtDateTime(now) + '</p>';
  html += '</div>';

  html += '<table class="print-table"><thead><tr><th>Date</th><th>Type</th><th>Source</th><th>Note</th><th>Amount</th></tr></thead><tbody>';
  
  allCashFlows.forEach(f => {
    const isIn = f.type === 'in';
    const sign = isIn ? '+' : '-';
    const symbol = f.currency === 'USD' ? '$' : 'Z$';
    
    html += '<tr>';
    html += '<td>' + fmtDate(f.date) + '</td>';
    html += '<td>' + (isIn ? 'IN' : 'OUT') + '</td>';
    html += '<td>' + escapeHtml(f.source) + '</td>';
    html += '<td>' + escapeHtml(f.reason || '-') + '</td>';
    html += '<td>' + sign + symbol + f.amount.toFixed(2) + '</td>';
    html += '</tr>';
  });

  html += '</tbody></table>';
  html += '<div class="print-footer">' + escapeHtml(hospitalName) + ' - Generated ' + fmtDateTime(now) + '</div></div>';
  printContent(html);
}

function printProcurement() {
  if (allProcurementOrders.length === 0) { alert('No procurement orders to print.'); return; }

  const hospitalName = (systemSettings.hospitalName || 'Sally Mugabe Central Hospital').toUpperCase();
  const now = new Date();
  const from = document.getElementById('proc-from').value;
  const to = document.getElementById('proc-to').value;

  let html = '<div class="print-page a4">';
  html += '<div class="print-header"><h1>' + escapeHtml(hospitalName) + '</h1><h2>Procurement Spending Report</h2></div>';
  html += '<div class="print-meta">';
  if (from && to) html += '<p><strong>Period:</strong> ' + from + ' to ' + to + '</p>';
  else html += '<p><strong>Period:</strong> All Time</p>';
  html += '<p><strong>Generated:</strong> ' + fmtDateTime(now) + '</p></div>';

  html += '<table class="print-table"><thead><tr><th>Date</th><th>Item</th><th>Supplier</th><th>Dept</th><th>USD</th><th>ZWG</th></tr></thead><tbody>';
  
  allProcurementOrders.forEach(o => {
    const req = o.orderRequest;
    const usd = o.priceUsd ? '$' + o.priceUsd.toFixed(2) : '-';
    const zwg = o.priceZwg ? 'Z$' + o.priceZwg.toFixed(2) : '-';
    
    html += '<tr>';
    html += '<td>' + fmtDate(o.orderDate) + '</td>';
    html += '<td>' + escapeHtml(req.itemName) + ' x' + req.quantity + '</td>';
    html += '<td>' + escapeHtml(o.supplierName) + '</td>';
    html += '<td>' + escapeHtml(req.originatorDepartment || req.requestingDepartment) + '</td>';
    html += '<td>' + usd + '</td>';
    html += '<td>' + zwg + '</td>';
    html += '</tr>';
  });

  html += '</tbody></table>';
  html += '<div class="print-footer">' + escapeHtml(hospitalName) + ' - Generated ' + fmtDateTime(now) + '</div></div>';
  printContent(html);
}

// Initialize dates on load
document.addEventListener('DOMContentLoaded', () => {
  const now = new Date();
  const today = toInputDate(now);
  
  const accFrom = document.getElementById('acc-from');
  const accTo = document.getElementById('acc-to');
  if (accFrom && !accFrom.value) accFrom.value = today;
  if (accTo && !accTo.value) accTo.value = today;
  
  const procFrom = document.getElementById('proc-from');
  const procTo = document.getElementById('proc-to');
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  if (procFrom && !procFrom.value) procFrom.value = toInputDate(firstOfMonth);
  if (procTo && !procTo.value) procTo.value = today;
});
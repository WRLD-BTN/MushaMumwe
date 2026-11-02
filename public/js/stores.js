// ============================================================
// Sally Mugabe Central Hospital - Stores Department
// ============================================================

let allInventory = [];
let allApprovedForStores = [];
let allTenders = [];
let tenderFilter = 'all';

async function init_stores() {
  await loadStoresInventory();
  await loadApprovedOrdersForStores();
  await loadMyTenders();

  window.onOrderUpdated = (payload) => {
    loadApprovedOrdersForStores();
    const myDept = String(currentDeptName || '').toLowerCase();
    const sub  = String(payload?.department || '').toLowerCase();
    const orig = String(payload?.originator || '').toLowerCase();
    if (sub === myDept || orig === myDept) loadMyTenders();
  };
  window.onInventoryUpdated = () => loadStoresInventory();
}

// ============================================================
// INVENTORY
// ============================================================
async function loadStoresInventory() {
  try {
    const [invRes, sumRes] = await Promise.all([
      fetch('/api/inventory', { headers: { Authorization: 'Bearer ' + token() } }),
      fetch('/api/inventory/summary', { headers: { Authorization: 'Bearer ' + token() } }),
    ]);

    allInventory = await invRes.json();
    const summary = await sumRes.json();

    renderInventory();

    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('stores-invTotal',    summary.totalItems ?? 0);
    set('stores-invCritical', summary.critical   ?? 0);
    set('stores-invLow',      summary.low        ?? 0);
    set('stores-invAdequate', summary.adequate   ?? 0);
  } catch (e) {
    console.error('Failed to load inventory:', e);
  }
}

function renderInventory() {
  const el = document.getElementById('stores-inventoryList');
  if (!el) return;

  const q = (document.getElementById('stores-invSearch')?.value || '').toLowerCase();
  const list = q ? allInventory.filter(i => i.name.toLowerCase().includes(q)) : allInventory;

  if (list.length === 0) {
    el.innerHTML = '<div class="empty-state">No inventory items match</div>';
    return;
  }

  el.innerHTML = '<table class="data-table">' +
    '<thead><tr><th>Item</th><th>Category</th><th>Qty</th><th>Unit</th><th>Status</th></tr></thead><tbody>' +
    list.map(i => {
      let label = 'Adequate';
      let cls = 'status-ok';
      if (i.quantity < 10) { label = 'Critical'; cls = 'status-critical'; }
      else if (i.quantity < 50) { label = 'Low'; cls = 'status-low'; }

      return '<tr>' +
        '<td>' + escapeHtml(i.name) + '</td>' +
        '<td>' + escapeHtml(i.category || '-') + '</td>' +
        '<td><strong>' + i.quantity + '</strong></td>' +
        '<td>' + escapeHtml(i.unit) + '</td>' +
        '<td><span class="status-pill ' + cls + '">' + label + '</span></td>' +
        '</tr>';
    }).join('') +
    '</tbody></table>';
}

function filterInventory() { renderInventory(); }

// ============================================================
// APPROVED ORDERS WAITING
// ============================================================
async function loadApprovedOrdersForStores() {
  try {
    const res = await fetch('/api/inventory/approved-orders', { headers: { Authorization: 'Bearer ' + token() } });
    if (!res.ok) return;
    allApprovedForStores = await res.json();
    renderApprovedForStores();
  } catch (e) {
    console.error('Failed to load approved orders:', e);
  }
}

function renderApprovedForStores() {
  const el = document.getElementById('stores-approvedOrders');
  if (!el) return;

  const q = (document.getElementById('stores-approvedSearch')?.value || '').toLowerCase();
  const list = q
    ? allApprovedForStores.filter(o =>
        o.itemName.toLowerCase().includes(q) ||
        o.requestingDepartment.toLowerCase().includes(q) ||
        String(o.id).includes(q))
    : allApprovedForStores;

  if (list.length === 0) {
    el.innerHTML = '<div class="empty-state">No approved orders waiting</div>';
    return;
  }

  el.innerHTML = list.map(o => {
    const originator = o.originatorDepartment || o.requestingDepartment;
    return '<div class="order-card-mini">' +
      '<div><strong>#' + o.id + '</strong> ' + escapeHtml(o.itemName) + ' x' + o.quantity + '</div>' +
      '<div class="muted">' + escapeHtml(originator) + ' &nbsp; ' + statusBadge(o.status) + '</div>' +
      '<button class="pill-btn" onclick="prefillReceive(' + o.id + ', \'' +
        o.itemName.replace(/'/g, "\\'") + '\', ' + o.quantity + ')">Receive This</button>' +
      '</div>';
  }).join('');
}

function filterApprovedForStores() { renderApprovedForStores(); }

function prefillReceive(orderId, itemName, qty) {
  document.getElementById('stores-receiveOrderId').value = orderId;
  document.getElementById('stores-receiveItemName').value = itemName;
  document.getElementById('stores-receiveQty').value = qty;
  document.getElementById('stores-receiveQty').focus();
}

// ============================================================
// RECEIVE ITEMS
// ============================================================
async function receiveItems() {
  const orderRequestId = document.getElementById('stores-receiveOrderId').value;
  const itemName = document.getElementById('stores-receiveItemName').value.trim();
  const quantityReceived = document.getElementById('stores-receiveQty').value;
  const notes = document.getElementById('stores-receiveNotes').value;
  const msg = document.getElementById('stores-receiveMessage');

  if (!orderRequestId || !itemName || !quantityReceived) {
    msg.innerHTML = '<div class="error">Order ID, item name, and quantity required</div>';
    return;
  }

  try {
    const res = await fetch('/api/inventory/receive', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token() },
      body: JSON.stringify({
        orderRequestId: parseInt(orderRequestId),
        itemName,
        quantityReceived: parseInt(quantityReceived),
        notes,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    msg.innerHTML = '<div class="success">Items received and inventory updated</div>';
    document.getElementById('stores-receiveOrderId').value = '';
    document.getElementById('stores-receiveItemName').value = '';
    document.getElementById('stores-receiveQty').value = '';
    document.getElementById('stores-receiveNotes').value = '';

    await loadStoresInventory();
    await loadApprovedOrdersForStores();
    await loadMyTenders();
  } catch (e) {
    msg.innerHTML = '<div class="error">' + e.message + '</div>';
  }
}

// ============================================================
// NEW TENDER REQUEST (was missing)
// ============================================================
async function submitTenderRequest(deptKey) {
  const originatorDepartment = document.getElementById(deptKey + '-reqOriginator')?.value || currentDeptName;
  const itemName = document.getElementById(deptKey + '-reqItemName').value.trim();
  const quantity = document.getElementById(deptKey + '-reqQuantity').value;
  const reason   = document.getElementById(deptKey + '-reqReason').value.trim();
  const msg      = document.getElementById(deptKey + '-requestMessage');

  if (!itemName || !quantity || !reason) {
    msg.innerHTML = '<div class="error">All fields required</div>';
    return;
  }

  const btn = document.querySelector('button[onclick="submitTenderRequest(\'' + deptKey + '\')"]');
  if (btn && btn.disabled) return;
  if (btn) { btn.disabled = true; btn.textContent = 'Submitting...'; }

  try {
    const res = await fetch('/api/orders/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token() },
      body: JSON.stringify({ itemName, quantity: parseInt(quantity), reason, originatorDepartment }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    msg.innerHTML = '<div class="success">Request submitted</div>';
    document.getElementById(deptKey + '-reqItemName').value = '';
    document.getElementById(deptKey + '-reqQuantity').value = '';
    document.getElementById(deptKey + '-reqReason').value   = '';
    await loadMyTenders();
  } catch (e) {
    msg.innerHTML = '<div class="error">' + e.message + '</div>';
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Submit Tender Request'; }
  }
}

// ============================================================
// MY TENDERS — LOAD + FILTER
// ============================================================
async function loadMyTenders() {
  try {
    const res = await fetch('/api/orders/my', { headers: { Authorization: 'Bearer ' + token() } });
    if (!res.ok) return;
    allTenders = await res.json();
    renderTenderTracker();
  } catch (e) {
    console.error('Failed to load tenders:', e);
  }
}

function setTenderFilter(btn) {
  const bar = btn.closest('.tender-filters, .filter-bar');
  if (bar) bar.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  tenderFilter = btn.dataset.filter;
  renderTenderTracker();
}

function filterTenders() { renderTenderTracker(); }

function renderTenderTracker() {
  const el = document.getElementById('stores-tenderTrackerList');
  if (!el) return;

  const q = (document.getElementById('stores-tenderSearch')?.value || '').trim().toLowerCase();

  let list = allTenders;

  if (tenderFilter !== 'all') {
    if (tenderFilter === 'received') {
      list = list.filter(t => t.status === 'received' || t.status === 'in_storage');
    } else {
      list = list.filter(t => t.status === tenderFilter);
    }
  }

  if (q) {
    list = list.filter(t =>
      String(t.itemName || '').toLowerCase().includes(q) ||
      String(t.reason || '').toLowerCase().includes(q) ||
      String(t.requestingBy || '').toLowerCase().includes(q) ||
      String(t.requestingDepartment || '').toLowerCase().includes(q) ||
      String(t.originatorDepartment || '').toLowerCase().includes(q) ||
      String(t.id).includes(q)
    );
  }

  const countEl = document.getElementById('stores-tenderResultCount');
  if (countEl) {
    const bits = [];
    if (tenderFilter !== 'all') bits.push('status=' + tenderFilter.replace('_', ' '));
    if (q) bits.push('search="' + q + '"');
    const desc = bits.length ? ' (filters: ' + bits.join(', ') + ')' : ' (no filters - showing all)';
    countEl.textContent = list.length + ' tender' + (list.length === 1 ? '' : 's') + desc;
  }

  if (list.length === 0) {
    el.innerHTML = '<div class="empty-state">No Tenders</div>';
    return;
  }

  const myDept = String(currentDeptName || '').toLowerCase();

  el.innerHTML = list.map(t => {
    const submitter  = t.requestingDepartment || '';
    const originator = t.originatorDepartment || submitter;
    const submittedByMe  = String(submitter).toLowerCase()  === myDept;
    const submittedForMe = String(originator).toLowerCase() === myDept;

    let meta = 'Requested by: ' + escapeHtml(submitter);
    if (!submittedByMe && submittedForMe) {
      meta = 'Requested FOR your department by ' + escapeHtml(submitter);
    } else if (submittedByMe && originator.toLowerCase() !== submitter.toLowerCase()) {
      meta = 'Submitted by you FOR ' + escapeHtml(originator);
    }

    const supplier = t.procurementOrder && t.procurementOrder.supplierName
      ? '<p><em>Supplier:</em> ' + escapeHtml(t.procurementOrder.supplierName) + '</p>'
      : '';

    return '<div class="tender-card">' +
      '<div class="tender-head">' +
      '<div>' +
      '<strong>#' + t.id + ' - ' + escapeHtml(t.itemName) + ' x' + t.quantity + '</strong>' +
      '<div class="muted">' + meta + ' - ' + fmtDate(t.createdAt) + '</div>' +
      '</div>' +
      '<div>' + statusBadge(t.status) + '</div>' +
      '</div>' +
      '<div class="tender-body">' +
      '<p><em>Reason:</em> ' + escapeHtml(t.reason) + '</p>' +
      supplier +
      '</div>' +
      '</div>';
  }).join('');
}

// ============================================================
// PRINT
// ============================================================
function printInventory() {
  if (allInventory.length === 0) { alert('No inventory to print.'); return; }
  const hospitalName = (systemSettings.hospitalName || 'Sally Mugabe Central Hospital').toUpperCase();
  const now = new Date();
  let html = '<div class="print-page a4"><div class="print-header"><h1>' + escapeHtml(hospitalName) + '</h1><h2>Inventory Report</h2></div>';
  html += '<div class="print-meta"><p><strong>Total Items:</strong> ' + allInventory.length + '</p><p><strong>Generated:</strong> ' + fmtDateTime(now) + '</p></div>';
  html += '<table class="print-table"><thead><tr><th>#</th><th>Item</th><th>Category</th><th>Qty</th><th>Unit</th><th>Status</th></tr></thead><tbody>';
  allInventory.forEach((i, idx) => {
    let statusLabel = i.quantity < 10 ? 'Critical' : i.quantity < 50 ? 'Low' : 'Adequate';
    html += '<tr><td>' + (idx + 1) + '</td><td>' + escapeHtml(i.name) + '</td><td>' + escapeHtml(i.category || '-') + '</td><td>' + i.quantity + '</td><td>' + escapeHtml(i.unit) + '</td><td>' + statusLabel + '</td></tr>';
  });
  html += '</tbody></table><div class="print-footer">' + escapeHtml(hospitalName) + ' - Generated ' + fmtDateTime(now) + '</div></div>';
  printContent(html);
}

function printMyTenders() {
  if (allTenders.length === 0) { alert('No tenders to print.'); return; }
  const hospitalName = (systemSettings.hospitalName || 'Sally Mugabe Central Hospital').toUpperCase();
  const now = new Date();
  let html = '<div class="print-page a4"><div class="print-header"><h1>' + escapeHtml(hospitalName) + '</h1><h2>Stores Department Tenders</h2></div>';
  html += '<div class="print-meta"><p><strong>Total:</strong> ' + allTenders.length + '</p><p><strong>Generated:</strong> ' + fmtDateTime(now) + '</p></div>';
  html += '<table class="print-table"><thead><tr><th>#</th><th>Item</th><th>Qty</th><th>Status</th><th>Date</th></tr></thead><tbody>';
  allTenders.forEach((t, i) => {
    html += '<tr><td>' + (i + 1) + '</td><td>' + escapeHtml(t.itemName) + '</td><td>' + t.quantity + '</td><td>' + String(t.status).toUpperCase() + '</td><td>' + fmtDate(t.createdAt) + '</td></tr>';
  });
  html += '</tbody></table><div class="print-footer">' + escapeHtml(hospitalName) + ' - Generated ' + fmtDateTime(now) + '</div></div>';
  printContent(html);
}
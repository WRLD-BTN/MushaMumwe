// ============================================================
// Sally Mugabe Central Hospital - Stores Department
// ============================================================

let allInventory = [];
let allApprovedForStores = [];

async function init_stores() {
  await loadStoresInventory();
  await loadApprovedOrdersForStores();

  window.onOrderUpdated = () => {
    loadApprovedOrdersForStores();
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
  } catch (e) {
    msg.innerHTML = '<div class="error">' + e.message + '</div>';
  }
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
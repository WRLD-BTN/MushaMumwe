// ============================================================
// MushaMumwe - Stores Department
// ============================================================

let allInventory = [];
let allApprovedForStores = [];
let allTenders = [];
let tenderFilter = 'all';

async function init_stores() {
  await loadStoresInventory();
  await loadApprovedOrdersForStores();
  await loadMyTenders();
  window.onOrderUpdated = () => loadApprovedOrdersForStores();
  window.onInventoryUpdated = () => loadStoresInventory();
}

// ============================================================
// INVENTORY
// ============================================================
async function loadStoresInventory() {
  try {
    const [invRes, sumRes, histRes] = await Promise.all([
      fetch('/api/inventory', { headers: { Authorization: 'Bearer ' + token() } }),
      fetch('/api/inventory/summary', { headers: { Authorization: 'Bearer ' + token() } }),
      fetch('/api/inventory/receive-history', { headers: { Authorization: 'Bearer ' + token() } }),
    ]);

    allInventory = await invRes.json();
    const summary = await sumRes.json();
    const history = await histRes.json();

    renderInventory();

    document.getElementById('stores-invCritical').textContent = summary.critical;
    document.getElementById('stores-invLow').textContent = summary.low;
    document.getElementById('stores-invAdequate').textContent = summary.adequate;
    document.getElementById('stores-invTotal').textContent = summary.totalItems;

    renderReceiveHistory(history);
  } catch (e) {
    console.error(e);
  }
}

function renderInventory() {
  const el = document.getElementById('stores-inventoryList');
  const q = (document.getElementById('stores-invSearch')?.value || '').toLowerCase();

  const list = q
    ? allInventory.filter(i => i.name.toLowerCase().includes(q))
    : allInventory;

  if (list.length === 0) {
    el.innerHTML = '<div class="empty-state">No Inventory</div>';
    return;
  }

  el.innerHTML = '<table class="data-table">' +
    '<thead><tr><th>Item</th><th>Qty</th><th>Unit</th><th>Status</th></tr></thead><tbody>' +
    list.map(i => {
      let label = 'Adequate';
      let cls = 'status-ok';
      if (i.quantity < 10) { label = 'Critical'; cls = 'status-critical'; }
      else if (i.quantity < 50) { label = 'Low'; cls = 'status-low'; }

      return '<tr>' +
        '<td>' + escapeHtml(i.name) + '</td>' +
        '<td><strong>' + i.quantity + '</strong></td>' +
        '<td>' + escapeHtml(i.unit) + '</td>' +
        '<td><span class="status-pill ' + cls + '">' + label + '</span></td>' +
        '</tr>';
    }).join('') +
    '</tbody></table>';
}

function filterInventory() { renderInventory(); }

function renderReceiveHistory(history) {
  const el = document.getElementById('stores-receiveHistory');
  if (history.length === 0) {
    el.innerHTML = '<div class="empty-state">No receipts yet</div>';
    return;
  }

  el.innerHTML = history.slice(0, 15).map(r =>
    '<div class="mini-item">' +
    '<strong>' + escapeHtml(r.inventoryItem.name) + ' x' + r.quantityReceived + '</strong>' +
    '<span class="muted"> - ' + escapeHtml(r.receivedBy) + ' - ' + fmtDateTime(r.receivedAt) + '</span>' +
    '</div>'
  ).join('');
}

async function exportInventory() {
  try {
    const res = await fetch('/api/inventory/export', { headers: { Authorization: 'Bearer ' + token() } });
    if (!res.ok) throw new Error('Export failed');
    const blob = await res.blob();
    downloadCSV(blob, 'inventory-' + new Date().toISOString().split('T')[0] + '.csv');
  } catch (e) {
    alert(e.message);
  }
}

// ============================================================
// APPROVED ORDERS
// ============================================================
async function loadApprovedOrdersForStores() {
  try {
    const res = await fetch('/api/inventory/approved-orders', { headers: { Authorization: 'Bearer ' + token() } });
    if (!res.ok) return;
    allApprovedForStores = await res.json();
    renderApprovedForStores();
  } catch (e) {
    console.error(e);
  }
}

function renderApprovedForStores() {
  const el = document.getElementById('stores-approvedOrders');
  const q = (document.getElementById('stores-approvedSearch')?.value || '').toLowerCase();

  const list = q
    ? allApprovedForStores.filter(o =>
        o.itemName.toLowerCase().includes(q) ||
        o.requestingDepartment.toLowerCase().includes(q) ||
        String(o.id).includes(q))
    : allApprovedForStores;

  if (list.length === 0) {
    el.innerHTML = '<div class="empty-state">No Approved Tenders Waiting</div>';
    return;
  }

  el.innerHTML = list.map(o =>
    '<div class="order-card-mini">' +
    '<div><strong>#' + o.id + '</strong> ' + escapeHtml(o.itemName) + ' x' + o.quantity + '</div>' +
    '<div class="muted">' + escapeHtml(o.requestingDepartment) + ' - ' + statusBadge(o.status) + '</div>' +
    '<button class="pill-btn" onclick="prefillReceive(' + o.id + ', \'' +
    o.itemName.replace(/'/g, "\\'") + '\', ' + o.quantity + ')">Receive This</button>' +
    '</div>'
  ).join('');
}

function filterApprovedForStores() { renderApprovedForStores(); }

function prefillReceive(orderId, itemName, qty) {
  document.getElementById('stores-receiveOrderId').value = orderId;
  document.getElementById('stores-receiveItemName').value = itemName;
  document.getElementById('stores-receiveQty').value = qty;
  document.getElementById('stores-receiveQty').focus();
}

// ============================================================
// RECEIVE
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
// TENDERS
// ============================================================
async function submitTenderRequest(deptKey) {
  const itemName = document.getElementById(deptKey + '-reqItemName').value.trim();
  const quantity = document.getElementById(deptKey + '-reqQuantity').value;
  const reason = document.getElementById(deptKey + '-reqReason').value.trim();
  const msg = document.getElementById(deptKey + '-requestMessage');

  if (!itemName || !quantity || !reason) {
    msg.innerHTML = '<div class="error">All fields required</div>';
    return;
  }

  try {
    const res = await fetch('/api/orders/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token() },
      body: JSON.stringify({ itemName, quantity: parseInt(quantity), reason }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    msg.innerHTML = '<div class="success">Request submitted</div>';
    document.getElementById(deptKey + '-reqItemName').value = '';
    document.getElementById(deptKey + '-reqQuantity').value = '';
    document.getElementById(deptKey + '-reqReason').value = '';
    await loadMyTenders();
  } catch (e) {
    msg.innerHTML = '<div class="error">' + e.message + '</div>';
  }
}

async function loadMyTenders() {
  const res = await fetch('/api/orders/my', { headers: { Authorization: 'Bearer ' + token() } });
  if (!res.ok) return;
  allTenders = await res.json();
  renderTenderTracker();
}

function setTenderFilter(btn) {
  document.querySelectorAll('#stores-tenderFilters .filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  tenderFilter = btn.dataset.filter;
  renderTenderTracker();
}

function filterTenders() { renderTenderTracker(); }

function renderTenderTracker() {
  const el = document.getElementById('stores-tenderTrackerList');
  const q = (document.getElementById('stores-tenderSearch')?.value || '').toLowerCase();

  let list = allTenders;
  if (tenderFilter !== 'all') list = list.filter(t => t.status === tenderFilter);
  if (q) list = list.filter(t => String(t.itemName).toLowerCase().includes(q));

  if (list.length === 0) {
    el.innerHTML = '<div class="empty-state">No Tenders</div>';
    return;
  }

  el.innerHTML = list.map(t =>
    '<div class="tender-card">' +
    '<div class="tender-head">' +
    '<div><strong>#' + t.id + ' - ' + escapeHtml(t.itemName) + ' x' + t.quantity + '</strong></div>' +
    '<div>' + statusBadge(t.status) + '</div>' +
    '</div>' +
    '<div class="tender-body"><p><em>Reason:</em> ' + escapeHtml(t.reason) + '</p></div>' +
    '</div>'
  ).join('');
}

async function exportMyTenders() {
  const res = await fetch('/api/orders/my/export', { headers: { Authorization: 'Bearer ' + token() } });
  if (!res.ok) return alert('Export failed');
  const blob = await res.blob();
  downloadCSV(blob, 'tenders-stores-' + new Date().toISOString().split('T')[0] + '.csv');
}
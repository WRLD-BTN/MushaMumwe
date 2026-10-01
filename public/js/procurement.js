// ============================================================
// MushaMumwe - Procurement Department
// ============================================================

let allProcurementOrders = [];
let allTenders = [];
let tenderFilter = 'all';
let procActiveFilter = 'pending';
let historySearchTimer = null;

async function init_proc() {
  await loadProcurementDashboard();
  await loadMyTenders();
  window.onOrderUpdated = (payload) => {
    loadProcurementDashboard();
    if (document.getElementById('procTabHistory')?.classList.contains('active')) {
      loadHistorySummary();
      loadTenderHistory();
    }
    const myDept = String(currentDeptName || '').toLowerCase();
    if (String(payload?.department || '').toLowerCase() === myDept) loadMyTenders();
  };
  window.onOrderCreated = () => loadProcurementDashboard();
}

// ============================================================
// TABS
// ============================================================
function switchProcTab(btn) {
  document.querySelectorAll('.dept-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');

  const tab = btn.dataset.tab;
  document.querySelectorAll('.proc-tab-panel').forEach(p => p.classList.remove('active'));
  document.getElementById(tab === 'history' ? 'procTabHistory' : 'procTabActive').classList.add('active');

  if (tab === 'history') {
    loadHistorySummary();
    loadTenderHistory();
  }
}

// ============================================================
// ACTIVE BOARD
// ============================================================
async function loadProcurementDashboard() {
  try {
    const [reqRes, sumRes] = await Promise.all([
      fetch('/api/orders/requests', { headers: { Authorization: 'Bearer ' + token() } }),
      fetch('/api/orders/summary', { headers: { Authorization: 'Bearer ' + token() } }),
    ]);

    allProcurementOrders = await reqRes.json();
    const summary = await sumRes.json();

    renderProcurementOrders();

    document.getElementById('proc-procPending').textContent = summary.pending;
    document.getElementById('proc-procApproved').textContent = summary.approved;
    document.getElementById('proc-procOrdered').textContent = summary.ordered;
    document.getElementById('proc-procInStorage').textContent = summary.inStorage;
    document.getElementById('proc-procRejected').textContent = summary.rejected;
  } catch (e) {
    console.error(e);
  }
}

function setProcActiveFilter(btn) {
  const parent = document.getElementById('proc-activeFilters');
  if (parent) parent.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  procActiveFilter = btn.dataset.filter;
  renderProcurementOrders();
}

function renderProcurementOrders() {
  const el = document.getElementById('proc-pendingOrdersList');
  if (!el) return;

  const q = (document.getElementById('proc-pendingSearch')?.value || '').toLowerCase();

  let list = allProcurementOrders;
  if (procActiveFilter !== 'all') list = list.filter(o => o.status === procActiveFilter);
  if (q) {
    list = list.filter(o =>
      String(o.itemName || '').toLowerCase().includes(q) ||
      String(o.requestingDepartment || '').toLowerCase().includes(q) ||
      String(o.requestingBy || '').toLowerCase().includes(q) ||
      String(o.id).includes(q));
  }

  if (list.length === 0) {
    const label = procActiveFilter === 'all' ? '' : procActiveFilter.toUpperCase() + ' ';
    el.innerHTML = '<div class="empty-state">No ' + label + 'Tenders</div>';
    return;
  }

  el.innerHTML = list.map(o => {
    const supplier = o.procurementOrder && o.procurementOrder.supplierName
      ? '<p><em>Supplier:</em> ' + escapeHtml(o.procurementOrder.supplierName) + '</p>'
      : '';
    const actions = renderProcOrderActions(o);

    return '<div class="tender-card">' +
      '<div class="tender-head">' +
      '<div>' +
      '<strong>#' + o.id + ' - ' + escapeHtml(o.itemName) + ' x' + o.quantity + '</strong>' +
      '<div class="muted"><span class="dept-pill">' + escapeHtml(o.requestingDepartment) +
      '</span> by ' + escapeHtml(o.requestingBy) + '</div>' +
      '</div>' +
      '<div>' + statusBadge(o.status) + '</div>' +
      '</div>' +
      '<div class="tender-body">' +
      '<p><em>Reason:</em> ' + escapeHtml(o.reason) + '</p>' +
      supplier +
      '</div>' +
      (actions ? '<div class="order-actions">' + actions + '</div>' : '') +
      '</div>';
  }).join('');
}

function renderProcOrderActions(o) {
  if (o.status === 'pending') {
    return '<button class="success-btn" onclick="approveOrder(' + o.id + ')">Approve</button>' +
           '<button class="danger-btn" onclick="rejectOrder(' + o.id + ')">Reject</button>';
  }
  if (o.status === 'approved') {
    return '<button class="pill-btn" onclick="sendOrder(' + o.id + ')">Send to Supplier</button>';
  }
  return '';
}

function filterProcurementOrders() { renderProcurementOrders(); }

async function approveOrder(orderId) {
  const supplierName = prompt('Enter supplier name:');
  if (!supplierName) return;
  try {
    const res = await fetch('/api/orders/requests/' + orderId + '/approve', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token() },
      body: JSON.stringify({ supplierName }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    await loadProcurementDashboard();
  } catch (e) {
    alert('Error: ' + e.message);
  }
}

async function rejectOrder(orderId) {
  const reason = prompt('Enter rejection reason:');
  if (!reason) return;
  try {
    const res = await fetch('/api/orders/requests/' + orderId + '/reject', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token() },
      body: JSON.stringify({ reason }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    await loadProcurementDashboard();
  } catch (e) {
    alert('Error: ' + e.message);
  }
}

async function sendOrder(orderId) {
  if (!confirm('Send this order to the supplier?')) return;
  try {
    const res = await fetch('/api/orders/requests/' + orderId + '/send', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token() },
      body: JSON.stringify({}),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    await loadProcurementDashboard();
  } catch (e) {
    alert('Error: ' + e.message);
  }
}

// ============================================================
// TENDER HISTORY
// ============================================================
function debouncedHistorySearch() {
  clearTimeout(historySearchTimer);
  historySearchTimer = setTimeout(loadTenderHistory, 300);
}

async function loadHistorySummary() {
  try {
    const res = await fetch('/api/orders/history/summary', { headers: { Authorization: 'Bearer ' + token() } });
    if (!res.ok) return;
    const s = await res.json();

    document.getElementById('hTotal').textContent = s.total;
    document.getElementById('hPending').textContent = s.byStatus.pending || 0;
    document.getElementById('hApproved').textContent = s.byStatus.approved || 0;
    document.getElementById('hRejected').textContent = s.byStatus.rejected || 0;
    document.getElementById('hReceived').textContent =
      (s.byStatus.received || 0) + (s.byStatus.in_storage || 0);
    document.getElementById('hRecent').textContent = s.last30Days;
  } catch (e) {
    console.error(e);
  }
}

async function loadTenderHistory() {
  const el = document.getElementById('proc-tenderHistoryList');
  const search = document.getElementById('histSearch').value.trim();
  const status = document.getElementById('histStatus').value;
  const department = document.getElementById('histDept').value;
  const from = document.getElementById('histFrom').value;
  const to = document.getElementById('histTo').value;

  const params = new URLSearchParams();
  if (search) params.set('search', search);
  if (status !== 'all') params.set('status', status);
  if (department !== 'all') params.set('department', department);
  if (from) params.set('from', from);
  if (to) params.set('to', to);

  el.innerHTML = '<p class="muted">Loading...</p>';

  try {
    const res = await fetch('/api/orders/history?' + params, { headers: { Authorization: 'Bearer ' + token() } });
    if (!res.ok) throw new Error('Failed');
    const tenders = await res.json();

    document.getElementById('histCount').textContent = '(' + tenders.length + ')';

    if (tenders.length === 0) {
      el.innerHTML = '<div class="empty-state">No Matching Tenders</div>';
      return;
    }

    el.innerHTML = tenders.map(t => {
      const supplier = t.procurementOrder && t.procurementOrder.supplierName
        ? '<p><em>Supplier:</em> ' + escapeHtml(t.procurementOrder.supplierName) + '</p>'
        : '';
      const timeline = (t.statusLogs || []).length > 0
        ? '<details><summary class="muted">Timeline (' + t.statusLogs.length + ' events)</summary>' +
          '<div class="tender-timeline">' +
          t.statusLogs.slice().reverse().map(log =>
            '<div class="tl-item"><span class="tl-dot"></span>' +
            '<span><strong>' + log.newStatus.toUpperCase() + '</strong> - ' +
            escapeHtml(log.changedBy) + ' - ' + fmtDateTime(log.timestamp) + '</span>' +
            (log.notes ? '<div class="muted">' + escapeHtml(log.notes) + '</div>' : '') +
            '</div>'
          ).join('') +
          '</div></details>'
        : '';

      return '<div class="tender-card">' +
        '<div class="tender-head">' +
        '<div>' +
        '<strong>#' + t.id + ' - ' + escapeHtml(t.itemName) + ' x' + t.quantity + '</strong>' +
        '<div class="muted"><span class="dept-pill">' + escapeHtml(t.requestingDepartment) +
        '</span> by ' + escapeHtml(t.requestingBy) + ' - ' + fmtDate(t.createdAt) + '</div>' +
        '</div>' +
        '<div>' + statusBadge(t.status) + '</div>' +
        '</div>' +
        '<div class="tender-body">' +
        '<p><em>Reason:</em> ' + escapeHtml(t.reason) + '</p>' +
        supplier +
        '</div>' +
        timeline +
        '</div>';
    }).join('');
  } catch (e) {
    el.innerHTML = '<p class="error">' + e.message + '</p>';
  }
}

function clearHistoryFilters() {
  document.getElementById('histSearch').value = '';
  document.getElementById('histStatus').value = 'all';
  document.getElementById('histDept').value = 'all';
  document.getElementById('histFrom').value = '';
  document.getElementById('histTo').value = '';
  loadTenderHistory();
}

async function exportTenderHistory() {
  try {
    const res = await fetch('/api/orders/history/export', { headers: { Authorization: 'Bearer ' + token() } });
    if (!res.ok) throw new Error('Export failed');
    const blob = await res.blob();
    downloadCSV(blob, 'tender-history-' + new Date().toISOString().split('T')[0] + '.csv');
  } catch (e) {
    alert(e.message);
  }
}

// ============================================================
// MY TENDERS
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
  document.querySelectorAll('#proc-tenderFilters .filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  tenderFilter = btn.dataset.filter;
  renderTenderTracker();
}

function filterTenders() { renderTenderTracker(); }

function renderTenderTracker() {
  const el = document.getElementById('proc-tenderTrackerList');
  const q = (document.getElementById('proc-tenderSearch')?.value || '').toLowerCase();

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
  downloadCSV(blob, 'tenders-procurement-' + new Date().toISOString().split('T')[0] + '.csv');
}
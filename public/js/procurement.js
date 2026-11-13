// ============================================================
// Sally Mugabe Central Hospital - Procurement Department
// ============================================================

let allProcurementOrders = [];
let procActiveFilter = 'all';
let historySearchTimer = null;
let histRange = 'all'; // 'all' | 'today' | 'week' | 'month' | 'year' | 'custom'

async function init_proc() {
  await loadProcurementDashboard();

  window.onOrderUpdated = (payload) => {
    loadProcurementDashboard();
    if (document.getElementById('procTabHistory')?.classList.contains('active')) {
      loadHistorySummary();
      loadTenderHistory();
    }
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

  if (tab === 'history') {
    const panel = document.getElementById('procTabHistory');
    if (panel) { panel.classList.add('active'); panel.style.display = 'block'; }
    const activePanel = document.getElementById('procTabActive');
    if (activePanel) { activePanel.classList.remove('active'); activePanel.style.display = 'none'; }

    loadHistorySummary();
    loadTenderHistory();
  } else {
    const panel = document.getElementById('procTabActive');
    if (panel) { panel.classList.add('active'); panel.style.display = 'block'; }
    const historyPanel = document.getElementById('procTabHistory');
    if (historyPanel) { historyPanel.classList.remove('active'); historyPanel.style.display = 'none'; }
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
    document.getElementById('proc-procOrdered').textContent = summary.ordered;
    document.getElementById('proc-procInStorage').textContent = summary.received;

    const awaitEl = document.getElementById('proc-procAwaiting');
    if (awaitEl) awaitEl.textContent = summary.awaitingQuotation ?? 0;
  } catch (e) {
    console.error(e);
  }
}

function setProcActiveFilter(btn) {
  const bar = btn.closest('.filter-bar, .tender-filters');
  if (bar) bar.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
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
      String(o.originatorDepartment || '').toLowerCase().includes(q) ||
      String(o.requestingBy || '').toLowerCase().includes(q) ||
      String(o.id).includes(q));
  }

  if (list.length === 0) {
    const label = procActiveFilter === 'all' ? '' : procActiveFilter.toUpperCase() + ' ';
    el.innerHTML = '<div class="empty-state">No ' + label + 'Tenders</div>';
    return;
  }

  el.innerHTML = list.map(o => {
    const submitter = o.requestingDepartment || '';
    const originator = o.originatorDepartment || submitter;
    let originatorLine = '';
    if (submitter.toLowerCase() !== originator.toLowerCase()) {
      originatorLine = ' <span class="muted">(submitted by ' + escapeHtml(submitter) + ' for ' + escapeHtml(originator) + ')</span>';
    }

    const supplier = o.procurementOrder && o.procurementOrder.supplierName
      ? '<p><em>Supplier:</em> ' + escapeHtml(o.procurementOrder.supplierName) + '</p>'
      : '';
    const actions = renderProcOrderActions(o);

    return '<div class="tender-card">' +
      '<div class="tender-head">' +
      '<div>' +
      '<strong>#' + o.id + ' - ' + escapeHtml(o.itemName) + ' x' + o.quantity + '</strong>' +
      '<div class="muted"><span class="dept-pill">' + escapeHtml(originator) + '</span>' +
      originatorLine + '</div>' +
      '</div>' +
      '<div>' + statusBadge(o.status) + '</div>' +
      '</div>' +
      '<div class="tender-body">' +
      '<p><em>Issued:</em> ' + fmtDate(o.createdAt) + '</p>' +
      '<p><em>Reason:</em> ' + escapeHtml(o.reason) + '</p>' +
      supplier +
      '</div>' +
      (actions ? '<div class="order-actions">' + actions + '</div>' : '') +
      '</div>';
  }).join('');
}

function renderProcOrderActions(o) {
  if (o.status === 'pending' || o.status === 'awaiting_quotation') {
    return '<button class="success-btn" onclick="openApproveModal(' + o.id + ')">Approve and Send</button>' +
           '<button class="ghost-btn" onclick="openAwaitQuotationModal(' + o.id + ')">Waiting for Quotation</button>';
  }
  return '';
}

function filterProcurementOrders() { renderProcurementOrders(); }

// ============================================================
// APPROVE MODAL
// ============================================================
function openApproveModal(orderId) {
  const o = allProcurementOrders.find(x => x.id === orderId);
  if (!o) return;

  if (!document.getElementById('approveOrderId')) {
    const f = document.createElement('input');
    f.type = 'hidden';
    f.id = 'approveOrderId';
    document.body.appendChild(f);
  }

  document.getElementById('approveOrderId').value = orderId;
  document.getElementById('approveOrderLabel').textContent =
    '#' + o.id + ' - ' + o.itemName + ' x' + o.quantity +
    ' (for ' + (o.originatorDepartment || o.requestingDepartment) + ')';
  document.getElementById('approveSupplierName').value = '';
  document.getElementById('approveExpectedDate').value = '';
  document.getElementById('approveNotes').value = '';
  document.getElementById('approveMessage').innerHTML = '';

  if (document.getElementById('approvePriceUsd')) document.getElementById('approvePriceUsd').value = '';
  if (document.getElementById('approvePriceZwg')) document.getElementById('approvePriceZwg').value = '';

  document.getElementById('approveModal').classList.add('active');
  document.getElementById('modalBackdrop').classList.add('active');
}

function closeApproveModal() {
  document.getElementById('approveModal').classList.remove('active');
  document.getElementById('modalBackdrop').classList.remove('active');
}

async function confirmApprove() {
  const id = document.getElementById('approveOrderId').value;
  const supplierName = document.getElementById('approveSupplierName').value.trim();
  const expectedDeliveryDate = document.getElementById('approveExpectedDate').value;
  const approvalNotes = document.getElementById('approveNotes').value.trim();
  const priceUsd = document.getElementById('approvePriceUsd')?.value;
  const priceZwg = document.getElementById('approvePriceZwg')?.value;
  const msg = document.getElementById('approveMessage');

  if (!supplierName) {
    msg.innerHTML = '<div class="error">Supplier name is required</div>';
    return;
  }

  try {
    const res = await fetch('/api/orders/requests/' + id + '/approve', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token() },
      body: JSON.stringify({ supplierName, expectedDeliveryDate, approvalNotes, priceUsd, priceZwg }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    closeApproveModal();
    await loadProcurementDashboard();
  } catch (e) {
    msg.innerHTML = '<div class="error">' + e.message + '</div>';
  }
}

// ============================================================
// WAITING FOR QUOTATION MODAL
// ============================================================
function openAwaitQuotationModal(orderId) {
  const o = allProcurementOrders.find(x => x.id === orderId);
  if (!o) return;

  if (!document.getElementById('awaitOrderId')) {
    const f = document.createElement('input');
    f.type = 'hidden';
    f.id = 'awaitOrderId';
    document.body.appendChild(f);
  }

  document.getElementById('awaitOrderId').value = orderId;
  document.getElementById('awaitOrderLabel').textContent =
    '#' + o.id + ' - ' + o.itemName + ' x' + o.quantity;
  document.getElementById('awaitNote').value = '';
  document.getElementById('awaitMessage').innerHTML = '';

  document.getElementById('awaitModal').classList.add('active');
  document.getElementById('modalBackdrop').classList.add('active');
}

function closeAwaitModal() {
  document.getElementById('awaitModal').classList.remove('active');
  document.getElementById('modalBackdrop').classList.remove('active');
}

async function confirmAwaitQuotation() {
  const id = document.getElementById('awaitOrderId').value;
  const note = document.getElementById('awaitNote').value.trim();
  const msg = document.getElementById('awaitMessage');

  try {
    const res = await fetch('/api/orders/requests/' + id + '/await-quotation', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token() },
      body: JSON.stringify({ note }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    closeAwaitModal();
    await loadProcurementDashboard();
  } catch (e) {
    msg.innerHTML = '<div class="error">' + e.message + '</div>';
  }
}

// ============================================================
// NATIVE "New Tender Request" + "My Department Tenders"
// (owned by this portal fragment; the global injected copies
//  from projects.js remain as extra convenience below the portal)
// ============================================================
let allMyTenders = [];
let myTenderFilter = 'all';

async function submitTenderRequest(deptKey) {
  const originatorDepartment = document.getElementById(deptKey + '-reqOriginator')?.value || currentDeptName;
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
      body: JSON.stringify({ itemName, quantity: parseInt(quantity), reason, originatorDepartment }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    msg.innerHTML = '<div class="success">Request submitted</div>';
    document.getElementById(deptKey + '-reqItemName').value = '';
    document.getElementById(deptKey + '-reqQuantity').value = '';
    document.getElementById(deptKey + '-reqReason').value = '';
    await loadMyTenders();
    await loadProcurementDashboard();
  } catch (e) {
    msg.innerHTML = '<div class="error">' + e.message + '</div>';
  }
}

async function loadMyTenders() {
  const res = await fetch('/api/orders/my', { headers: { Authorization: 'Bearer ' + token() } });
  if (!res.ok) return;
  allMyTenders = await res.json();
  renderMyTenders();
}

function setTenderFilter(btn) {
  const bar = btn.closest('.filter-bar, .tender-filters');
  if (bar) bar.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  myTenderFilter = btn.dataset.filter;
  renderMyTenders();
}

function filterTenders() { renderMyTenders(); }

function renderMyTenders() {
  const el = document.getElementById('proc-tenderTrackerList');
  if (!el) return;

  const q = (document.getElementById('proc-tenderSearch')?.value || '').toLowerCase();

  let list = allMyTenders;
  if (myTenderFilter !== 'all') list = list.filter(t => t.status === myTenderFilter);
  if (q) list = list.filter(t => String(t.itemName).toLowerCase().includes(q));

  if (list.length === 0) {
    el.innerHTML = '<div class="empty-state">No Tenders</div>';
    return;
  }

  const myDept = String(currentDeptName || '').toLowerCase();

  el.innerHTML = list.map(t => {
    const submitter = t.requestingDepartment || '';
    const originator = t.originatorDepartment || submitter;
    const submittedByMe = String(submitter).toLowerCase() === myDept;
    const submittedForMe = String(originator).toLowerCase() === myDept;

    let meta = 'Requested by: ' + escapeHtml(submitter);
    if (!submittedByMe && submittedForMe) {
      meta = 'Requested FOR your department by ' + escapeHtml(submitter);
    } else if (submittedByMe && originator.toLowerCase() !== submitter.toLowerCase()) {
      meta = 'Submitted by you FOR ' + escapeHtml(originator);
    }

    return '<div class="tender-card">' +
      '<div class="tender-head">' +
      '<div>' +
      '<strong>#' + t.id + ' - ' + escapeHtml(t.itemName) + ' x' + t.quantity + '</strong>' +
      '<div class="muted">' + meta + '</div>' +
      '</div>' +
      '<div>' + statusBadge(t.status) + '</div>' +
      '</div>' +
      '<div class="tender-body">' +
      '<p><em>Issued:</em> ' + fmtDate(t.createdAt) + '</p>' +
      '<p><em>Reason:</em> ' + escapeHtml(t.reason) + '</p>' +
      '</div>' +
      '</div>';
  }).join('');
}

function printMyTenders() {
  if (allMyTenders.length === 0) { alert('No tenders to print.'); return; }
  const hospitalName = (systemSettings.hospitalName || 'Sally Mugabe Central Hospital').toUpperCase();
  const now = new Date();
  let html = '<div class="print-page a4"><div class="print-header"><h1>' + escapeHtml(hospitalName) + '</h1><h2>Procurement Department Tenders</h2></div>';
  html += '<div class="print-meta"><p><strong>Total:</strong> ' + allMyTenders.length + '</p><p><strong>Generated:</strong> ' + fmtDateTime(now) + '</p></div>';
  html += '<table class="print-table"><thead><tr><th>#</th><th>Item</th><th>Qty</th><th>Status</th><th>Supplier</th><th>Issued</th></tr></thead><tbody>';
  allMyTenders.forEach((t, i) => {
    const supplier = t.procurementOrder ? t.procurementOrder.supplierName : '-';
    html += '<tr><td>' + (i + 1) + '</td><td>' + escapeHtml(t.itemName) + '</td><td>' + t.quantity + '</td><td>' + String(t.status).toUpperCase() + '</td><td>' + escapeHtml(supplier) + '</td><td>' + fmtDate(t.createdAt) + '</td></tr>';
  });
  html += '</tbody></table><div class="print-footer">' + escapeHtml(hospitalName) + ' - Generated ' + fmtDateTime(now) + '</div></div>';
  printContent(html);
}

// ============================================================
// TENDER HISTORY — all tenders ever issued
// ============================================================
function debouncedHistorySearch() {
  clearTimeout(historySearchTimer);
  historySearchTimer = setTimeout(loadTenderHistory, 300);
}

function _toInputDate(d) {
  // core.js exports toInputDate globally; fall back if not available
  if (typeof toInputDate === 'function') return toInputDate(d);
  const dt = d instanceof Date ? d : new Date(d);
  const yyyy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return yyyy + '-' + mm + '-' + dd;
}

function setHistoryRange(range) {
  histRange = range;

  const fromEl = document.getElementById('histFrom');
  const toEl = document.getElementById('histTo');
  if (!fromEl || !toEl) return;

  const now = new Date();
  if (range === 'all') {
    fromEl.value = '';
    toEl.value = '';
  } else if (range === 'today') {
    fromEl.value = _toInputDate(now);
    toEl.value = _toInputDate(now);
  } else if (range === 'week') {
    const day = now.getDay();
    const sunday = new Date(now);
    sunday.setDate(now.getDate() - day);
    fromEl.value = _toInputDate(sunday);
    toEl.value = _toInputDate(now);
  } else if (range === 'month') {
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    fromEl.value = _toInputDate(first);
    toEl.value = _toInputDate(now);
  } else if (range === 'year') {
    const first = new Date(now.getFullYear(), 0, 1);
    fromEl.value = _toInputDate(first);
    toEl.value = _toInputDate(now);
  } else if (range === 'custom') {
    // leave inputs as user set them
  }

  ['all', 'today', 'week', 'month', 'year'].forEach(r => {
    const btn = document.getElementById('hist-range-' + r);
    if (btn) btn.classList.toggle('active', r === range);
  });

  loadTenderHistory();
}

function onHistoryCustomDateChange() {
  histRange = 'custom';
  ['all', 'today', 'week', 'month', 'year'].forEach(r => {
    const btn = document.getElementById('hist-range-' + r);
    if (btn) btn.classList.remove('active');
  });
  loadTenderHistory();
}

async function loadHistorySummary() {
  try {
    const res = await fetch('/api/orders/history/summary', { headers: { Authorization: 'Bearer ' + token() } });
    if (!res.ok) return;
    const s = await res.json();

    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('hTotal', s.total);
    set('hPending', s.byStatus.pending || 0);
    set('hApproved', s.byStatus.ordered || 0);
    set('hRejected', s.byStatus.awaiting_quotation || 0);
    set('hReceived', (s.byStatus.received || 0) + (s.byStatus.in_storage || 0));
    set('hRecent', s.last30Days);
  } catch (e) {
    console.error(e);
  }
}

async function loadTenderHistory() {
  const el = document.getElementById('proc-tenderHistoryList');
  if (!el) return;

  const search = document.getElementById('histSearch').value.trim();
  const status = document.getElementById('histStatus').value;
  const department = document.getElementById('histDept')?.value || 'all';
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
    if (!res.ok) throw new Error('Failed to load history');
    const tenders = await res.json();

    const countEl = document.getElementById('histCount');
    if (countEl) countEl.textContent = '(' + tenders.length + ' tenders)';

    if (tenders.length === 0) {
      el.innerHTML = '<div class="empty-state">No Matching Tenders</div>';
      return;
    }

    el.innerHTML = tenders.map(t => {
      const submitter = t.requestingDepartment || '';
      const originator = t.originatorDepartment || submitter;
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
        '<div class="muted"><span class="dept-pill">' + escapeHtml(originator) + '</span>' +
        (submitter !== originator ? ' (submitted by ' + escapeHtml(submitter) + ')' : '') +
        ' by ' + escapeHtml(t.requestingBy) + '</div>' +
        '</div>' +
        '<div>' + statusBadge(t.status) + '</div>' +
        '</div>' +
        '<div class="tender-body">' +
        '<p><em>Issued:</em> ' + fmtDate(t.createdAt) + '</p>' +
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
  // Reset to "All Time"
  document.getElementById('histFrom').value = '';
  document.getElementById('histTo').value = '';
  histRange = 'all';
  ['all', 'today', 'week', 'month', 'year'].forEach(r => {
    const btn = document.getElementById('hist-range-' + r);
    if (btn) btn.classList.toggle('active', r === 'all');
  });
  loadTenderHistory();
}

// ============================================================
// PRINT
// ============================================================
function printTenderHistory() {
  const el = document.getElementById('proc-tenderHistoryList');
  if (!el || !el.innerHTML || el.querySelector('.empty-state') || el.querySelector('.error')) {
    alert('No history to print.');
    return;
  }

  const hospitalName = (systemSettings.hospitalName || 'Sally Mugabe Central Hospital').toUpperCase();
  const now = new Date();

  const search = document.getElementById('histSearch').value.trim();
  const status = document.getElementById('histStatus').value;
  const department = document.getElementById('histDept').value;
  const from = document.getElementById('histFrom').value;
  const to = document.getElementById('histTo').value;

  const filters = [];
  if (search) filters.push('Search="' + search + '"');
  if (status !== 'all') filters.push('Status=' + status);
  if (department !== 'all') filters.push('Department=' + department);
  if (from) filters.push('From=' + from);
  if (to) filters.push('To=' + to);
  const filterLine = filters.length > 0 ? 'Filters: ' + filters.join(', ') : 'Filters: none (all tenders ever issued)';

  let html = '<div class="print-page a4">';
  html += '<div class="print-header"><h1>' + escapeHtml(hospitalName) + '</h1><h2>Tender History — All Tenders Ever Issued</h2></div>';
  html += '<div class="print-meta">';
  html += '<p><strong>Report Generated:</strong> ' + fmtDateTime(now) + '</p>';
  html += '<p style="grid-column: span 2;"><strong>' + escapeHtml(filterLine) + '</strong></p>';
  html += '</div>';
  html += '<table class="print-table"><thead><tr>';
  html += '<th>#</th><th>Item</th><th>Qty</th><th>Dept</th><th>Status</th><th>Supplier</th><th>Issued</th>';
  html += '</tr></thead><tbody>';

  el.querySelectorAll('.tender-card').forEach((card, idx) => {
    const lines = card.innerText.split('\n').map(s => s.trim()).filter(Boolean);
    // Fallback: just print the card's readable text in one cell.
    const text = card.innerText.replace(/\s+/g, ' ').trim();
    html += '<tr><td>' + (idx + 1) + '</td><td colspan="6">' + escapeHtml(text) + '</td></tr>';
  });

  html += '</tbody></table>';
  html += '<div class="print-footer">' + escapeHtml(hospitalName) + ' - Generated ' + fmtDateTime(now) + '</div>';
  html += '</div>';
  printContent(html);
}

// ============================================================
// INIT
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  // Show Active Board by default; ensure the History panel is hidden.
  const active = document.getElementById('procTabActive');
  const history = document.getElementById('procTabHistory');
  if (active) active.style.display = 'block';
  if (history) history.style.display = 'none';
});
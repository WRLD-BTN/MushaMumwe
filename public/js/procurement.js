// ============================================================
// Sally Mugabe Central Hospital - Procurement Department
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
    const sub = String(payload?.department || '').toLowerCase();
    const orig = String(payload?.originator || '').toLowerCase();
    if (sub === myDept || orig === myDept) loadMyTenders();
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
    document.getElementById('proc-procOrdered').textContent = summary.ordered;
    document.getElementById('proc-procInStorage').textContent = summary.received;

    const awaitEl = document.getElementById('proc-procAwaiting');
    if (awaitEl) awaitEl.textContent = summary.awaitingQuotation ?? 0;

    const rejEl = document.getElementById('proc-procRejected');
    if (rejEl) rejEl.textContent = 0;
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

  document.getElementById('approveOrderId') || (function () {
    // Create hidden field if not present
    const f = document.createElement('input');
    f.type = 'hidden';
    f.id = 'approveOrderId';
    document.body.appendChild(f);
  })();

  document.getElementById('approveOrderId').value = orderId;
  document.getElementById('approveOrderLabel').textContent =
    '#' + o.id + ' - ' + o.itemName + ' x' + o.quantity +
    ' (for ' + (o.originatorDepartment || o.requestingDepartment) + ')';
  document.getElementById('approveSupplierName').value = '';
  document.getElementById('approveExpectedDate').value = '';
  document.getElementById('approveNotes').value = '';
  document.getElementById('approveMessage').innerHTML = '';

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
  const msg = document.getElementById('approveMessage');

  if (!supplierName) {
    msg.innerHTML = '<div class="error">Supplier name is required</div>';
    return;
  }

  try {
    const res = await fetch('/api/orders/requests/' + id + '/approve', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token() },
      body: JSON.stringify({ supplierName, expectedDeliveryDate, approvalNotes }),
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
    document.getElementById('hApproved').textContent = s.byStatus.ordered || 0;
    document.getElementById('hRejected').textContent = s.byStatus.awaiting_quotation || 0;
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
        ' by ' + escapeHtml(t.requestingBy) + ' - ' + fmtDate(t.createdAt) + '</div>' +
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

  const myDept = String(currentDeptName || '').toLowerCase();

  el.innerHTML = list.map(t => {
    const submitter = t.requestingDepartment || '';
    const originator = t.originatorDepartment || submitter;
    const submittedByMe = String(submitter).toLowerCase() === myDept;
    const submittedForMe = String(originator).toLowerCase() === myDept;

    let meta = 'Requested by: ' + escapeHtml(submitter);
    if (!submittedByMe && submittedForMe) {
      meta = 'Requested FOR your department by ' + escapeHtml(submitter);
    } else if (submittedByMe && originator !== submitter) {
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
      '<div class="tender-body"><p><em>Reason:</em> ' + escapeHtml(t.reason) + '</p></div>' +
      '</div>';
  }).join('');
}

async function exportMyTenders() {
  const res = await fetch('/api/orders/my/export', { headers: { Authorization: 'Bearer ' + token() } });
  if (!res.ok) return alert('Export failed');
  const blob = await res.blob();
  downloadCSV(blob, 'tenders-procurement-' + new Date().toISOString().split('T')[0] + '.csv');
}
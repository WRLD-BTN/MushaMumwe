// ============================================================
// Sally Mugabe Central Hospital - Procurement Department
// ============================================================

let allProcurementOrders = [];
let allTenders = [];
let tenderFilter = 'all';
let procActiveFilter = 'all';   // status filter for the main tender list
let procDeptFilter   = 'all';   // department filter for the main tender list

// ============================================================
// INIT
// ============================================================
async function init_proc() {
  await loadProcurementDashboard();
  await loadMyTenders();

  window.onOrderUpdated = (payload) => {
    loadProcurementDashboard();
    const myDept = String(currentDeptName || '').toLowerCase();
    const sub  = String(payload?.department || '').toLowerCase();
    const orig = String(payload?.originator || '').toLowerCase();
    if (sub === myDept || orig === myDept) loadMyTenders();
  };

  window.onOrderCreated = () => loadProcurementDashboard();
}

// ============================================================
// LOAD DASHBOARD (summary + all tenders)
// ============================================================
async function loadProcurementDashboard() {
  try {
    const [reqRes, sumRes] = await Promise.all([
      fetch('/api/orders/requests', { headers: { Authorization: 'Bearer ' + token() } }),
      fetch('/api/orders/summary',  { headers: { Authorization: 'Bearer ' + token() } }),
    ]);

    allProcurementOrders = await reqRes.json();
    const summary = await sumRes.json();

    renderProcurementOrders();

    document.getElementById('proc-procPending').textContent   = summary.pending    ?? 0;
    document.getElementById('proc-procOrdered').textContent   = summary.ordered    ?? 0;
    document.getElementById('proc-procInStorage').textContent = summary.received   ?? 0;

    const awaitEl = document.getElementById('proc-procAwaiting');
    if (awaitEl) awaitEl.textContent = summary.awaitingQuotation ?? 0;
  } catch (e) {
    console.error('Failed to load procurement dashboard:', e);
  }
}

// ============================================================
// FILTERS — STATUS
// ============================================================
function setProcActiveFilter(btn) {
  const bar = btn.closest('.tender-filters');
  if (bar) bar.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  procActiveFilter = btn.dataset.filter;
  filterProcurementOrders();
}

// ============================================================
// FILTERS — DEPARTMENT
// ============================================================
function setProcDeptFilter(btn) {
  const bar = btn.closest('.tender-filters');
  if (bar) bar.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  procDeptFilter = btn.dataset.dept;
  filterProcurementOrders();
}

// ============================================================
// FILTERS — CLEAR ALL
// ============================================================
function clearProcFilters() {
  procActiveFilter = 'all';
  procDeptFilter   = 'all';

  const search = document.getElementById('proc-pendingSearch');
  const from   = document.getElementById('proc-filterFrom');
  const to     = document.getElementById('proc-filterTo');
  if (search) search.value = '';
  if (from)   from.value = '';
  if (to)     to.value = '';

  const statusBar = document.getElementById('proc-activeFilters');
  if (statusBar) {
    statusBar.querySelectorAll('.filter-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.filter === 'all');
    });
  }

  const deptBar = document.getElementById('proc-deptFilters');
  if (deptBar) {
    deptBar.querySelectorAll('.filter-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.dept === 'all');
    });
  }

  filterProcurementOrders();
}

// ============================================================
// FILTER + RENDER MAIN TENDER LIST
// ============================================================
function filterProcurementOrders() {
  renderProcurementOrders();
}

function renderProcurementOrders() {
  const el = document.getElementById('proc-pendingOrdersList');
  if (!el) return;

  const search  = (document.getElementById('proc-pendingSearch')?.value || '').trim().toLowerCase();
  const fromStr = document.getElementById('proc-filterFrom')?.value || '';
  const toStr   = document.getElementById('proc-filterTo')?.value   || '';

  const fromDate = fromStr ? new Date(fromStr + 'T00:00:00')       : null;
  const toDate   = toStr   ? new Date(toStr   + 'T23:59:59.999')   : null;

  let list = allProcurementOrders;

  // STATUS FILTER
  if (procActiveFilter !== 'all') {
    if (procActiveFilter === 'received') {
      list = list.filter(o => o.status === 'received' || o.status === 'in_storage');
    } else {
      list = list.filter(o => o.status === procActiveFilter);
    }
  }

  // DEPARTMENT FILTER (matches originator OR submitter)
  if (procDeptFilter !== 'all') {
    const want = procDeptFilter.toLowerCase();
    list = list.filter(o => {
      const sub  = String(o.requestingDepartment || '').toLowerCase();
      const orig = String(o.originatorDepartment || '').toLowerCase();
      return sub === want || orig === want;
    });
  }

  // DATE RANGE FILTER (uses createdAt)
  if (fromDate || toDate) {
    list = list.filter(o => {
      if (!o.createdAt) return false;
      const d = new Date(o.createdAt);
      if (fromDate && d < fromDate) return false;
      if (toDate   && d > toDate)   return false;
      return true;
    });
  }

  // SEARCH FILTER
  if (search) {
    list = list.filter(o =>
      String(o.itemName || '').toLowerCase().includes(search) ||
      String(o.requestingDepartment || '').toLowerCase().includes(search) ||
      String(o.originatorDepartment || '').toLowerCase().includes(search) ||
      String(o.requestingBy || '').toLowerCase().includes(search) ||
      String(o.reason || '').toLowerCase().includes(search) ||
      String(o.id).includes(search)
    );
  }

  // RESULT COUNT LINE
  const countEl = document.getElementById('proc-resultCount');
  if (countEl) {
    const bits = [];
    if (procActiveFilter !== 'all') bits.push('status=' + procActiveFilter.replace('_', ' '));
    if (procDeptFilter   !== 'all') bits.push('dept=' + procDeptFilter);
    if (fromStr) bits.push('from=' + fromStr);
    if (toStr)   bits.push('to=' + toStr);
    if (search)  bits.push('search="' + search + '"');
    const desc = bits.length ? ' (filters: ' + bits.join(', ') + ')' : ' (no filters - showing all)';
    countEl.textContent = list.length + ' tender' + (list.length === 1 ? '' : 's') + desc;
  }

  if (list.length === 0) {
    el.innerHTML = '<div class="empty-state">No Matching Tenders</div>';
    return;
  }

  el.innerHTML = list.map(o => {
    const submitter  = o.requestingDepartment || '';
    const originator = o.originatorDepartment || submitter;
    let originatorLine = '';
    if (submitter.toLowerCase() !== originator.toLowerCase()) {
      originatorLine = ' <span class="muted">(submitted by ' + escapeHtml(submitter) +
                       ' for ' + escapeHtml(originator) + ')</span>';
    }

    const supplier = o.procurementOrder && o.procurementOrder.supplierName
      ? '<p><em>Supplier:</em> ' + escapeHtml(o.procurementOrder.supplierName) + '</p>'
      : '';

    const timeline = (o.statusLogs || []).length > 0
      ? '<details><summary class="muted">Timeline (' + o.statusLogs.length + ' events)</summary>' +
        '<div class="tender-timeline">' +
        o.statusLogs.slice().reverse().map(log =>
          '<div class="tl-item"><span class="tl-dot"></span>' +
          '<span><strong>' + log.newStatus.toUpperCase() + '</strong> - ' +
          escapeHtml(log.changedBy) + ' - ' + fmtDateTime(log.timestamp) + '</span>' +
          (log.notes ? '<div class="muted">' + escapeHtml(log.notes) + '</div>' : '') +
          '</div>'
        ).join('') +
        '</div></details>'
      : '';

    const actions = renderProcOrderActions(o);

    return '<div class="tender-card">' +
      '<div class="tender-head">' +
      '<div>' +
      '<strong>#' + o.id + ' - ' + escapeHtml(o.itemName) + ' x' + o.quantity + '</strong>' +
      '<div class="muted"><span class="dept-pill">' + escapeHtml(originator) + '</span>' +
      originatorLine +
      ' - ' + fmtDate(o.createdAt) + '</div>' +
      '</div>' +
      '<div>' + statusBadge(o.status) + '</div>' +
      '</div>' +
      '<div class="tender-body">' +
      '<p><em>Reason:</em> ' + escapeHtml(o.reason) + '</p>' +
      supplier +
      '</div>' +
      timeline +
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

  document.getElementById('approveModal').classList.add('active');
  document.getElementById('modalBackdrop').classList.add('active');
}

function closeApproveModal() {
  document.getElementById('approveModal').classList.remove('active');
  document.getElementById('modalBackdrop').classList.remove('active');
}

// Inside confirmApprove, update the fields being grabbed and sent
async function confirmApprove() {
  const id = document.getElementById('approveOrderId').value;
  const supplierName = document.getElementById('approveSupplierName').value.trim();
  const expectedDeliveryDate = document.getElementById('approveExpectedDate').value;
  const approvalNotes = document.getElementById('approveNotes').value.trim();
  
  const priceUsd = document.getElementById('approvePriceUsd').value;
  const priceZwg = document.getElementById('approvePriceZwg').value;

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
    await loadMyTenders();
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
    await loadMyTenders();
  } catch (e) {
    msg.innerHTML = '<div class="error">' + e.message + '</div>';
  }
}

// ============================================================
// NEW TENDER SUBMISSION
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
    await loadProcurementDashboard();
  } catch (e) {
    msg.innerHTML = '<div class="error">' + e.message + '</div>';
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Submit Request'; }
  }
}

// ============================================================
// MY DEPARTMENT TENDERS
// ============================================================
async function loadMyTenders() {
  const res = await fetch('/api/orders/my', { headers: { Authorization: 'Bearer ' + token() } });
  if (!res.ok) return;
  allTenders = await res.json();
  renderTenderTracker();
}

function setTenderFilter(btn) {
  const bar = btn.closest('.filter-bar, .tender-filters');
  if (bar) bar.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  tenderFilter = btn.dataset.filter;
  renderTenderTracker();
}

function filterTenders() { renderTenderTracker(); }

function renderTenderTracker() {
  const el = document.getElementById('proc-tenderTrackerList');
  if (!el) return;

  const q = (document.getElementById('proc-tenderSearch')?.value || '').toLowerCase();

  let list = allTenders;
  if (tenderFilter !== 'all') {
    if (tenderFilter === 'received') {
      list = list.filter(t => t.status === 'received' || t.status === 'in_storage');
    } else {
      list = list.filter(t => t.status === tenderFilter);
    }
  }
  if (q) list = list.filter(t => String(t.itemName).toLowerCase().includes(q));

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

// ============================================================
// PRINT — MAIN TENDER LIST (respects active filters)
// ============================================================
function printTenderHistory() {
  const search  = (document.getElementById('proc-pendingSearch')?.value || '').trim();
  const fromStr = document.getElementById('proc-filterFrom')?.value || '';
  const toStr   = document.getElementById('proc-filterTo')?.value   || '';

  const fromDate = fromStr ? new Date(fromStr + 'T00:00:00')     : null;
  const toDate   = toStr   ? new Date(toStr   + 'T23:59:59.999') : null;

  let list = allProcurementOrders;

  if (procActiveFilter !== 'all') {
    if (procActiveFilter === 'received') {
      list = list.filter(o => o.status === 'received' || o.status === 'in_storage');
    } else {
      list = list.filter(o => o.status === procActiveFilter);
    }
  }
  if (procDeptFilter !== 'all') {
    const want = procDeptFilter.toLowerCase();
    list = list.filter(o => {
      const sub  = String(o.requestingDepartment || '').toLowerCase();
      const orig = String(o.originatorDepartment || '').toLowerCase();
      return sub === want || orig === want;
    });
  }
  if (fromDate || toDate) {
    list = list.filter(o => {
      if (!o.createdAt) return false;
      const d = new Date(o.createdAt);
      if (fromDate && d < fromDate) return false;
      if (toDate   && d > toDate)   return false;
      return true;
    });
  }
  if (search) {
    const q = search.toLowerCase();
    list = list.filter(o =>
      String(o.itemName || '').toLowerCase().includes(q) ||
      String(o.requestingDepartment || '').toLowerCase().includes(q) ||
      String(o.originatorDepartment || '').toLowerCase().includes(q) ||
      String(o.requestingBy || '').toLowerCase().includes(q) ||
      String(o.reason || '').toLowerCase().includes(q) ||
      String(o.id).includes(q)
    );
  }

  if (list.length === 0) { alert('No tenders match the current filters.'); return; }

  const hospitalName = (systemSettings.hospitalName || 'Sally Mugabe Central Hospital').toUpperCase();
  const now = new Date();

  const filterParts = [];
  if (procActiveFilter !== 'all') filterParts.push('Status=' + procActiveFilter.replace('_', ' '));
  if (procDeptFilter   !== 'all') filterParts.push('Department=' + procDeptFilter);
  if (fromStr) filterParts.push('From=' + fromStr);
  if (toStr)   filterParts.push('To=' + toStr);
  if (search)  filterParts.push('Search="' + search + '"');
  const filterLine = filterParts.length ? 'Filters: ' + filterParts.join(', ') : 'Filters: none (all tenders)';

  let html = '<div class="print-page a4">';
  html += '<div class="print-header"><h1>' + escapeHtml(hospitalName) + '</h1><h2>Tender Report</h2></div>';
  html += '<div class="print-meta">' +
          '<p><strong>Total Tenders:</strong> ' + list.length + '</p>' +
          '<p><strong>Generated:</strong> ' + fmtDateTime(now) + '</p>' +
          '<p style="grid-column: span 2;"><strong>' + escapeHtml(filterLine) + '</strong></p>' +
          '</div>';
  html += '<table class="print-table"><thead><tr>' +
          '<th>#</th><th>Item</th><th>Qty</th><th>Dept</th><th>Status</th><th>Supplier</th><th>Date</th>' +
          '</tr></thead><tbody>';
  list.forEach((t, idx) => {
    const dept     = t.originatorDepartment || t.requestingDepartment || '-';
    const supplier = t.procurementOrder ? t.procurementOrder.supplierName : '-';
    html += '<tr><td>' + (idx + 1) + '</td><td>' + escapeHtml(t.itemName) + '</td><td>' + t.quantity + '</td><td>' +
            escapeHtml(dept) + '</td><td>' + t.status.toUpperCase() + '</td><td>' + escapeHtml(supplier) + '</td><td>' +
            fmtDate(t.createdAt) + '</td></tr>';
  });
  html += '</tbody></table><div class="print-footer">' + escapeHtml(hospitalName) + ' - Generated ' + fmtDateTime(now) + '</div></div>';
  printContent(html);
}

// ============================================================
// PRINT — MY DEPARTMENT TENDERS
// ============================================================
function printMyTenders() {
  if (allTenders.length === 0) { alert('No tenders to print.'); return; }
  const hospitalName = (systemSettings.hospitalName || 'Sally Mugabe Central Hospital').toUpperCase();
  const now = new Date();
  let html = '<div class="print-page a4"><div class="print-header"><h1>' + escapeHtml(hospitalName) + '</h1><h2>Procurement Department Tenders</h2></div>';
  html += '<div class="print-meta"><p><strong>Total:</strong> ' + allTenders.length + '</p><p><strong>Generated:</strong> ' + fmtDateTime(now) + '</p></div>';
  html += '<table class="print-table"><thead><tr><th>#</th><th>Item</th><th>Qty</th><th>Status</th><th>Supplier</th><th>Date</th></tr></thead><tbody>';
  allTenders.forEach((t, i) => {
    const supplier = t.procurementOrder ? t.procurementOrder.supplierName : '-';
    html += '<tr><td>' + (i + 1) + '</td><td>' + escapeHtml(t.itemName) + '</td><td>' + t.quantity + '</td><td>' + String(t.status).toUpperCase() + '</td><td>' + escapeHtml(supplier) + '</td><td>' + fmtDate(t.createdAt) + '</td></tr>';
  });
  html += '</tbody></table><div class="print-footer">' + escapeHtml(hospitalName) + ' - Generated ' + fmtDateTime(now) + '</div></div>';
  printContent(html);
}
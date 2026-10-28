let allPatients = [];
let allTenders = [];
let allDischarges = [];
let tenderFilter = 'all';
let patientSearchTimer = null;
let dischargeSearchTimer = null;
let selectedPatientIdForDischarge = null;
let patientToPrint = null;

async function init_nurses() {
  await loadWards();
  await runPatientSearch();
  await loadMyTenders();
  await loadDischargeRecords();
  registerNursesSocketHandlers();
  await checkFollowups();
  updatePatientFilters(); 
}

// ============================================================
// TENDER SUBMISSION
// ============================================================
async function submitNursesTender() {
  const originatorDepartment = document.getElementById('nurses-reqOriginator').value;
  const itemName = document.getElementById('nurses-reqItemName').value.trim();
  const quantity = document.getElementById('nurses-reqQuantity').value;
  const reason = document.getElementById('nurses-reqReason').value.trim();
  const msg = document.getElementById('nurses-requestMessage');

  if (!itemName || !quantity || !reason) {
    msg.innerHTML = '<span style="color: var(--error);">All fields required</span>';
    return;
  }

  const btn = document.querySelector('button[onclick="submitNursesTender()"]');
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

    msg.innerHTML = '<span style="color: var(--success);">Request submitted</span>';
    document.getElementById('nurses-reqItemName').value = '';
    document.getElementById('nurses-reqQuantity').value = '';
    document.getElementById('nurses-reqReason').value = '';
    await loadMyTenders();
  } catch (e) {
    msg.innerHTML = '<span style="color: var(--error);">' + e.message + '</span>';
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Submit Request'; }
  }
}

// ============================================================
// WARDS & SEARCH
// ============================================================
async function loadWards() {
  const res = await fetch('/api/wards', { headers: { Authorization: 'Bearer ' + token() } });
  if (!res.ok) return;
  const wards = await res.json();

  const wardSelect = document.getElementById('nurses-wardSelect');
  if (wardSelect) {
    wardSelect.innerHTML = wards.map(w => '<option value="' + w.id + '">' + escapeHtml(w.name) + '</option>').join('');
  }

  const filterWard = document.getElementById('nurses-filterWard');
  if (filterWard) {
    filterWard.innerHTML = '<option value="all">All</option>' + wards.map(w => '<option value="' + w.id + '">' + escapeHtml(w.name) + '</option>').join('');
  }
}

function debouncedPatientSearch() {
  clearTimeout(patientSearchTimer);
  patientSearchTimer = setTimeout(runPatientSearch, 300);
}

function toggleAdvancedPatientFilters() {
  const el = document.getElementById('nurses-advancedFilters');
  el.style.display = el.style.display === 'none' ? 'flex' : 'none';
}

function updatePatientFilters() {
  let count = 0;
  if (document.getElementById('nurses-filterStatus').value !== 'all') count++;
  if (document.getElementById('nurses-filterWard').value !== 'all') count++;
  if (document.getElementById('nurses-filterDiagnosis').value.trim() !== '') count++;
  if (document.getElementById('nurses-filterFrom').value !== '') count++;
  if (document.getElementById('nurses-filterTo').value !== '') count++;

  const btn = document.getElementById('nurses-filterToggleBtn');
  if (btn) {
    btn.textContent = 'Filters (' + count + ')';
    if (count > 0) {
      btn.classList.remove('ghost-btn');
      btn.classList.add('pill-btn');
    } else {
      btn.classList.remove('pill-btn');
      btn.classList.add('ghost-btn');
    }
  }
  runPatientSearch();
}

async function runPatientSearch() {
  const params = new URLSearchParams();
  const search = document.getElementById('nurses-patientSearch').value.trim();
  const status = document.getElementById('nurses-filterStatus').value;
  const ward = document.getElementById('nurses-filterWard').value;
  const diagnosis = document.getElementById('nurses-filterDiagnosis').value.trim();
  const from = document.getElementById('nurses-filterFrom').value;
  const to = document.getElementById('nurses-filterTo').value;

  if (search) params.set('search', search);
  if (status && status !== 'all') params.set('status', status);
  if (ward && ward !== 'all') params.set('ward', ward);
  if (diagnosis) params.set('diagnosis', diagnosis);
  if (from) params.set('from', from);
  if (to) params.set('to', to);

  try {
    const res = await fetch('/api/patients?' + params, { headers: { Authorization: 'Bearer ' + token() } });
    if (!res.ok) return;
    allPatients = await res.json();
    renderPatientSelect();
  } catch (e) {
    console.error(e);
  }
}

function renderPatientSelect() {
  const countEl = document.getElementById('nurses-resultCount');
  if (countEl) countEl.textContent = '(' + allPatients.length + ' found)';

  const sel = document.getElementById('nurses-patientSelect');
  if (sel) {
    sel.innerHTML = allPatients.map(p => '<option value="' + p.id + '">' + escapeHtml(p.name) + '</option>').join('');
  }

  const tbody = document.getElementById('nurses-patientTableBody');
  if (!tbody) return;

  if (allPatients.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No patients match</td></tr>';
    return;
  }

  tbody.innerHTML = allPatients.map(p => {
    const wardName = p.ward ? p.ward.name : '-';
    const isSelected = sel && sel.value === String(p.id);
    const rowStyle = isSelected ? 'background: #4f46e5; color: #ffffff;' : '';
    const textStyle = isSelected ? 'style="color: #ffffff !important;"' : '';
    
    return '<tr style="cursor:pointer; ' + rowStyle + '" onclick="selectPatientRow(' + p.id + ', this)">' +
      '<td ' + textStyle + '><strong ' + textStyle + '>' + escapeHtml(p.name) + '</strong></td>' +
      '<td ' + textStyle + '>' + escapeHtml(wardName) + '</td>' +
      '<td ' + textStyle + '>' + p.status.toUpperCase() + '</td>' +
      '<td ' + textStyle + '>' + escapeHtml(p.diagnosis || '-') + '</td>' +
      '<td><button class="pill-btn" onclick="event.stopPropagation(); selectPatientRow(' + p.id + ', this.closest(\'tr\'))" style="' + (isSelected ? 'background:#fff; color:#4f46e5;' : '') + '">Select</button></td>' +
      '</tr>';
  }).join('');

  if (!sel.value && allPatients.length > 0) {
    selectPatientRow(allPatients[0].id, tbody.firstElementChild);
  }
}

window.selectPatientRow = function(id, rowEl) {
  const sel = document.getElementById('nurses-patientSelect');
  sel.value = id;

  const tbody = document.getElementById('nurses-patientTableBody');
  Array.from(tbody.children).forEach(tr => {
    tr.style.background = '';
    tr.style.color = '';
    tr.querySelectorAll('td, strong').forEach(cell => cell.style.color = '');
    const btn = tr.querySelector('.pill-btn');
    if (btn) {
      btn.style.background = '';
      btn.style.color = '';
    }
  });

  if (rowEl) {
    rowEl.style.background = '#4f46e5';
    rowEl.style.color = '#ffffff';
    rowEl.querySelectorAll('td, strong').forEach(cell => cell.style.color = '#ffffff');
    const btn = rowEl.querySelector('.pill-btn');
    if (btn) {
      btn.style.background = '#ffffff';
      btn.style.color = '#4f46e5';
    }
  }
};

function clearPatientFilters() {
  document.getElementById('nurses-patientSearch').value = '';
  document.getElementById('nurses-filterStatus').value = 'all';
  document.getElementById('nurses-filterWard').value = 'all';
  document.getElementById('nurses-filterDiagnosis').value = '';
  document.getElementById('nurses-filterFrom').value = '';
  document.getElementById('nurses-filterTo').value = '';
  updatePatientFilters();
}

async function registerPatient() {
  const name = document.getElementById('nurses-patientName').value.trim();
  const nationalId = document.getElementById('nurses-patientID').value.trim();
  const phone = document.getElementById('nurses-patientPhone').value.trim();
  const bloodGroup = document.getElementById('nurses-patientBlood').value;
  const diagnosis = document.getElementById('nurses-patientDiagnosis').value.trim();
  const symptoms = document.getElementById('nurses-patientSymptoms').value.trim();
  const wardId = document.getElementById('nurses-wardSelect').value;
  const msg = document.getElementById('nurses-patientMessage');

  if (!name || !wardId) {
    msg.innerHTML = '<div class="error">Name and ward required</div>';
    return;
  }

  try {
    const res = await fetch('/api/patients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token() },
      body: JSON.stringify({ name, nationalId, phone, bloodGroup, diagnosis, symptoms, wardId: parseInt(wardId), status: 'admitted' }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    msg.innerHTML = '<div class="success">Patient registered</div>';
    ['nurses-patientName', 'nurses-patientID', 'nurses-patientPhone', 'nurses-patientDiagnosis', 'nurses-patientSymptoms'].forEach(id => {
      document.getElementById(id).value = '';
    });
    await runPatientSearch();
  } catch (e) {
    msg.innerHTML = '<div class="error">' + e.message + '</div>';
  }
}

async function changePatientStatus() {
  const patientId = document.getElementById('nurses-patientSelect').value;
  const status = document.getElementById('nurses-newStatus').value;
  const msg = document.getElementById('nurses-updateMessage');

  if (!patientId) {
    msg.innerHTML = '<div class="error">Select a patient</div>';
    return;
  }

  const body = { status };
  if (status === 'deceased') {
    const cause = prompt('Cause of death:');
    if (cause) body.causeOfDeath = cause;
  }

  try {
    const res = await fetch('/api/patients/' + patientId + '/status', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token() },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    msg.innerHTML = '<div class="success">Status updated</div>';
    await runPatientSearch();
  } catch (e) {
    msg.innerHTML = '<div class="error">' + e.message + '</div>';
  }
}

// ============================================================
// DISCHARGE
// ============================================================
function openDischargeModal() {
  const patientId = document.getElementById('nurses-patientSelect').value;
  if (!patientId) {
    alert('Select a patient first');
    return;
  }
  const p = allPatients.find(x => x.id === parseInt(patientId));
  if (!p) return;

  selectedPatientIdForDischarge = p.id;
  document.getElementById('dischargePatientName').textContent = p.name;

  const wardName = p.ward ? p.ward.name : '-';
  document.getElementById('dischargePatientMeta').textContent = '#' + p.id + ' - Ward: ' + wardName + ' - Admitted: ' + fmtDate(p.admissionDate) + (p.diagnosis ? ' - ' + p.diagnosis : '');

  ['dischargeFinalDiagnosis', 'dischargeTreatment', 'dischargeNotes', 'dischargeInstructions', 'dischargeReviewDate'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('dischargeOutcome').value = 'Recovered';
  document.getElementById('dischargeMessage').innerHTML = '';

  document.getElementById('dischargeModal').classList.add('active');
  document.getElementById('modalBackdrop').classList.add('active');
}

function closeDischargeModal() {
  document.getElementById('dischargeModal').classList.remove('active');
  document.getElementById('modalBackdrop').classList.remove('active');
  selectedPatientIdForDischarge = null;
}

async function confirmDischarge() {
  if (!selectedPatientIdForDischarge) return;
  const msg = document.getElementById('dischargeMessage');

  const payload = {
    finalDiagnosis: document.getElementById('dischargeFinalDiagnosis').value.trim(),
    treatmentSummary: document.getElementById('dischargeTreatment').value.trim(),
    outcome: document.getElementById('dischargeOutcome').value,
    dischargeNotes: document.getElementById('dischargeNotes').value.trim(),
    nextReviewDate: document.getElementById('dischargeReviewDate').value || null,
    reviewDepartment: document.getElementById('dischargeReviewDept').value,
    patientInstructions: document.getElementById('dischargeInstructions').value.trim(),
  };

  if (!payload.finalDiagnosis) {
    msg.innerHTML = '<div class="error">Final diagnosis is required</div>';
    return;
  }

  try {
    const res = await fetch('/api/patients/' + selectedPatientIdForDischarge + '/discharge', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token() },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    patientToPrint = data;
    closeDischargeModal();
    await runPatientSearch();
    await loadDischargeRecords();

    document.getElementById('printPatientLabel').textContent = data.name + ' (#' + data.id + ') - Discharged ' + fmtDate(data.dischargeDate);
    document.getElementById('printOptionsModal').classList.add('active');
    document.getElementById('modalBackdrop').classList.add('active');
  } catch (e) {
    msg.innerHTML = '<div class="error">' + e.message + '</div>';
  }
}

// ============================================================
// DISCHARGE RECORDS
// ============================================================
function debouncedDischargeSearch() {
  clearTimeout(dischargeSearchTimer);
  dischargeSearchTimer = setTimeout(loadDischargeRecords, 300);
}

async function loadDischargeRecords() {
  const params = new URLSearchParams();
  const search = document.getElementById('nurses-dischargeSearch').value.trim();
  const outcome = document.getElementById('nurses-dischargeOutcome').value;
  const from = document.getElementById('nurses-dischargeFrom').value;
  const to = document.getElementById('nurses-dischargeTo').value;
  const reviewFrom = document.getElementById('nurses-reviewFrom')?.value;
  const reviewTo = document.getElementById('nurses-reviewTo')?.value;

  if (search) params.set('search', search);
  if (outcome && outcome !== 'all') params.set('outcome', outcome);
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  if (reviewFrom) params.set('reviewFrom', reviewFrom);
  if (reviewTo) params.set('reviewTo', reviewTo);

  try {
    const res = await fetch('/api/patients/discharges?' + params, { headers: { Authorization: 'Bearer ' + token() } });
    if (!res.ok) return;
    allDischarges = await res.json();
    renderDischargeRecords();
  } catch (e) {
    console.error(e);
  }
}

function renderDischargeRecords() {
  const el = document.getElementById('nurses-dischargeList');
  if (allDischarges.length === 0) {
    el.innerHTML = '<div class="empty-state">No discharge records</div>';
    return;
  }
  el.innerHTML = '<table class="data-table"><thead><tr><th>#</th><th>Name</th><th>Ward</th><th>Final Diagnosis</th><th>Outcome</th><th>Discharged</th><th>Review</th><th>Action</th></tr></thead><tbody>' +
    allDischarges.map(d => {
      const wardName = d.ward ? d.ward.name : '-';
      return '<tr>' +
        '<td>' + d.id + '</td>' +
        '<td>' + escapeHtml(d.name) + '</td>' +
        '<td>' + escapeHtml(wardName) + '</td>' +
        '<td>' + escapeHtml(d.finalDiagnosis || '-') + '</td>' +
        '<td>' + escapeHtml(d.outcome || '-') + '</td>' +
        '<td>' + fmtDate(d.dischargeDate) + '</td>' +
        '<td>' + fmtDate(d.nextReviewDate) + '</td>' +
        '<td><button class="pill-btn" onclick="reprintDischarge(' + d.id + ')">Re-print</button></td>' +
        '</tr>';
    }).join('') + '</tbody></table>';
}

async function reprintDischarge(id) {
  const rec = allDischarges.find(d => d.id === id);
  if (!rec) return;
  patientToPrint = rec;
  document.getElementById('printPatientLabel').textContent = rec.name + ' (#' + rec.id + ') - Discharged ' + fmtDate(rec.dischargeDate);
  document.getElementById('printOptionsModal').classList.add('active');
  document.getElementById('modalBackdrop').classList.add('active');
}

// ============================================================
// PRINT FUNCTIONS
// ============================================================
function printPatientList() {
  if (allPatients.length === 0) { alert('No patients to print.'); return; }
  const hospitalName = (systemSettings.hospitalName || 'Sally Mugabe Central Hospital').toUpperCase();
  const now = new Date();
  let html = '<div class="print-page a4"><div class="print-header"><h1>' + escapeHtml(hospitalName) + '</h1><h2>Patient Roster</h2></div>';
  html += '<div class="print-meta"><p><strong>Total Patients:</strong> ' + allPatients.length + '</p><p><strong>Report Generated:</strong> ' + fmtDateTime(now) + '</p></div>';
  html += '<table class="print-table"><thead><tr><th>#</th><th>Name</th><th>Ward</th><th>Diagnosis</th><th>Status</th><th>Admitted</th></tr></thead><tbody>';
  allPatients.forEach((p, i) => {
    html += '<tr><td>' + (i + 1) + '</td><td>' + escapeHtml(p.name) + '</td><td>' + escapeHtml(p.ward ? p.ward.name : '-') + '</td><td>' + escapeHtml(p.diagnosis || '-') + '</td><td>' + p.status.toUpperCase() + '</td><td>' + fmtDate(p.admissionDate) + '</td></tr>';
  });
  html += '</tbody></table><div class="print-footer">' + escapeHtml(hospitalName) + ' - Generated ' + fmtDateTime(now) + '</div></div>';
  printContent(html);
}

function printDischarges() {
  if (allDischarges.length === 0) { alert('No discharges to print.'); return; }
  const hospitalName = (systemSettings.hospitalName || 'Sally Mugabe Central Hospital').toUpperCase();
  const now = new Date();
  let html = '<div class="print-page a4"><div class="print-header"><h1>' + escapeHtml(hospitalName) + '</h1><h2>Discharge Records</h2></div>';
  html += '<div class="print-meta"><p><strong>Total Records:</strong> ' + allDischarges.length + '</p><p><strong>Report Generated:</strong> ' + fmtDateTime(now) + '</p></div>';
  html += '<table class="print-table"><thead><tr><th>#</th><th>Name</th><th>Ward</th><th>Final Diagnosis</th><th>Outcome</th><th>Discharged</th></tr></thead><tbody>';
  allDischarges.forEach((d, i) => {
    html += '<tr><td>' + (i + 1) + '</td><td>' + escapeHtml(d.name) + '</td><td>' + escapeHtml(d.ward ? d.ward.name : '-') + '</td><td>' + escapeHtml(d.finalDiagnosis || '-') + '</td><td>' + escapeHtml(d.outcome || '-') + '</td><td>' + fmtDate(d.dischargeDate) + '</td></tr>';
  });
  html += '</tbody></table><div class="print-footer">' + escapeHtml(hospitalName) + ' - Generated ' + fmtDateTime(now) + '</div></div>';
  printContent(html);
}

// ============================================================
// TENDERS
// ============================================================
async function loadMyTenders() {
  const res = await fetch('/api/orders/my', { headers: { Authorization: 'Bearer ' + token() } });
  if (!res.ok) return;
  allTenders = await res.json();
  renderTenderTracker();
}

function setTenderFilter(btn) {
  const parent = btn.closest('.filter-bar');
  if (parent) {
    parent.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  }
  btn.classList.add('active');
  tenderFilter = btn.dataset.filter;
  renderTenderTracker();
}

function filterTenders() { renderTenderTracker(); }

function renderTenderTracker() {
  const el = document.getElementById('nurses-tenderTrackerList');
  const q = (document.getElementById('nurses-tenderSearch')?.value || '').toLowerCase();
  let list = allTenders;
  if (tenderFilter !== 'all') list = list.filter(t => t.status === tenderFilter);
  if (q) list = list.filter(t => String(t.itemName).toLowerCase().includes(q));

  if (list.length === 0) {
    el.innerHTML = '<div class="empty-state">No Tenders</div>';
    return;
  }

  el.innerHTML = list.map(t => {
    const supplier = t.procurementOrder && t.procurementOrder.supplierName ? '<p><em>Supplier:</em> ' + escapeHtml(t.procurementOrder.supplierName) + '</p>' : '';
    return '<div class="tender-card"><div class="tender-head"><div><strong>#' + t.id + ' - ' + escapeHtml(t.itemName) + ' x' + t.quantity + '</strong></div><div>' + statusBadge(t.status) + '</div></div><div class="tender-body"><p><em>Reason:</em> ' + escapeHtml(t.reason) + '</p>' + supplier + '</div></div>';
  }).join('');
}

function printMyTenders() {
  if (allTenders.length === 0) { alert('No tenders to print.'); return; }
  const hospitalName = (systemSettings.hospitalName || 'Sally Mugabe Central Hospital').toUpperCase();
  const now = new Date();
  let html = '<div class="print-page a4"><div class="print-header"><h1>' + escapeHtml(hospitalName) + '</h1><h2>Department Tenders</h2></div>';
  html += '<div class="print-meta"><p><strong>Total:</strong> ' + allTenders.length + '</p><p><strong>Generated:</strong> ' + fmtDateTime(now) + '</p></div>';
  html += '<table class="print-table"><thead><tr><th>#</th><th>Item</th><th>Qty</th><th>Status</th><th>Supplier</th><th>Date</th></tr></thead><tbody>';
  allTenders.forEach((t, i) => {
    const supplier = t.procurementOrder ? t.procurementOrder.supplierName : '-';
    html += '<tr><td>' + (i + 1) + '</td><td>' + escapeHtml(t.itemName) + '</td><td>' + t.quantity + '</td><td>' + String(t.status).toUpperCase() + '</td><td>' + escapeHtml(supplier) + '</td><td>' + fmtDate(t.createdAt) + '</td></tr>';
  });
  html += '</tbody></table><div class="print-footer">' + escapeHtml(hospitalName) + ' - Generated ' + fmtDateTime(now) + '</div></div>';
  printContent(html);
}

// ============================================================
// FOLLOW-UP ALERTS
// ============================================================
async function checkFollowups() {
  try {
    const now = new Date();
    const today = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
    const res = await fetch('/api/patients/today-summary?from=' + today + '&to=' + today);
    if (!res.ok) return;
    const data = await res.json();
    const count = data.followUpsDueToday || 0;
    
    const alertBox = document.getElementById('nurses-followupAlert');
    const countSpan = document.getElementById('nurses-followupCount');
    
    if (alertBox && countSpan) {
      if (count > 0) {
        countSpan.textContent = count;
        alertBox.style.setProperty('display', 'flex', 'important');
      } else {
        alertBox.style.setProperty('display', 'none', 'important');
      }
    }
  } catch (e) { console.error('Failed to check follow-ups', e); }
}

function filterTodayFollowups() {
  document.getElementById('nurses-patientSearch').value = '';
  document.getElementById('nurses-filterWard').value = 'all';
  document.getElementById('nurses-filterDiagnosis').value = '';
  
  const now = new Date();
  const today = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
  
  const params = new URLSearchParams();
  params.set('category', 'followups');
  params.set('from', today);
  params.set('to', today);

  fetch('/api/patients/detail-public?' + params)
    .then(r => r.json())
    .then(rows => {
      allPatients = rows.map(r => ({
        id: r.id,
        name: 'Case #' + r.id,
        status: r.status,
        ward: r.ward,
        diagnosis: 'Follow-up due',
        admissionDate: r.updatedAt
      }));
      renderPatientSelect();
      
      setTimeout(() => {
        const card = document.getElementById('nurses-patientSearch').closest('.card');
        if (card) {
          card.scrollIntoView({ behavior: 'smooth', block: 'start' });
          card.style.transition = 'box-shadow 0.5s ease, border-color 0.5s ease';
          card.style.boxShadow = '0 0 20px rgba(220, 38, 38, 0.4)';
          card.style.borderColor = '#dc2626';
          setTimeout(() => {
            card.style.boxShadow = '';
            card.style.borderColor = '';
          }, 2000);
        }
      }, 100);
    })
    .catch(e => console.error('Failed to fetch followups:', e));
}

// ============================================================
// DISCHARGE PRINT OPTIONS
// ============================================================
function closePrintOptions() {
  const modal = document.getElementById('printOptionsModal');
  const backdrop = document.getElementById('modalBackdrop');
  if (modal) modal.classList.remove('active');
  if (backdrop) backdrop.classList.remove('active');
  patientToPrint = null;
}

function doPrintDischarge() {
  if (!patientToPrint) return;
  
  const paperSizeEl = document.querySelector('input[name="paperSize"]:checked');
  const copiesEl = document.querySelector('input[name="copies"]:checked');
  
  const paperSize = paperSizeEl ? paperSizeEl.value : 'A4';
  const copies = copiesEl ? copiesEl.value : '1';
  
  const html = buildDischargePrintHTML(patientToPrint, paperSize, copies);
  
  const printArea = document.getElementById('printArea');
  if (printArea) printArea.innerHTML = html;
  
  closePrintOptions();
  setTimeout(() => window.print(), 200);
}

function buildDischargePrintHTML(p, paperSize, copies) {
  const pageClass = paperSize === 'A5' ? 'a5' : 'a4';
  const hospitalName = (systemSettings.hospitalName || 'Sally Mugabe Central Hospital').toUpperCase();
  const phone = systemSettings.contactPhone || '';
  const address = systemSettings.contactAddress || '';

  function singleCopy(label) {
    const wardName = p.ward ? p.ward.name : '-';
    let html = '<div class="print-page ' + pageClass + '">';
    if (label) html += '<div class="copy-label">' + label + '</div>';
    html += '<div class="print-header"><h1>' + escapeHtml(hospitalName) + '</h1><h2>Discharge Summary</h2></div>';
    if (phone || address) {
      html += '<div class="print-contact">';
      if (address) html += '<p>' + escapeHtml(address) + '</p>';
      if (phone) html += '<p>Tel: ' + escapeHtml(phone) + '</p>';
      html += '</div>';
    }
    html += '<div class="print-meta">' +
      '<p><strong>Patient:</strong> ' + escapeHtml(p.name) + ' (#' + p.id + ')</p>' +
      '<p><strong>Ward:</strong> ' + escapeHtml(wardName) + '</p>' +
      '<p><strong>Admitted:</strong> ' + fmtDate(p.admissionDate) + '</p>' +
      '<p><strong>Discharged:</strong> ' + fmtDate(p.dischargeDate) + '</p>' +
      '<p><strong>Outcome:</strong> ' + escapeHtml(p.outcome || '-') + '</p>' +
      '<p><strong>Discharged By:</strong> ' + escapeHtml(p.dischargedBy || '-') + '</p>' +
      '</div>';
    html += '<div class="print-section"><h3>Clinical Summary</h3>' +
      '<p><strong>Admission Diagnosis:</strong> ' + escapeHtml(p.diagnosis || '-') + '</p>' +
      '<p><strong>Final Diagnosis:</strong> ' + escapeHtml(p.finalDiagnosis || '-') + '</p>' +
      '<p><strong>Treatment:</strong> ' + escapeHtml(p.treatmentSummary || '-') + '</p>' +
      '</div>';
    if (p.dischargeNotes) html += '<div class="print-section"><h3>Notes</h3><p>' + escapeHtml(p.dischargeNotes) + '</p></div>';
    if (p.patientInstructions) html += '<div class="print-section"><h3>Instructions to Patient</h3><p>' + escapeHtml(p.patientInstructions) + '</p></div>';
    html += '<div class="print-section"><h3>Follow-up</h3>' +
      '<p><strong>Review Date:</strong> ' + (p.nextReviewDate ? fmtDate(p.nextReviewDate) : '-') + '</p>' +
      '<p><strong>Review Department:</strong> ' + escapeHtml(p.reviewDepartment || '-') + '</p>' +
      '</div>';
    html += '<div class="print-signatures"><div><span>Nurse Signature</span><div class="sig-line"></div></div><div><span>Patient / Guardian Signature</span><div class="sig-line"></div></div></div>';
    html += '<div class="print-footer">' + escapeHtml(hospitalName) + ' - Generated ' + fmtDateTime(new Date()) + '</div></div>';
    return html;
  }

  if (copies === '2') {
    return singleCopy('PATIENT COPY') + '<div class="page-break"></div>' + singleCopy('HOSPITAL COPY');
  }
  return singleCopy('');
}

function registerNursesSocketHandlers() {
  window.onPatientUpdated = () => { runPatientSearch(); checkFollowups(); };
  window.onPatientCreated = () => { runPatientSearch(); checkFollowups(); };
  window.onOrderUpdated = (payload) => {
    const myDept = String(currentDeptName || '').toLowerCase();
    const sub = String(payload?.department || '').toLowerCase();
    const orig = String(payload?.originator || '').toLowerCase();
    if (sub === myDept || orig === myDept) loadMyTenders();
  };
}
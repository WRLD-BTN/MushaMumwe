// ============================================================
// MushaMumwe - Nurses Department
// ============================================================

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
}

// ============================================================
// WARDS
// ============================================================
async function loadWards() {
  const res = await fetch('/api/wards', { headers: { Authorization: 'Bearer ' + token() } });
  if (!res.ok) return;
  const wards = await res.json();

  const wardSelect = document.getElementById('nurses-wardSelect');
  if (wardSelect) {
    wardSelect.innerHTML = wards.map(w =>
      '<option value="' + w.id + '">' + escapeHtml(w.name) + '</option>'
    ).join('');
  }

  const filterWard = document.getElementById('nurses-filterWard');
  if (filterWard) {
    filterWard.innerHTML = '<option value="all">All</option>' + wards.map(w =>
      '<option value="' + w.id + '">' + escapeHtml(w.name) + '</option>'
    ).join('');
  }
}

// ============================================================
// PATIENT SEARCH
// ============================================================
function debouncedPatientSearch() {
  clearTimeout(patientSearchTimer);
  patientSearchTimer = setTimeout(runPatientSearch, 300);
}

function toggleAdvancedPatientFilters() {
  const el = document.getElementById('nurses-advancedFilters');
  el.style.display = el.style.display === 'none' ? 'block' : 'none';
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
  const sel = document.getElementById('nurses-patientSelect');
  const countEl = document.getElementById('nurses-resultCount');
  if (countEl) countEl.textContent = '(' + allPatients.length + ' found)';

  if (!sel) return;
  if (allPatients.length === 0) {
    sel.innerHTML = '<option value="">No patients match</option>';
    return;
  }
  sel.innerHTML = allPatients.map(p => {
    const wardName = p.ward ? p.ward.name : '-';
    const diag = p.diagnosis ? ' - ' + escapeHtml(p.diagnosis) : '';
    return '<option value="' + p.id + '">' +
      escapeHtml(p.name) + ' - ' + p.status + ' - ' + escapeHtml(wardName) + diag +
      '</option>';
  }).join('');
}

function clearPatientFilters() {
  document.getElementById('nurses-patientSearch').value = '';
  document.getElementById('nurses-filterStatus').value = 'all';
  document.getElementById('nurses-filterWard').value = 'all';
  document.getElementById('nurses-filterDiagnosis').value = '';
  document.getElementById('nurses-filterFrom').value = '';
  document.getElementById('nurses-filterTo').value = '';
  runPatientSearch();
}

async function exportPatients() {
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
    const res = await fetch('/api/patients/export?' + params, { headers: { Authorization: 'Bearer ' + token() } });
    if (!res.ok) throw new Error('Export failed');
    const blob = await res.blob();
    downloadCSV(blob, 'patients-' + new Date().toISOString().split('T')[0] + '.csv');
  } catch (e) {
    alert(e.message);
  }
}

// ============================================================
// REGISTER PATIENT
// ============================================================
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
      body: JSON.stringify({
        name, nationalId, phone, bloodGroup, diagnosis, symptoms,
        wardId: parseInt(wardId), status: 'admitted',
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    msg.innerHTML = '<div class="success">Patient registered</div>';
    ['nurses-patientName', 'nurses-patientID', 'nurses-patientPhone',
     'nurses-patientDiagnosis', 'nurses-patientSymptoms'].forEach(id => {
      document.getElementById(id).value = '';
    });
    await runPatientSearch();
  } catch (e) {
    msg.innerHTML = '<div class="error">' + e.message + '</div>';
  }
}

// ============================================================
// UPDATE STATUS
// ============================================================
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
  document.getElementById('dischargePatientMeta').textContent =
    '#' + p.id + ' - Ward: ' + wardName + ' - Admitted: ' + fmtDate(p.admissionDate) +
    (p.diagnosis ? ' - ' + p.diagnosis : '');

  ['dischargeFinalDiagnosis', 'dischargeTreatment', 'dischargeNotes',
   'dischargeInstructions', 'dischargeReviewDate'].forEach(id => {
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

    document.getElementById('printPatientLabel').textContent =
      data.name + ' (#' + data.id + ') - Discharged ' + fmtDate(data.dischargeDate);
    document.getElementById('printOptionsModal').classList.add('active');
    document.getElementById('modalBackdrop').classList.add('active');
  } catch (e) {
    msg.innerHTML = '<div class="error">' + e.message + '</div>';
  }
}

function closePrintOptions() {
  document.getElementById('printOptionsModal').classList.remove('active');
  document.getElementById('modalBackdrop').classList.remove('active');
  patientToPrint = null;
}

function doPrintDischarge() {
  if (!patientToPrint) return;
  const paperSize = document.querySelector('input[name="paperSize"]:checked').value;
  const copies = document.querySelector('input[name="copies"]:checked').value;

  const html = buildDischargePrintHTML(patientToPrint, paperSize, copies);
  document.getElementById('printArea').innerHTML = html;

  closePrintOptions();
  setTimeout(() => window.print(), 200);
}

function buildDischargePrintHTML(p, paperSize, copies) {
  const pageClass = paperSize === 'A5' ? 'a5' : 'a4';

  function singleCopy(label) {
    const wardName = p.ward ? p.ward.name : '-';
    let html = '<div class="print-page ' + pageClass + '">';
    if (label) html += '<div class="copy-label">' + label + '</div>';
    html += '<div class="print-header">' +
      '<h1>MUSHAMUMWE HOSPITAL</h1>' +
      '<h2>Discharge Summary</h2>' +
      '</div>';
    html += '<div class="print-meta">' +
      '<p><strong>Patient:</strong> ' + escapeHtml(p.name) + ' (#' + p.id + ')</p>' +
      '<p><strong>Ward:</strong> ' + escapeHtml(wardName) + '</p>' +
      '<p><strong>Admitted:</strong> ' + fmtDate(p.admissionDate) + '</p>' +
      '<p><strong>Discharged:</strong> ' + fmtDate(p.dischargeDate) + '</p>' +
      '<p><strong>Outcome:</strong> ' + escapeHtml(p.outcome || '-') + '</p>' +
      '<p><strong>Discharged By:</strong> ' + escapeHtml(p.dischargedBy || '-') + '</p>' +
      '</div>';
    html += '<div class="print-section">' +
      '<h3>Clinical Summary</h3>' +
      '<p><strong>Admission Diagnosis:</strong> ' + escapeHtml(p.diagnosis || '-') + '</p>' +
      '<p><strong>Final Diagnosis:</strong> ' + escapeHtml(p.finalDiagnosis || '-') + '</p>' +
      '<p><strong>Treatment:</strong> ' + escapeHtml(p.treatmentSummary || '-') + '</p>' +
      '</div>';
    if (p.dischargeNotes) {
      html += '<div class="print-section"><h3>Notes</h3><p>' + escapeHtml(p.dischargeNotes) + '</p></div>';
    }
    if (p.patientInstructions) {
      html += '<div class="print-section"><h3>Instructions to Patient</h3><p>' +
        escapeHtml(p.patientInstructions) + '</p></div>';
    }
    html += '<div class="print-section">' +
      '<h3>Follow-up</h3>' +
      '<p><strong>Review Date:</strong> ' + (p.nextReviewDate ? fmtDate(p.nextReviewDate) : '-') + '</p>' +
      '<p><strong>Review Department:</strong> ' + escapeHtml(p.reviewDepartment || '-') + '</p>' +
      '</div>';
    html += '<div class="print-signatures">' +
      '<div><span>Nurse Signature</span><div class="sig-line"></div></div>' +
      '<div><span>Patient / Guardian Signature</span><div class="sig-line"></div></div>' +
      '</div>';
    html += '<div class="print-footer">' +
      'MushaMumwe - Generated ' + fmtDateTime(new Date()) +
      '</div>';
    html += '</div>';
    return html;
  }

  if (copies === '2') {
    return singleCopy('PATIENT COPY') +
      '<div class="page-break"></div>' +
      singleCopy('HOSPITAL COPY');
  }
  return singleCopy('');
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

  if (search) params.set('search', search);
  if (outcome && outcome !== 'all') params.set('outcome', outcome);
  if (from) params.set('from', from);
  if (to) params.set('to', to);

  try {
    const res = await fetch('/api/patients/discharges?' + params, {
      headers: { Authorization: 'Bearer ' + token() },
    });
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

  el.innerHTML = '<table class="data-table">' +
    '<thead><tr>' +
    '<th>#</th><th>Name</th><th>Ward</th><th>Final Diagnosis</th>' +
    '<th>Outcome</th><th>Discharged</th><th>Review</th><th>Action</th>' +
    '</tr></thead><tbody>' +
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
    }).join('') +
    '</tbody></table>';
}

async function reprintDischarge(id) {
  const rec = allDischarges.find(d => d.id === id);
  if (!rec) return;
  patientToPrint = rec;
  document.getElementById('printPatientLabel').textContent =
    rec.name + ' (#' + rec.id + ') - Discharged ' + fmtDate(rec.dischargeDate);
  document.getElementById('printOptionsModal').classList.add('active');
  document.getElementById('modalBackdrop').classList.add('active');
}

async function exportDischarges() {
  const params = new URLSearchParams();
  const search = document.getElementById('nurses-dischargeSearch').value.trim();
  const outcome = document.getElementById('nurses-dischargeOutcome').value;
  const from = document.getElementById('nurses-dischargeFrom').value;
  const to = document.getElementById('nurses-dischargeTo').value;

  if (search) params.set('search', search);
  if (outcome && outcome !== 'all') params.set('outcome', outcome);
  if (from) params.set('from', from);
  if (to) params.set('to', to);

  try {
    const res = await fetch('/api/patients/discharges/export?' + params, {
      headers: { Authorization: 'Bearer ' + token() },
    });
    if (!res.ok) throw new Error('Export failed');
    const blob = await res.blob();
    downloadCSV(blob, 'discharges-' + new Date().toISOString().split('T')[0] + '.csv');
  } catch (e) {
    alert(e.message);
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
  document.querySelectorAll('#nurses-tenderFilters .filter-btn').forEach(b => b.classList.remove('active'));
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
  if (q) {
    list = list.filter(t =>
      String(t.itemName).toLowerCase().includes(q) ||
      String(t.id).includes(q));
  }

  if (list.length === 0) {
    el.innerHTML = '<div class="empty-state">No Tenders</div>';
    return;
  }

  el.innerHTML = list.map(t => {
    const supplier = t.procurementOrder && t.procurementOrder.supplierName
      ? '<p><em>Supplier:</em> ' + escapeHtml(t.procurementOrder.supplierName) + '</p>'
      : '';
    return '<div class="tender-card">' +
      '<div class="tender-head">' +
      '<div><strong>#' + t.id + ' - ' + escapeHtml(t.itemName) + ' x' + t.quantity + '</strong></div>' +
      '<div>' + statusBadge(t.status) + '</div>' +
      '</div>' +
      '<div class="tender-body">' +
      '<p><em>Reason:</em> ' + escapeHtml(t.reason) + '</p>' +
      supplier +
      '</div>' +
      '</div>';
  }).join('');
}

async function exportMyTenders() {
  const res = await fetch('/api/orders/my/export', { headers: { Authorization: 'Bearer ' + token() } });
  if (!res.ok) return alert('Export failed');
  const blob = await res.blob();
  downloadCSV(blob, 'tenders-nurses-' + new Date().toISOString().split('T')[0] + '.csv');
}

// ============================================================
// SOCKET HANDLERS
// ============================================================
function registerNursesSocketHandlers() {
  window.onPatientUpdated = () => runPatientSearch();
  window.onPatientCreated = () => runPatientSearch();
  window.onOrderUpdated = (p) => {
    if (String(p?.department || '').toLowerCase() === 'nurses') loadMyTenders();
  };
}
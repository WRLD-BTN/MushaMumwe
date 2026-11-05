let medPatients = [];

async function init_medical() {
  await loadMedicalPatients();
}

async function loadMedicalPatients() {
  try {
    const res = await fetch('/api/patients?status=admitted', { headers: { Authorization: 'Bearer ' + token() } });
    if (!res.ok) return;
    medPatients = await res.json();
    
    document.getElementById('med-activePatients').textContent = medPatients.length;
    renderMedicalPatients();
  } catch (e) { console.error(e); }
}

function renderMedicalPatients() {
  const el = document.getElementById('med-patientList');
  if (!el) return;

  const q = (document.getElementById('med-patientSearch')?.value || '').toLowerCase();
  let filtered = medPatients;
  
  if (q) {
    filtered = medPatients.filter(p => 
      String(p.name || '').toLowerCase().includes(q) || 
      String(p.ward?.name || '').toLowerCase().includes(q)
    );
  }

  if (filtered.length === 0) {
    el.innerHTML = '<div class="empty-state" style="padding: 20px;">No patients match</div>';
    return;
  }

  el.innerHTML = '<table class="data-table"><thead><tr><th>Patient</th><th>Ward</th><th>Diagnosis</th></tr></thead><tbody>' +
    filtered.map(p => {
      return '<tr>' +
        '<td><strong>' + escapeHtml(p.name) + '</strong></td>' +
        '<td>' + escapeHtml(p.ward?.name || '-') + '</td>' +
        '<td>' + escapeHtml(p.diagnosis || '-') + '</td>' +
        '</tr>';
    }).join('') + '</tbody></table>';
}

function printMedicalPatients() {
  if (medPatients.length === 0) { alert('No patients to print.'); return; }
  const hospitalName = (systemSettings.hospitalName || 'Hospital').toUpperCase();
  const now = new Date();
  
  let html = '<div class="print-page a4">';
  html += '<div class="print-header"><h1>' + escapeHtml(hospitalName) + '</h1><h2>Admitted Patients Roster</h2></div>';
  html += '<div class="print-meta"><p><strong>Total:</strong> ' + medPatients.length + '</p><p><strong>Generated:</strong> ' + fmtDateTime(now) + '</p></div>';
  html += '<table class="print-table"><thead><tr><th>#</th><th>Name</th><th>Ward</th><th>Diagnosis</th></tr></thead><tbody>';
  
  medPatients.forEach((p, i) => {
    html += '<tr><td>' + (i + 1) + '</td><td>' + escapeHtml(p.name) + '</td><td>' + escapeHtml(p.ward?.name || '-') + '</td><td>' + escapeHtml(p.diagnosis || '-') + '</td></tr>';
  });
  
  html += '</tbody></table><div class="print-footer">' + escapeHtml(hospitalName) + ' - Generated ' + fmtDateTime(now) + '</div></div>';
  printContent(html);
}
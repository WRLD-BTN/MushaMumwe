// ============================================================
// Sally Mugabe Central Hospital - Schools (Nursing & Midwifery)
// ============================================================

let allStudents = [];
let allSchedule = [];
let studentFilter = 'all';
let schoolName = null;

async function init_schools() {
  const dept = String(currentDeptName || '').toLowerCase();
  if (dept.includes('nursing')) schoolName = 'Nursing';
  else if (dept.includes('midwifery')) schoolName = 'Midwifery';
  else schoolName = 'Nursing';
  
  document.getElementById('schoolTitle').textContent = 'School of ' + schoolName;
  
  await loadStudents();
  await loadSchedule();
  window.onSchoolsUpdated = () => { loadStudents(); loadSchedule(); };
}

function switchSchoolTab(btn, tabId) {
  const tabs = btn.parentElement.querySelectorAll('.dept-tab');
  tabs.forEach(t => t.classList.remove('active'));
  btn.classList.add('active');

  const panels = document.querySelectorAll('.portal[data-dept="Schools"] .proc-tab-panel');
  panels.forEach(p => p.style.display = 'none');

  const target = document.getElementById(tabId);
  if (target) target.style.display = 'block';
}

// ============================================================
// STUDENTS
// ============================================================
async function loadStudents() {
  try {
    const res = await fetch('/api/schools/students', { headers: { Authorization: 'Bearer ' + token() } });
    if (!res.ok) return;
    allStudents = await res.json();
    
    const active = allStudents.filter(s => s.status === 'active').length;
    const graduated = allStudents.filter(s => s.status === 'graduated').length;
    const withdrawn = allStudents.filter(s => s.status === 'withdrawn').length;
    
    document.getElementById('school-totalStudents').textContent = allStudents.length;
    document.getElementById('school-activeStudents').textContent = active;
    document.getElementById('school-graduatedStudents').textContent = graduated;
    document.getElementById('school-withdrawnStudents').textContent = withdrawn;
    
    renderStudents();
  } catch (e) { console.error(e); }
}

function renderStudents() {
  const el = document.getElementById('school-studentList');
  if (!el) return;

  const q = (document.getElementById('school-studentSearch')?.value || '').toLowerCase();
  
  let filtered = allStudents;
  if (studentFilter !== 'all') filtered = filtered.filter(s => s.status === studentFilter);
  if (q) filtered = filtered.filter(s => 
    String(s.name).toLowerCase().includes(q) ||
    String(s.studentNumber).toLowerCase().includes(q) ||
    String(s.currentWard || '').toLowerCase().includes(q)
  );

  if (filtered.length === 0) {
    el.innerHTML = '<div class="empty-state">No students match</div>';
    return;
  }

  el.innerHTML = '<table class="data-table"><thead><tr><th>Student #</th><th>Name</th><th>Class</th><th>Ward</th><th>Status</th><th>Action</th></tr></thead><tbody>' +
    filtered.map(s => {
      const statusCls = {
        active: 'status-ok',
        graduated: 'status-low',
        withdrawn: 'status-terminated'
      }[s.status] || 'status-ok';
      
      let actions = '';
      if (s.status === 'active') {
        actions = '<button class="pill-btn" style="margin-right: 4px;" onclick="updateStudentStatus(' + s.id + ', \'graduated\')">Graduate</button>' +
                  '<button class="ghost-btn" style="padding: 4px 10px; font-size: 11px;" onclick="openWardModal(' + s.id + ')">Ward</button>';
      }
      
      return '<tr>' +
        '<td><strong style="font-family: monospace; font-size: 11px;">' + escapeHtml(s.studentNumber) + '</strong></td>' +
        '<td>' + escapeHtml(s.name) + '</td>' +
        '<td>' + escapeHtml(s.currentClass) + '</td>' +
        '<td>' + escapeHtml(s.currentWard || '-') + '</td>' +
        '<td><span class="status-pill ' + statusCls + '">' + s.status.toUpperCase() + '</span></td>' +
        '<td>' + actions + '</td>' +
        '</tr>';
    }).join('') + '</tbody></table>';
}

function setStudentFilter(btn) {
  const bar = document.getElementById('school-studentFilters');
  if (bar) bar.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  studentFilter = btn.dataset.filter;
  renderStudents();
}

async function submitStudent() {
  const name = document.getElementById('school-studentName').value.trim();
  const intakeYear = document.getElementById('school-intakeYear').value;
  const currentClass = document.getElementById('school-currentClass').value;
  const currentWard = document.getElementById('school-currentWard').value;
  const msg = document.getElementById('school-studentMessage');

  if (!name || !intakeYear) {
    msg.innerHTML = '<span style="color: var(--error);">Name and intake year required</span>';
    return;
  }

  try {
    const res = await fetch('/api/schools/students', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token() },
      body: JSON.stringify({ name, intakeYear, currentClass, currentWard }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    msg.innerHTML = '<span style="color: var(--success);">Student ' + data.studentNumber + ' registered</span>';
    document.getElementById('school-studentName').value = '';
    
    await loadStudents();
    setTimeout(() => { msg.innerHTML = ''; }, 4000);
  } catch (e) {
    msg.innerHTML = '<span style="color: var(--error);">' + e.message + '</span>';
  }
}

async function updateStudentStatus(id, status) {
  if (!confirm('Change student status to "' + status + '"?')) return;
  try {
    await fetch('/api/schools/students/' + id + '/status', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token() },
      body: JSON.stringify({ status })
    });
    await loadStudents();
  } catch (e) {
    alert(e.message);
  }
}

function openWardModal(id) {
  const student = allStudents.find(s => s.id === id);
  if (!student) return;
  
  const ward = prompt('Assign ward for ' + student.name + ' (leave blank for none):', student.currentWard || '');
  if (ward === null) return;
  
  fetch('/api/schools/students/' + id + '/ward', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token() },
    body: JSON.stringify({ ward: ward.trim() || null })
  }).then(() => loadStudents());
}

// ============================================================
// SCHEDULE
// ============================================================
async function loadSchedule() {
  try {
    const res = await fetch('/api/schools/schedule', { headers: { Authorization: 'Bearer ' + token() } });
    if (!res.ok) return;
    allSchedule = await res.json();
    renderSchedule();
  } catch (e) { console.error(e); }
}

function renderSchedule() {
  const el = document.getElementById('school-scheduleList');
  if (!el) return;

  if (allSchedule.length === 0) {
    el.innerHTML = '<div class="empty-state">No classes scheduled yet</div>';
    return;
  }

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  
  el.innerHTML = '<table class="data-table"><thead><tr><th>Day</th><th>Title</th><th>Tutor</th><th>Time</th><th>Location</th><th>Action</th></tr></thead><tbody>' +
    days.flatMap(day => {
      const classes = allSchedule.filter(c => c.dayOfWeek === day);
      if (classes.length === 0) return [];
      return classes.map(c => 
        '<tr>' +
        '<td><strong>' + day + '</strong></td>' +
        '<td>' + escapeHtml(c.title) + '</td>' +
        '<td>' + escapeHtml(c.tutor) + '</td>' +
        '<td>' + c.startTime + ' - ' + c.endTime + '</td>' +
        '<td>' + escapeHtml(c.location || '-') + '</td>' +
        '<td><button class="danger-btn" style="padding: 4px 10px; font-size: 11px;" onclick="deleteClass(' + c.id + ')">✕</button></td>' +
        '</tr>'
      );
    }).join('') + '</tbody></table>';
}

async function submitClass() {
  const title = document.getElementById('school-classTitle').value.trim();
  const tutor = document.getElementById('school-classTutor').value.trim();
  const location = document.getElementById('school-classLocation').value.trim();
  const dayOfWeek = document.getElementById('school-classDay').value;
  const startTime = document.getElementById('school-classStart').value;
  const endTime = document.getElementById('school-classEnd').value;
  const msg = document.getElementById('school-classMessage');

  if (!title || !tutor || !startTime || !endTime) {
    msg.innerHTML = '<span style="color: var(--error);">Title, tutor, and time required</span>';
    return;
  }

  try {
    const res = await fetch('/api/schools/schedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token() },
      body: JSON.stringify({ title, tutor, location, dayOfWeek, startTime, endTime }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    msg.innerHTML = '<span style="color: var(--success);">Class added to schedule</span>';
    document.getElementById('school-classTitle').value = '';
    
    await loadSchedule();
    setTimeout(() => { msg.innerHTML = ''; }, 4000);
  } catch (e) {
    msg.innerHTML = '<span style="color: var(--error);">' + e.message + '</span>';
  }
}

async function deleteClass(id) {
  if (!confirm('Remove this class from the schedule?')) return;
  try {
    await fetch('/api/schools/schedule/' + id, {
      method: 'DELETE',
      headers: { Authorization: 'Bearer ' + token() }
    });
    await loadSchedule();
  } catch (e) {
    alert(e.message);
  }
}

// ============================================================
// PRINT
// ============================================================
function printStudents() {
  if (allStudents.length === 0) { alert('No students to print.'); return; }
  const hospitalName = (systemSettings.hospitalName || 'Hospital').toUpperCase();
  const now = new Date();
  
  let html = '<div class="print-page a4">';
  html += '<div class="print-header"><h1>' + escapeHtml(hospitalName) + '</h1><h2>School of ' + schoolName + ' - Student Roster</h2></div>';
  html += '<div class="print-meta"><p><strong>Total:</strong> ' + allStudents.length + '</p><p><strong>Generated:</strong> ' + fmtDateTime(now) + '</p></div>';
  html += '<table class="print-table"><thead><tr><th>#</th><th>Student #</th><th>Name</th><th>Class</th><th>Ward</th><th>Status</th></tr></thead><tbody>';
  
  allStudents.forEach((s, idx) => {
    html += '<tr><td>' + (idx + 1) + '</td><td>' + escapeHtml(s.studentNumber) + '</td><td>' + escapeHtml(s.name) + '</td><td>' + escapeHtml(s.currentClass) + '</td><td>' + escapeHtml(s.currentWard || '-') + '</td><td>' + s.status.toUpperCase() + '</td></tr>';
  });
  
  html += '</tbody></table><div class="print-footer">' + escapeHtml(hospitalName) + ' - Generated ' + fmtDateTime(now) + '</div></div>';
  printContent(html);
}

function printSchedule() {
  if (allSchedule.length === 0) { alert('No classes to print.'); return; }
  const hospitalName = (systemSettings.hospitalName || 'Hospital').toUpperCase();
  const now = new Date();
  
  let html = '<div class="print-page a4">';
  html += '<div class="print-header"><h1>' + escapeHtml(hospitalName) + '</h1><h2>School of ' + schoolName + ' - Weekly Class Schedule</h2></div>';
  html += '<div class="print-meta"><p><strong>Generated:</strong> ' + fmtDateTime(now) + '</p></div>';
  html += '<table class="print-table"><thead><tr><th>Day</th><th>Title</th><th>Tutor</th><th>Time</th><th>Location</th></tr></thead><tbody>';
  
  allSchedule.forEach(c => {
    html += '<tr><td>' + c.dayOfWeek + '</td><td>' + escapeHtml(c.title) + '</td><td>' + escapeHtml(c.tutor) + '</td><td>' + c.startTime + ' - ' + c.endTime + '</td><td>' + escapeHtml(c.location || '-') + '</td></tr>';
  });
  
  html += '</tbody></table><div class="print-footer">' + escapeHtml(hospitalName) + ' - Generated ' + fmtDateTime(now) + '</div></div>';
  printContent(html);
}
// Project tracker. Auto-injects the projects card into the current portal.
// Loaded by core.js after the portal fragment is injected.

let allProjects = [];
let projectSearchTimer = null;
let currentOpenProjectId = null;

// Insert projects card, load summary, run initial search, wire forms.
async function init_projects() {
  const portalContainer = document.getElementById('portalContainer');
  if (!portalContainer) return;

  // Skip if card already injected.
  if (document.getElementById('projectsCard')) {
    await loadProjectsSummary();
    await runProjectSearch();
    wireProjectForms();
    return;
  }

  // Inject the card HTML.
  try {
    const res = await fetch('portals/projects.html');
    if (!res.ok) return;
    const html = await res.text();

    const targetPortal = portalContainer.querySelector('.portal.active');
    if (!targetPortal) return;

    const wrapper = document.createElement('div');
    wrapper.innerHTML = html.trim();
    const card = wrapper.firstElementChild;
    if (card) {
      card.dataset.dept = currentDeptName || '';
      targetPortal.appendChild(card);
    }
  } catch (e) {
    console.error('Failed to inject projects card:', e);
    return;
  }

  await loadProjectsSummary();
  await runProjectSearch();
  wireProjectForms();

  window.onProjectUpdated = () => {
    loadProjectsSummary();
    runProjectSearch();
  };
}

function debouncedProjectSearch() {
  clearTimeout(projectSearchTimer);
  projectSearchTimer = setTimeout(runProjectSearch, 300);
}

// Fetch projects matching filters.
async function runProjectSearch() {
  const el = document.getElementById('projectsList');
  if (!el) return;

  const params = new URLSearchParams();
  const search = document.getElementById('projectsSearchBox').value.trim();
  const status = document.getElementById('projectsStatusFilter').value;
  const scope = document.getElementById('projectsScopeFilter').value;

  if (search) params.set('search', search);
  if (status && status !== 'all') params.set('status', status);
  params.set('scope', scope);

  try {
    const res = await fetch('/api/projects?' + params, {
      headers: { Authorization: 'Bearer ' + token() },
    });
    if (!res.ok) throw new Error('Failed to load projects');
    allProjects = await res.json();
    renderProjects();
  } catch (e) {
    el.innerHTML = '<p class="error">' + e.message + '</p>';
  }
}

// Summary counts for the header.
async function loadProjectsSummary() {
  try {
    const res = await fetch('/api/projects/summary', {
      headers: { Authorization: 'Bearer ' + token() },
    });
    if (!res.ok) return;
    const s = await res.json();

    const totalEl = document.getElementById('projectsSummaryTotal');
    const ongoingEl = document.getElementById('projectsSummaryOngoing');
    const pendingEl = document.getElementById('projectsSummaryPending');
    const completedEl = document.getElementById('projectsSummaryCompleted');

    if (totalEl) totalEl.textContent = s.total || 0;
    if (ongoingEl) ongoingEl.textContent = (s.byStatus && s.byStatus.ongoing) || 0;
    if (pendingEl) pendingEl.textContent = (s.byStatus && s.byStatus.pending) || 0;
    if (completedEl) completedEl.textContent = (s.byStatus && s.byStatus.completed) || 0;
  } catch (e) {
    console.error(e);
  }
}

// Status pill for project rows.
function projectStatusPill(status) {
  const map = {
    ongoing: 'badge-approved',
    pending: 'badge-rejected',
    completed: 'badge-received',
  };
  const cls = map[status] || 'badge-pending';
  return '<span class="badge ' + cls + '">' + String(status).toUpperCase() + '</span>';
}

// Render project list.
function renderProjects() {
  const el = document.getElementById('projectsList');
  if (!el) return;

  if (!allProjects || allProjects.length === 0) {
    el.innerHTML = '<div class="empty-state">No projects</div>';
    return;
  }

  const myDept = String(currentDeptName || '').toLowerCase();

  el.innerHTML = allProjects.map(p => {
    const latestUpdate = p.updates && p.updates[0];
    const isOwn = String(p.department || '').toLowerCase() === myDept;

    let updateLine = '';
    if (latestUpdate) {
      updateLine = '<p class="muted" style="margin:6px 0 0 0;"><em>Latest:</em> ' +
        escapeHtml(latestUpdate.note) + ' - ' +
        escapeHtml(latestUpdate.updatedBy) + ' - ' +
        fmtDateTime(latestUpdate.timestamp) + '</p>';
    }

    let obstacleLine = '';
    if (p.status === 'pending' && p.obstacleReason) {
      obstacleLine = '<p style="margin:6px 0 0 0; color:var(--error);"><strong>Blocked:</strong> ' +
        escapeHtml(p.obstacleReason) + '</p>';
    }

    return '<div class="tender-card">' +
      '<div class="tender-head">' +
      '<div>' +
      '<strong>' + escapeHtml(p.name) + '</strong>' +
      '<div class="muted">' +
      '<span class="dept-pill">' + escapeHtml(p.department) + '</span>' +
      'Head: ' + escapeHtml(p.projectHead) +
      '</div>' +
      '</div>' +
      '<div>' + projectStatusPill(p.status) + '</div>' +
      '</div>' +
      '<div class="tender-body">' +
      '<p style="margin:0;">' + escapeHtml(p.description) + '</p>' +
      obstacleLine +
      updateLine +
      '</div>' +
      '<div class="order-actions">' +
      (isOwn ? '<button class="pill-btn" onclick="openProjectUpdateModal(' + p.id + ')">Add Update</button>' : '') +
      '<button class="ghost-btn" onclick="openProjectDetail(' + p.id + ')">View History</button>' +
      '</div>' +
      '</div>';
  }).join('');
}

// Open project history detail modal.
async function openProjectDetail(projectId) {
  try {
    const res = await fetch('/api/projects/' + projectId, {
      headers: { Authorization: 'Bearer ' + token() },
    });
    if (!res.ok) throw new Error('Failed to load project');
    const p = await res.json();

    currentOpenProjectId = projectId;

    document.getElementById('projectDetailTitle').textContent = p.name;
    document.getElementById('projectDetailMeta').textContent =
      p.department + ' - Head: ' + p.projectHead + ' - Status: ' + p.status.toUpperCase();

    const updatesHtml = (p.updates || []).map(u => {
      let blockLine = '';
      if (u.statusAtUpdate === 'pending' && u.obstacleReason) {
        blockLine = '<div class="muted" style="color:var(--error);">Blocked: ' + escapeHtml(u.obstacleReason) + '</div>';
      }
      let actionLine = '';
      if (u.actionTaken) {
        actionLine = '<div class="muted">Action: ' + escapeHtml(u.actionTaken) + '</div>';
      }
      return '<div class="tl-item">' +
        '<span class="tl-dot"></span>' +
        '<span><strong>' + u.statusAtUpdate.toUpperCase() + '</strong> - ' +
        escapeHtml(u.updatedBy) + ' - ' + fmtDateTime(u.timestamp) + '</span>' +
        '<div style="margin-left:16px;">' + escapeHtml(u.note) + '</div>' +
        blockLine +
        actionLine +
        '</div>';
    }).join('');

    document.getElementById('projectDetailTimeline').innerHTML =
      updatesHtml || '<p class="muted">No updates yet</p>';

    document.getElementById('projectDetailModal').classList.add('active');
    document.getElementById('modalBackdrop').classList.add('active');
  } catch (e) {
    alert(e.message);
  }
}

function closeProjectDetail() {
  document.getElementById('projectDetailModal').classList.remove('active');
  document.getElementById('modalBackdrop').classList.remove('active');
  currentOpenProjectId = null;
}

// ============================================================
// NEW PROJECT MODAL
// ============================================================
function openProjectNewModal() {
  ['projectNewName', 'projectNewDescription', 'projectNewHead', 'projectNewStart',
   'projectNewTarget', 'projectNewNote', 'projectNewObstacle'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  document.getElementById('projectNewStatus').value = 'ongoing';
  document.getElementById('projectNewMessage').innerHTML = '';
  toggleProjectNewObstacle();

  document.getElementById('projectNewModal').classList.add('active');
  document.getElementById('modalBackdrop').classList.add('active');
}

function closeProjectNewModal() {
  document.getElementById('projectNewModal').classList.remove('active');
  document.getElementById('modalBackdrop').classList.remove('active');
}

// Show/hide obstacle field based on status.
function toggleProjectNewObstacle() {
  const status = document.getElementById('projectNewStatus').value;
  const row = document.getElementById('projectNewObstacleRow');
  const noteLabel = document.getElementById('projectNewNoteLabel');
  if (!row) return;

  if (status === 'pending') {
    row.style.display = 'block';
    noteLabel.textContent = "What's happening";
  } else if (status === 'completed') {
    row.style.display = 'none';
    noteLabel.textContent = 'What was completed';
  } else {
    row.style.display = 'none';
    noteLabel.textContent = "What's happening";
  }
}

async function submitProjectNew() {
  const msg = document.getElementById('projectNewMessage');
  const name = document.getElementById('projectNewName').value.trim();
  const description = document.getElementById('projectNewDescription').value.trim();
  const projectHead = document.getElementById('projectNewHead').value.trim();
  const status = document.getElementById('projectNewStatus').value;
  const startDate = document.getElementById('projectNewStart').value;
  const targetDate = document.getElementById('projectNewTarget').value;
  const note = document.getElementById('projectNewNote').value.trim();
  const obstacleReason = document.getElementById('projectNewObstacle').value.trim();

  if (!name || !description || !projectHead) {
    msg.innerHTML = '<div class="error">Name, description, and project head are required</div>';
    return;
  }
  if (!note) {
    msg.innerHTML = '<div class="error">Please describe what is happening</div>';
    return;
  }
  if (status === 'pending' && !obstacleReason) {
    msg.innerHTML = '<div class="error">Obstacle reason is required when status is pending</div>';
    return;
  }

  try {
    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token() },
      body: JSON.stringify({
        name, description, projectHead, status,
        startDate: startDate || null,
        targetDate: targetDate || null,
        note,
        obstacleReason: status === 'pending' ? obstacleReason : null,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    msg.innerHTML = '<div class="success">Project created</div>';
    setTimeout(() => {
      closeProjectNewModal();
      loadProjectsSummary();
      runProjectSearch();
    }, 700);
  } catch (e) {
    msg.innerHTML = '<div class="error">' + e.message + '</div>';
  }
}

// ============================================================
// UPDATE PROJECT MODAL
// ============================================================
async function openProjectUpdateModal(projectId) {
  try {
    const res = await fetch('/api/projects/' + projectId, {
      headers: { Authorization: 'Bearer ' + token() },
    });
    if (!res.ok) throw new Error('Failed to load project');
    const p = await res.json();

    currentOpenProjectId = projectId;

    document.getElementById('projectUpdateTitle').textContent = p.name;
    document.getElementById('projectUpdateStatus').value = p.status;
    document.getElementById('projectUpdateNote').value = '';
    document.getElementById('projectUpdateObstacle').value = '';
    document.getElementById('projectUpdateAction').value = '';
    document.getElementById('projectUpdateMessage').innerHTML = '';
    toggleProjectUpdateObstacle();

    document.getElementById('projectUpdateModal').classList.add('active');
    document.getElementById('modalBackdrop').classList.add('active');
  } catch (e) {
    alert(e.message);
  }
}

function closeProjectUpdateModal() {
  document.getElementById('projectUpdateModal').classList.remove('active');
  document.getElementById('modalBackdrop').classList.remove('active');
}

function toggleProjectUpdateObstacle() {
  const status = document.getElementById('projectUpdateStatus').value;
  const row = document.getElementById('projectUpdateObstacleRow');
  const noteLabel = document.getElementById('projectUpdateNoteLabel');
  if (!row) return;

  if (status === 'pending') {
    row.style.display = 'block';
    noteLabel.textContent = "What's happening";
  } else if (status === 'completed') {
    row.style.display = 'none';
    noteLabel.textContent = 'What was completed';
  } else {
    row.style.display = 'none';
    noteLabel.textContent = "What's happening";
  }
}

async function submitProjectUpdate() {
  if (!currentOpenProjectId) return;

  const msg = document.getElementById('projectUpdateMessage');
  const status = document.getElementById('projectUpdateStatus').value;
  const note = document.getElementById('projectUpdateNote').value.trim();
  const obstacleReason = document.getElementById('projectUpdateObstacle').value.trim();
  const actionTaken = document.getElementById('projectUpdateAction').value.trim();

  if (!note) {
    msg.innerHTML = '<div class="error">Please describe what is happening</div>';
    return;
  }
  if (status === 'pending' && !obstacleReason) {
    msg.innerHTML = '<div class="error">Obstacle reason is required when status is pending</div>';
    return;
  }

  try {
    const res = await fetch('/api/projects/' + currentOpenProjectId + '/updates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token() },
      body: JSON.stringify({
        note,
        status,
        obstacleReason: status === 'pending' ? obstacleReason : null,
        actionTaken: actionTaken || null,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    msg.innerHTML = '<div class="success">Update added</div>';
    setTimeout(() => {
      closeProjectUpdateModal();
      loadProjectsSummary();
      runProjectSearch();
    }, 700);
  } catch (e) {
    msg.innerHTML = '<div class="error">' + e.message + '</div>';
  }
}

// ============================================================
// PRINT PROJECTS
// ============================================================
function printProjects() {
  if (!allProjects || allProjects.length === 0) {
    alert('No projects to print.');
    return;
  }

  const hospitalName = (systemSettings.hospitalName || 'Sally Mugabe Central Hospital').toUpperCase();
  const phone = systemSettings.contactPhone || '';
  const address = systemSettings.contactAddress || '';
  const now = new Date();

  const filterParts = [];
  const search = document.getElementById('projectsSearchBox').value.trim();
  const status = document.getElementById('projectsStatusFilter').value;
  const scope = document.getElementById('projectsScopeFilter').value;

  if (search) filterParts.push('Search="' + search + '"');
  if (status && status !== 'all') filterParts.push('Status=' + status);
  if (scope === 'own') filterParts.push('Scope=My Department');
  else filterParts.push('Scope=All Departments');

  const filterLine = 'Filters: ' + filterParts.join(', ');

  let html = '<div class="print-page a4">';
  html += '<div class="print-header">';
  html += '<h1>' + escapeHtml(hospitalName) + '</h1>';
  html += '<h2>Projects Report</h2>';
  html += '</div>';

  if (phone || address) {
    html += '<div class="print-contact">';
    if (address) html += '<p>' + escapeHtml(address) + '</p>';
    if (phone) html += '<p>Tel: ' + escapeHtml(phone) + '</p>';
    html += '</div>';
  }

  html += '<div class="print-meta">';
  html += '<p><strong>Total Projects:</strong> ' + allProjects.length + '</p>';
  html += '<p><strong>Report Generated:</strong> ' + fmtDateTime(now) + '</p>';
  html += '<p style="grid-column: span 2;"><strong>' + escapeHtml(filterLine) + '</strong></p>';
  html += '</div>';

  html += '<table class="print-table">';
  html += '<thead><tr>';
  html += '<th>#</th><th>Project</th><th>Department</th><th>Head</th><th>Status</th><th>Latest Update</th>';
  html += '</tr></thead><tbody>';

  allProjects.forEach((p, i) => {
    const latest = p.updates && p.updates[0];
    const latestText = latest ? latest.note : 'No updates';
    html += '<tr>';
    html += '<td>' + (i + 1) + '</td>';
    html += '<td>' + escapeHtml(p.name) + '</td>';
    html += '<td>' + escapeHtml(p.department) + '</td>';
    html += '<td>' + escapeHtml(p.projectHead) + '</td>';
    html += '<td>' + String(p.status).toUpperCase() + '</td>';
    html += '<td>' + escapeHtml(latestText) + '</td>';
    html += '</tr>';
  });

  html += '</tbody></table>';
  html += '<div class="print-footer">';
  html += escapeHtml(hospitalName) + ' - Generated ' + fmtDateTime(now);
  html += '</div>';
  html += '</div>';

  document.getElementById('printArea').innerHTML = html;
  setTimeout(() => window.print(), 200);
}

// ============================================================
// FORM WIRING
// ============================================================
function wireProjectForms() {
  const newStatus = document.getElementById('projectNewStatus');
  if (newStatus && !newStatus.dataset.wired) {
    newStatus.addEventListener('change', toggleProjectNewObstacle);
    newStatus.dataset.wired = '1';
  }

  const updateStatus = document.getElementById('projectUpdateStatus');
  if (updateStatus && !updateStatus.dataset.wired) {
    updateStatus.addEventListener('change', toggleProjectUpdateObstacle);
    updateStatus.dataset.wired = '1';
  }
}
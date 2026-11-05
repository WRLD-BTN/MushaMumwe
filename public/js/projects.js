// Global injection for Tenders and Projects.
// Loaded by core.js after any portal fragment is injected.

let allProjects = [];
let projectSearchTimer = null;
let currentOpenProjectId = null;

// ============================================================
// INITIALIZATION & INJECTION
// ============================================================
async function init_projects() {
  const portalContainer = document.getElementById('portalContainer');
  if (!portalContainer) return;
  const targetPortal = portalContainer.querySelector('.portal.active');
  if (!targetPortal) return;

  // 1. Inject Global Tenders Card (if not already there)
  if (!document.getElementById('globalTenderCard')) {
    const tenderHtml = `
      <div class="card" id="globalTenderCard" style="margin-bottom: 20px;">
        <div class="card-head">
          <h3>Submit Tender Request</h3>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Item Name: <span class="req">*</span></label>
            <input type="text" id="global-reqItemName" placeholder="e.g. Medical Gloves">
          </div>
          <div class="form-group" style="max-width: 120px;">
            <label>Qty: <span class="req">*</span></label>
            <input type="number" id="global-reqQuantity" min="1">
          </div>
          <div class="form-group">
            <label>Originator:</label>
            <select id="global-reqOriginator">
              <option value="${currentDeptName}">${currentDeptName}</option>
              <option value="Medical">Medical</option>
              <option value="Nurses">Nurses</option>
              <option value="Mortuary">Mortuary</option>
              <option value="School of Nursing">School of Nursing</option>
              <option value="School of Midwifery">School of Midwifery</option>
              <option value="Biomedical Equipment">Biomedical Equipment</option>
              <option value="Radiography">Radiography</option>
              <option value="Catering">Catering</option>
              <option value="Security">Security</option>
              <option value="Laundry">Laundry</option>
              <option value="Health Information">Health Information</option>
              <option value="Accounts">Accounts</option>
              <option value="HR">HR</option>
              <option value="Stores">Stores</option>
              <option value="Procurement">Procurement</option>
              <option value="IT">IT</option>
            </select>
          </div>
        </div>
        <div class="form-group">
          <label>Reason: <span class="req">*</span></label>
          <textarea id="global-reqReason" rows="2" placeholder="Why is this needed?"></textarea>
        </div>
        <button class="primary-btn block" onclick="submitGlobalTender()">Submit Request</button>
        <div id="global-requestMessage" style="margin-top: 10px; font-weight: 600; font-size: 13px;"></div>
      </div>

      <div class="card" id="globalMyTendersCard" style="margin-bottom: 20px;">
        <div class="card-head">
          <h3>My Department Tenders <span class="lock-badge" style="font-size: 9px; padding: 2px 6px;">LOCKED</span></h3>
          <div class="card-head-actions">
            <input type="text" class="search-input" id="global-tenderSearch" placeholder="Search..." oninput="renderGlobalTenders()" style="width: 120px;">
            <button class="pill-btn" onclick="printGlobalTenders()">Print</button>
          </div>
        </div>
        <div class="tender-filters" id="global-tenderFilters" style="margin-bottom: 12px;">
          <button class="filter-btn active" data-filter="all" onclick="setGlobalTenderFilter(this)">All</button>
          <button class="filter-btn" data-filter="pending" onclick="setGlobalTenderFilter(this)">Pending</button>
          <button class="filter-btn" data-filter="ordered" onclick="setGlobalTenderFilter(this)">Ordered</button>
          <button class="filter-btn" data-filter="received" onclick="setGlobalTenderFilter(this)">Received</button>
        </div>
        <div class="muted" id="global-tenderResultCount" style="margin-bottom: 8px; font-size: 11px;"></div>
        <div id="global-tenderList" class="table-wrap roster-scroll" style="max-height: 220px; overflow-y: auto;"></div>
      </div>
    `;
    const wrapper = document.createElement('div');
    wrapper.innerHTML = tenderHtml.trim();
    
    // Append tender form and tender list
    targetPortal.appendChild(wrapper.children[0]);
    targetPortal.appendChild(wrapper.children[0]); 
    
    await loadGlobalTenders();
  }

  // 2. Inject Global Projects Card (if not already there)
  if (!document.getElementById('projectsCard')) {
    try {
      const res = await fetch('portals/projects.html');
      if (!res.ok) return;
      const html = await res.text();

      const wrapper = document.createElement('div');
      wrapper.innerHTML = html.trim();
      const card = wrapper.firstElementChild;
      if (card) {
        card.dataset.dept = currentDeptName || '';
        targetPortal.appendChild(card);
      }
    } catch (e) {
      console.error('Failed to inject projects card:', e);
    }
  }

  await loadProjectsSummary();
  await runProjectSearch();
  wireProjectForms();

  window.onProjectUpdated = () => {
    loadProjectsSummary();
    runProjectSearch();
  };
}

// ============================================================
// GLOBAL TENDERS LOGIC
// ============================================================
let globalTenders = [];
let globalTenderFilter = 'all';

async function loadGlobalTenders() {
  try {
    const res = await fetch('/api/orders/my', { headers: { Authorization: 'Bearer ' + token() } });
    if (!res.ok) return;
    globalTenders = await res.json();
    renderGlobalTenders();
  } catch (e) { console.error(e); }
}

function setGlobalTenderFilter(btn) {
  const bar = document.getElementById('global-tenderFilters');
  if (bar) bar.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  globalTenderFilter = btn.dataset.filter;
  renderGlobalTenders();
}

function renderGlobalTenders() {
  const el = document.getElementById('global-tenderList');
  if (!el) return;

  const q = (document.getElementById('global-tenderSearch')?.value || '').toLowerCase();
  let filtered = globalTenders;

  if (globalTenderFilter !== 'all') {
    if (globalTenderFilter === 'received') {
      filtered = filtered.filter(t => t.status === 'received' || t.status === 'in_storage');
    } else {
      filtered = filtered.filter(t => t.status === globalTenderFilter);
    }
  }

  if (q) {
    filtered = filtered.filter(t => String(t.itemName || '').toLowerCase().includes(q));
  }

  const countEl = document.getElementById('global-tenderResultCount');
  if (countEl) countEl.textContent = filtered.length + ' tender(s)';

  if (filtered.length === 0) {
    el.innerHTML = '<div class="empty-state" style="padding: 20px;">No tenders</div>';
    return;
  }

  el.innerHTML = '<table class="data-table"><thead><tr><th>Item</th><th>Qty</th><th>Status</th><th>Date</th></tr></thead><tbody>' +
    filtered.map(t => {
      return '<tr>' +
        '<td><strong>' + escapeHtml(t.itemName) + '</strong></td>' +
        '<td>' + t.quantity + '</td>' +
        '<td>' + statusBadge(t.status) + '</td>' +
        '<td>' + fmtDate(t.createdAt) + '</td>' +
        '</tr>';
    }).join('') + '</tbody></table>';
}

async function submitGlobalTender() {
  const itemName = document.getElementById('global-reqItemName').value.trim();
  const quantity = document.getElementById('global-reqQuantity').value;
  const originatorDepartment = document.getElementById('global-reqOriginator').value;
  const reason = document.getElementById('global-reqReason').value.trim();
  const msg = document.getElementById('global-requestMessage');

  if (!itemName || !quantity || !reason) {
    msg.innerHTML = '<span style="color: var(--error);">All fields required</span>';
    return;
  }

  const btn = document.querySelector('button[onclick="submitGlobalTender()"]');
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
    document.getElementById('global-reqItemName').value = '';
    document.getElementById('global-reqQuantity').value = '';
    document.getElementById('global-reqReason').value = '';
    await loadGlobalTenders();
  } catch (e) {
    msg.innerHTML = '<span style="color: var(--error);">' + e.message + '</span>';
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Submit Request'; }
  }
}

function printGlobalTenders() {
  if (globalTenders.length === 0) { alert('No tenders to print.'); return; }
  const hospitalName = (systemSettings.hospitalName || 'Hospital').toUpperCase();
  const now = new Date();
  
  let html = '<div class="print-page a4">';
  html += '<div class="print-header"><h1>' + escapeHtml(hospitalName) + '</h1><h2>Department Tenders</h2></div>';
  html += '<div class="print-meta"><p><strong>Total:</strong> ' + globalTenders.length + '</p><p><strong>Generated:</strong> ' + fmtDateTime(now) + '</p></div>';
  html += '<table class="print-table"><thead><tr><th>#</th><th>Item</th><th>Qty</th><th>Status</th><th>Date</th></tr></thead><tbody>';
  
  globalTenders.forEach((t, i) => {
    html += '<tr><td>' + (i + 1) + '</td><td>' + escapeHtml(t.itemName) + '</td><td>' + t.quantity + '</td><td>' + String(t.status).toUpperCase() + '</td><td>' + fmtDate(t.createdAt) + '</td></tr>';
  });
  
  html += '</tbody></table><div class="print-footer">' + escapeHtml(hospitalName) + ' - Generated ' + fmtDateTime(now) + '</div></div>';
  printContent(html);
}

// ============================================================
// PROJECTS LOGIC (Matches existing)
// ============================================================
function debouncedProjectSearch() {
  clearTimeout(projectSearchTimer);
  projectSearchTimer = setTimeout(runProjectSearch, 300);
}

async function runProjectSearch() {
  const el = document.getElementById('projectsList');
  if (!el) return;

  const params = new URLSearchParams();
  const search = document.getElementById('projectsSearchBox')?.value.trim() || '';
  const status = document.getElementById('projectsStatusFilter')?.value || 'all';
  const scope = document.getElementById('projectsScopeFilter')?.value || 'own';

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

function projectStatusPill(status) {
  const map = {
    ongoing: 'badge-approved',
    pending: 'badge-rejected',
    completed: 'badge-received',
  };
  const cls = map[status] || 'badge-pending';
  return '<span class="badge ' + cls + '">' + String(status).toUpperCase() + '</span>';
}

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

function printProjects() {
  if (!allProjects || allProjects.length === 0) {
    alert('No projects to print.');
    return;
  }

  const hospitalName = (systemSettings.hospitalName || 'Hospital').toUpperCase();
  const now = new Date();

  let html = '<div class="print-page a4">';
  html += '<div class="print-header"><h1>' + escapeHtml(hospitalName) + '</h1><h2>Projects Report</h2></div>';
  html += '<div class="print-meta"><p><strong>Total Projects:</strong> ' + allProjects.length + '</p><p><strong>Generated:</strong> ' + fmtDateTime(now) + '</p></div>';
  html += '<table class="print-table"><thead><tr><th>#</th><th>Project</th><th>Department</th><th>Head</th><th>Status</th></tr></thead><tbody>';

  allProjects.forEach((p, i) => {
    html += '<tr><td>' + (i + 1) + '</td><td>' + escapeHtml(p.name) + '</td><td>' + escapeHtml(p.department) + '</td><td>' + escapeHtml(p.projectHead) + '</td><td>' + String(p.status).toUpperCase() + '</td></tr>';
  });

  html += '</tbody></table><div class="print-footer">' + escapeHtml(hospitalName) + ' - Generated ' + fmtDateTime(now) + '</div></div>';
  printContent(html);
}

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

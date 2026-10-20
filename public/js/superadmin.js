// ============================================================
// Sally Mugabe Central Hospital - Super Admin Launcher
// ============================================================

async function init_super() {
  await refreshSuperAdminSettings();
  await initAudit();
}

async function refreshSuperAdminSettings() {
  try {
    const res = await fetch('/api/settings/public');
    if (!res.ok) return;
    const data = await res.json();

    document.getElementById('saHospitalName').textContent = data.hospitalName || '-';
    document.getElementById('saSubtitle').textContent = data.hospitalSubtitle || '-';
    document.getElementById('saPhone').textContent = data.contactPhone || '(not set)';
    document.getElementById('saAddress').textContent = data.contactAddress || '(not set)';

    systemSettings.hospitalName = data.hospitalName || systemSettings.hospitalName;
    systemSettings.hospitalSubtitle = data.hospitalSubtitle || systemSettings.hospitalSubtitle;
    applySettingsToShell();
  } catch (e) {
    console.error(e);
  }
}

// ============================================================
// AUDIT LOG
// ============================================================

let auditPage = 1;
let auditPageSize = 100;

async function initAudit() {
  const section = document.getElementById('auditSection');
  if (!section) return;
  await loadAuditFilters();
  await loadAudit(1);
}

async function loadAuditFilters() {
  try {
    const res = await fetch('/api/audit/filters', {
      headers: { Authorization: 'Bearer ' + token() },
    });
    if (!res.ok) return;
    const f = await res.json();

    const fill = (id, items, getVal, getLabel) => {
      const sel = document.getElementById(id);
      if (!sel) return;
      const first = sel.options[0] ? sel.options[0].outerHTML : '';
      sel.innerHTML = first +
        items.map(it => '<option value="' + escapeHtml(getVal(it)) + '">' + escapeHtml(getLabel(it)) + '</option>').join('');
    };

    fill('auditFilterAction', f.actions,     a => a, a => a);
    fill('auditFilterEntity', f.entities,    e => e, e => e);
    fill('auditFilterUser',   f.users,       u => u.username, u => u.fullName + ' (' + u.username + ')');
    fill('auditFilterDept',   f.departments, d => d, d => d);
  } catch (e) {
    console.error(e);
  }
}

async function loadAudit(page = 1) {
  auditPage = page;
  const el = document.getElementById('auditTableWrap');
  const countEl = document.getElementById('auditCount');
  if (!el) return;
  el.innerHTML = '<p class="muted">Loading...</p>';

  const params = new URLSearchParams();
  const search = document.getElementById('auditSearch').value.trim();
  const action = document.getElementById('auditFilterAction').value;
  const entity = document.getElementById('auditFilterEntity').value;
  const username = document.getElementById('auditFilterUser').value;
  const department = document.getElementById('auditFilterDept').value;
  const from = document.getElementById('auditFrom').value;
  const to = document.getElementById('auditTo').value;

  if (search) params.set('search', search);
  if (action) params.set('action', action);
  if (entity) params.set('entity', entity);
  if (username) params.set('username', username);
  if (department) params.set('department', department);
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  params.set('page', page);
  params.set('pageSize', auditPageSize);

  try {
    const res = await fetch('/api/audit?' + params, {
      headers: { Authorization: 'Bearer ' + token() },
    });
    if (!res.ok) throw new Error('Failed to load audit log');
    const data = await res.json();

    countEl.textContent = data.total + ' entries — page ' + data.page + ' of ' + data.pages;

    if (data.rows.length === 0) {
      el.innerHTML = '<p class="empty-state">No audit entries match filters</p>';
      document.getElementById('auditPager').innerHTML = '';
      return;
    }

    el.innerHTML = '<table class="data-table">' +
      '<thead><tr>' +
      '<th>Time</th><th>User</th><th>Dept</th><th>Action</th><th>Entity</th><th>Summary</th><th>Device</th>' +
      '</tr></thead><tbody>' +
      data.rows.map(r => {
        const actionCls = {
          create:       'badge-approved',
          update:       'badge-pending',
          delete:       'badge-rejected',
          login:        'badge-received',
          login_failed: 'badge-rejected',
          upload:       'badge-ordered',
        }[r.action] || 'badge-pending';

        return '<tr title="' + escapeHtml(r.userAgent || '') + '">' +
          '<td style="white-space:nowrap;">' + fmtDateTime(r.timestamp) + '</td>' +
          '<td>' + escapeHtml(r.fullName) + '<br><span class="muted" style="font-size:11px;">' + escapeHtml(r.username) + '</span></td>' +
          '<td><span class="dept-pill">' + escapeHtml(r.department) + '</span></td>' +
          '<td><span class="badge ' + actionCls + '">' + escapeHtml(String(r.action).toUpperCase()) + '</span></td>' +
          '<td>' + escapeHtml(r.entity) + (r.entityId ? ' #' + escapeHtml(r.entityId) : '') + '</td>' +
          '<td>' + escapeHtml(r.summary) + '</td>' +
          '<td><span class="muted" style="font-size:11px;">' + escapeHtml((r.ipAddress || '') + ' / ' + (r.deviceTag || '').slice(0, 30)) + '</span></td>' +
          '</tr>';
      }).join('') +
      '</tbody></table>';

    const pager = document.getElementById('auditPager');
    pager.innerHTML =
      '<button class="ghost-btn" ' + (data.page <= 1 ? 'disabled' : '') + ' onclick="loadAudit(' + (data.page - 1) + ')">‹ Prev</button>' +
      '<span class="muted">Page ' + data.page + ' / ' + data.pages + '</span>' +
      '<button class="ghost-btn" ' + (data.page >= data.pages ? 'disabled' : '') + ' onclick="loadAudit(' + (data.page + 1) + ')">Next ›</button>';
  } catch (e) {
    el.innerHTML = '<p class="error">' + e.message + '</p>';
  }
}

function clearAuditFilters() {
  document.getElementById('auditSearch').value = '';
  document.getElementById('auditFilterAction').value = '';
  document.getElementById('auditFilterEntity').value = '';
  document.getElementById('auditFilterUser').value = '';
  document.getElementById('auditFilterDept').value = '';
  document.getElementById('auditFrom').value = '';
  document.getElementById('auditTo').value = '';
  loadAudit(1);
}

async function exportAuditCSV() {
  const params = new URLSearchParams();
  const search = document.getElementById('auditSearch').value.trim();
  const action = document.getElementById('auditFilterAction').value;
  const entity = document.getElementById('auditFilterEntity').value;
  const username = document.getElementById('auditFilterUser').value;
  const department = document.getElementById('auditFilterDept').value;
  const from = document.getElementById('auditFrom').value;
  const to = document.getElementById('auditTo').value;

  if (search) params.set('search', search);
  if (action) params.set('action', action);
  if (entity) params.set('entity', entity);
  if (username) params.set('username', username);
  if (department) params.set('department', department);
  if (from) params.set('from', from);
  if (to) params.set('to', to);

  try {
    const res = await fetch('/api/audit/export?' + params, {
      headers: { Authorization: 'Bearer ' + token() },
    });
    if (!res.ok) throw new Error('Export failed');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'audit-' + new Date().toISOString().split('T')[0] + '.csv';
    a.click();
    URL.revokeObjectURL(url);
  } catch (e) {
    alert(e.message);
  }
}
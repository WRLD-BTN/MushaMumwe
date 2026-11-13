// ============================================================
// Sally Mugabe Central Hospital - Live Board
// ============================================================

let allDepartments = [];
let currentCategory = null;
let currentPeriod = 'today';

// ============================================================
// THEME
// ============================================================
function initTheme() {
  const saved = localStorage.getItem("mushamumwe_theme") || "light";
  applyTheme(saved);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute("data-theme") || "light";
  const next = current === "light" ? "dark" : "light";
  applyTheme(next);
  localStorage.setItem("mushamumwe_theme", next);
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  const icon = document.getElementById("themeIcon");
  const iconMobile = document.getElementById("themeIconMobile");
  if (icon) icon.textContent = theme === "light" ? "DARK" : "LIGHT";
  if (iconMobile) iconMobile.textContent = theme === "light" ? "DARK MODE" : "LIGHT MODE";
}

// ============================================================
// UTILITIES
// ============================================================
function escapeHtml(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function fmtTime(iso) {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function tickClock() {
  const clock = document.getElementById("clock");
  if (clock) clock.textContent = new Date().toLocaleTimeString("en-GB");
}

// ============================================================
// PERIOD SELECTOR
// ============================================================
function setPeriod(period) {
  currentPeriod = period;

  document.querySelectorAll('.range-btn-period').forEach(btn => {
    const isActive = btn.dataset.period === period;
    btn.style.background = isActive ? 'var(--primary)' : 'var(--board-surface-2)';
    btn.style.color = isActive ? 'white' : 'var(--board-muted)';
    btn.style.borderColor = isActive ? 'var(--primary)' : 'var(--board-line)';
    btn.classList.toggle('active', isActive);
  });

  const labels = { today: 'Today', week: 'This Week', month: 'This Month' };
  const label = document.getElementById('clinicalPeriodLabel');
  if (label) label.textContent = labels[period] || 'Today';

  refreshAll();
}

// ============================================================
// CONNECTION INFO
// ============================================================
function setConnectionInfo() {
  const host = window.location.host;
  const apiTarget = document.getElementById("apiTarget");
  const apiTargetMobile = document.getElementById("apiTargetMobile");
  if (apiTarget) apiTarget.textContent = host;
  if (apiTargetMobile) apiTargetMobile.textContent = host;
}

// ============================================================
// MORNING BRIEF
// ============================================================
async function loadMorningBrief() {
  try {
    const res = await fetch("/api/dashboard/morning-brief");
    if (!res.ok) return;
    const data = await res.json();

    const card = document.getElementById("morningBriefCard");
    const text = document.getElementById("morningBriefText");
    const ts = document.getElementById("briefTimestamp");

    if (text) text.textContent = data.brief || "No operational alerts for today.";
    if (ts) {
      const t = new Date(data.generatedAt);
      const hh = String(t.getHours()).padStart(2, '0');
      const mm = String(t.getMinutes()).padStart(2, '0');
      ts.textContent = `${hh}:${mm}`;
    }
    if (card) card.style.display = "block";
  } catch (e) {
    console.error("Failed to load morning brief:", e);
  }
}

// ============================================================
// LOAD SETTINGS
// ============================================================
async function loadBoardSettings() {
  try {
    const res = await fetch("/api/settings/public");
    if (!res.ok) return;
    const data = await res.json();
    const title = document.getElementById("boardTitle");
    if (title) title.textContent = (data.hospitalName || "Hospital").toUpperCase();
    document.title = (data.hospitalName || "Hospital") + " - Command Center";
  } catch (e) { console.error(e); }
}

// ============================================================
// TOP STATS
// ============================================================
async function loadStats() {
  try {
    const res = await fetch("/api/dashboard/stats?period=" + currentPeriod);
    if (!res.ok) return;
    const data = await res.json();

    document.getElementById("statPatients").textContent = data.patients.current;
    const pTrend = data.patients.trend;
    const pTrendEl = document.getElementById("statPatientsTrend");
    if (pTrend > 0) {
      pTrendEl.innerHTML = '<span style="color: #dc2626;">+ ' + pTrend + ' vs previous</span>';
    } else if (pTrend < 0) {
      pTrendEl.innerHTML = '<span style="color: #16a34a;">' + pTrend + ' vs previous</span>';
    } else {
      pTrendEl.innerHTML = '<span style="color: var(--board-muted);">stable</span>';
    }

    document.getElementById("statEmployees").textContent = data.employees.active;
    document.getElementById("statEmployeesTrend").innerHTML = '<span style="color: var(--board-muted);">currently active</span>';

    document.getElementById("statTenders").textContent = data.tenders.current;
    document.getElementById("statTendersTrend").innerHTML = '<span style="color: var(--board-muted);">awaiting action</span>';

    document.getElementById("statAlerts").textContent = data.alerts;
    document.getElementById("statAlertsBreakdown").textContent =
      'Files ' + data.alertBreakdown.files +
      ' | Projects ' + data.alertBreakdown.projects +
      ' | Tenders ' + data.alertBreakdown.tenders;

    // Distribution — uses distributionTotal from server, not a client sum
    const dist = data.distribution;
    const total = data.distributionTotal || (dist.admitted + dist.treatment + dist.discharged + dist.deceased);
    const pct = (n) => total > 0 ? ((n / total) * 100).toFixed(0) + '%' : '0%';

    document.getElementById("countAdmitted").textContent = dist.admitted;
    document.getElementById("countTreatment").textContent = dist.treatment;
    document.getElementById("countDischarged").textContent = dist.discharged;
    document.getElementById("countDeceased").textContent = dist.deceased;
    document.getElementById("pctAdmitted").textContent = pct(dist.admitted);
    document.getElementById("pctTreatment").textContent = pct(dist.treatment);
    document.getElementById("pctDischarged").textContent = pct(dist.discharged);
    document.getElementById("pctDeceased").textContent = pct(dist.deceased);

    document.getElementById("syncText").textContent = "SYNCED";
  } catch (e) {
    document.getElementById("syncText").textContent = "OFFLINE";
    console.error("Failed to load stats:", e);
  }
}

// ============================================================
// CLINICAL OUTCOMES
// ============================================================
async function loadClinicalOutcomes() {
  try {
    const res = await fetch("/api/dashboard/clinical-outcomes?period=" + currentPeriod);
    if (!res.ok) return;
    const data = await res.json();

    const setTrend = (id, trend, invertGood) => {
      const el = document.getElementById(id);
      if (!el) return;
      if (trend > 0) {
        const color = invertGood ? '#dc2626' : '#16a34a';
        el.innerHTML = '<span style="color: ' + color + ';">+ ' + trend + '</span>';
      } else if (trend < 0) {
        const color = invertGood ? '#16a34a' : '#dc2626';
        el.innerHTML = '<span style="color: ' + color + ';">' + trend + '</span>';
      } else {
        el.innerHTML = '<span style="color: var(--board-muted);">—</span>';
      }
    };

    document.getElementById("clinicalAdmitted").textContent = data.admitted.current;
    document.getElementById("clinicalDischarged").textContent = data.discharged.current;
    document.getElementById("clinicalDeceased").textContent = data.deceased.current;

    setTrend('trendAdmitted', data.admitted.trend, false);
    setTrend('trendDischarged', data.discharged.trend, false);
    setTrend('trendDeceased', data.deceased.trend, true);
  } catch (e) {
    console.error("Failed to load clinical outcomes:", e);
  }
}

// ============================================================
// ATTENTION REQUIRED
// ============================================================
async function loadAttention() {
  try {
    const res = await fetch("/api/dashboard/alerts");
    if (!res.ok) return;
    const alerts = await res.json();

    const el = document.getElementById("attentionList");
    const items = [];

    if (alerts.files > 0) {
      items.push({
        severity: alerts.files > 2 ? 'critical' : 'warning',
        text: alerts.files + ' patient file' + (alerts.files > 1 ? 's' : '') + ' overdue >5 days',
        breakdown: 'alerts-files',
      });
    }

    if (alerts.projects > 0) {
      items.push({
        severity: 'warning',
        text: alerts.projects + ' project' + (alerts.projects > 1 ? 's' : '') + ' blocked or stale',
        breakdown: 'projects-list',
        params: { status: 'pending' },
      });
    }

    if (alerts.equipment > 0) {
      items.push({
        severity: 'critical',
        text: alerts.equipment + ' equipment out of order',
        breakdown: 'equipment-out-of-order',
      });
    }

    if (alerts.incidents > 0) {
      items.push({
        severity: 'critical',
        text: alerts.incidents + ' open security incident' + (alerts.incidents > 1 ? 's' : ''),
        breakdown: 'alerts-incidents',
      });
    }

    if (alerts.tenders > 0) {
      items.push({
        severity: 'warning',
        text: alerts.tenders + ' tender' + (alerts.tenders > 1 ? 's' : '') + ' stalled >14 days',
        breakdown: 'tenders-list',
      });
    }

    if (items.length === 0) {
      el.innerHTML = '<p style="font-size: 14px; text-align: center; padding: 20px; color: #16a34a; font-weight: 700;">All systems normal</p>';
      return;
    }

    // Store items so alert modal can attach click handlers
    window._attentionItems = items;

    el.innerHTML = items.map((i, idx) => {
      return '<div class="attention-item ' + i.severity + '" data-item-index="' + idx + '" style="cursor: pointer;">' +
        '<span><span class="attention-dot ' + i.severity + '"></span>' + escapeHtml(i.text) + '</span>' +
        '<span class="attention-link">Drill down</span>' +
        '</div>';
    }).join('');

    // Attach click handlers
    el.querySelectorAll('[data-item-index]').forEach(row => {
      row.addEventListener('click', () => {
        const idx = parseInt(row.dataset.itemIndex);
        const item = items[idx];
        if (item && item.breakdown) {
          openBreakdown(item.breakdown, item.params || {});
        }
      });
    });
  } catch (e) {
    console.error("Failed to load attention:", e);
  }
}

// ============================================================
// ALERTS MODAL
// ============================================================
function openAlertsModal() {
  document.getElementById("alertsModal").classList.add("active");
  document.getElementById("alertsModalBackdrop").classList.add("active");

  const body = document.getElementById("alertsModalBody");
  const items = window._attentionItems || [];

  if (items.length === 0) {
    body.innerHTML = '<p class="muted" style="text-align:center; padding:20px;">No active alerts</p>';
    return;
  }

  body.innerHTML = items.map((i, idx) => {
    return '<div class="breakdown-list-item ' + i.severity + '" data-item-index="' + idx + '" style="cursor:pointer;">' +
      '<span class="breakdown-list-label">' + escapeHtml(i.text) + '</span>' +
      '<span class="breakdown-list-value">View</span>' +
      '</div>';
  }).join('');

  body.querySelectorAll('[data-item-index]').forEach(row => {
    row.addEventListener('click', () => {
      const idx = parseInt(row.dataset.itemIndex);
      const item = items[idx];
      closeAlertsModal();
      if (item && item.breakdown) {
        openBreakdown(item.breakdown, item.params || {});
      }
    });
  });
}

function closeAlertsModal() {
  document.getElementById("alertsModal").classList.remove("active");
  document.getElementById("alertsModalBackdrop").classList.remove("active");
}

// ============================================================
// DEATHS BREAKDOWN MODAL
// ============================================================
async function openDeathsModal() {
  const modal = document.getElementById("deathsModal");
  const backdrop = document.getElementById("deathsModalBackdrop");
  const body = document.getElementById("deathsModalBody");
  const count = document.getElementById("deathsModalCount");

  modal.classList.add("active");
  backdrop.classList.add("active");
  body.innerHTML = '<p class="muted" style="text-align:center; padding:16px;">Loading...</p>';

  try {
    const res = await fetch("/api/dashboard/deaths-breakdown?period=" + currentPeriod);
    if (!res.ok) throw new Error('Failed to load');
    const data = await res.json();

    count.textContent = '(' + data.total + ')';

    if (data.total === 0) {
      body.innerHTML = '<p class="muted" style="text-align:center; padding:20px;">No deaths recorded in this period</p>';
      return;
    }

    let html = '';

    if (data.byWard.length > 0) {
      html += '<div style="margin-bottom: 20px;">';
      html += '<h4 style="font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.6px; color: var(--board-muted); margin-bottom: 10px;">By Ward</h4>';
      data.byWard.forEach(w => {
        const pct = ((w.count / data.total) * 100).toFixed(0);
        html += '<div style="display: flex; justify-content: space-between; padding: 8px 12px; background: var(--board-surface-2); border-radius: 4px; margin-bottom: 6px; font-size: 13px; font-weight: 600; color: var(--board-text);">' +
          '<span>' + escapeHtml(w.name) + '</span>' +
          '<span>' + w.count + ' (' + pct + '%)</span>' +
          '</div>';
      });
      html += '</div>';
    }

    if (data.byDiagnosis.length > 0) {
      html += '<div style="margin-bottom: 20px;">';
      html += '<h4 style="font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.6px; color: var(--board-muted); margin-bottom: 10px;">By Cause</h4>';
      data.byDiagnosis.forEach(d => {
        const pct = ((d.count / data.total) * 100).toFixed(0);
        html += '<div style="display: flex; justify-content: space-between; padding: 8px 12px; background: var(--board-surface-2); border-radius: 4px; margin-bottom: 6px; font-size: 13px; font-weight: 600; color: var(--board-text);">' +
          '<span>' + escapeHtml(d.name) + '</span>' +
          '<span>' + d.count + ' (' + pct + '%)</span>' +
          '</div>';
      });
      html += '</div>';
    }

    html += '<div>';
    html += '<h4 style="font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.6px; color: var(--board-muted); margin-bottom: 10px;">By Gender</h4>';
    html += '<div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px;">';
    ['Male', 'Female', 'Unknown'].forEach(g => {
      if (data.byGender[g] > 0) {
        html += '<div style="text-align: center; padding: 12px; background: var(--board-surface-2); border-radius: 4px;">' +
          '<div style="font-size: 20px; font-weight: 900; color: var(--board-text);">' + data.byGender[g] + '</div>' +
          '<div style="font-size: 10px; color: var(--board-muted); text-transform: uppercase; font-weight: 700; margin-top: 2px;">' + g + '</div>' +
          '</div>';
      }
    });
    html += '</div></div>';

    body.innerHTML = html;
  } catch (e) {
    body.innerHTML = '<p class="error" style="text-align:center; padding:16px;">Failed to load: ' + escapeHtml(e.message) + '</p>';
  }
}

function closeDeathsModal() {
  document.getElementById("deathsModal").classList.remove("active");
  document.getElementById("deathsModalBackdrop").classList.remove("active");
}

// ============================================================
// BREAKDOWN MODAL (Executive View)
// ============================================================
async function openBreakdown(type, params) {
  const modal = document.getElementById("breakdownModal");
  const backdrop = document.getElementById("breakdownModalBackdrop");
  const body = document.getElementById("breakdownModalBody");
  const titleEl = document.getElementById("breakdownModalTitle");
  const countEl = document.getElementById("breakdownModalCount");

  modal.classList.add("active");
  backdrop.classList.add("active");
  body.innerHTML = '<p class="muted" style="text-align:center; padding:20px;">Loading...</p>';
  titleEl.textContent = 'Loading...';
  countEl.textContent = '';

  // Build query string from params
  const query = new URLSearchParams({ type, period: currentPeriod });
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') query.set(k, v);
    });
  }

  try {
    const res = await fetch('/api/dashboard/breakdown?' + query.toString());
    if (!res.ok) throw new Error('Failed to load breakdown');
    const data = await res.json();

    titleEl.textContent = data.title;
    countEl.textContent = '(' + data.total + ' ' + data.unit + ')';

    if (!data.rows || data.rows.length === 0) {
      body.innerHTML = '<p class="muted" style="text-align:center; padding:20px;">No data available</p>';
      return;
    }

    if (data.view === 'list') {
      // List view - each row is a clickable record
      body.innerHTML = data.rows.map(r => {
        const cls = r.kind || '';
        return `<div class="breakdown-list-item ${cls}">
          <div class="breakdown-list-label">${escapeHtml(r.label)}</div>
          <div class="breakdown-list-value">${r.value}${r.unit || ''}</div>
          ${r.extra ? `<div class="breakdown-list-meta">${escapeHtml(r.extra)}</div>` : ''}
        </div>`;
      }).join('');
      return;
    }

    // Bar view (default)
    const maxValue = Math.max(...data.rows.map(r => r.value), 1);

    body.innerHTML = data.rows.map(r => {
      const barWidth = (r.value / maxValue) * 100;

      let barColor = 'var(--primary)';
      let capacityNote = '';

      if (r.capacity !== undefined && r.capacity !== null) {
        if (r.value > r.capacity) {
          barColor = '#dc2626';
          capacityNote = ' / ' + r.capacity + ' capacity — OVER';
        } else if (r.value >= r.capacity * 0.8) {
          barColor = '#d97706';
          capacityNote = ' / ' + r.capacity + ' capacity';
        } else {
          barColor = '#16a34a';
          capacityNote = ' / ' + r.capacity + ' capacity';
        }
      } else {
        const status = r.kind || '';
        if (status === 'critical') barColor = '#dc2626';
        else if (status === 'warning') barColor = '#ea580c';
        else if (status === 'success') barColor = '#16a34a';
      }

      const extraLine = r.extra
        ? `<span style="font-size: 11px; color: var(--board-muted); margin-left: 8px;">${escapeHtml(r.extra)}</span>`
        : '';

      return `
        <div style="margin-bottom: 14px;">
          <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 4px;">
            <span style="font-size: 13px; font-weight: 700; color: var(--board-text);">${escapeHtml(r.label)}</span>
            <span style="font-size: 13px; font-weight: 700; color: var(--board-text);">
              ${r.value}
              <span style="font-size: 11px; color: var(--board-muted); font-weight: 600;">(${r.percentage}%)</span>
              ${extraLine}
            </span>
          </div>
          <div style="height: 8px; background: var(--board-surface-2); border-radius: 4px; overflow: hidden;">
            <div style="height: 100%; width: ${barWidth}%; background: ${barColor}; border-radius: 4px; transition: width 0.3s;"></div>
          </div>
          ${capacityNote ? `<div style="font-size: 11px; margin-top: 4px; color: ${barColor}; font-weight: 600;">${r.value}${capacityNote}</div>` : ''}
        </div>
      `;
    }).join('');
  } catch (e) {
    titleEl.textContent = 'Error';
    body.innerHTML = '<p class="error" style="text-align:center; padding:20px;">' + escapeHtml(e.message) + '</p>';
  }
}

function closeBreakdownModal() {
  document.getElementById("breakdownModal").classList.remove("active");
  document.getElementById("breakdownModalBackdrop").classList.remove("active");
}

// ============================================================
// PROJECTS / FINANCE / ESTABLISHMENT / LABOUR / INVENTORY / SYSTEM
// (All driven by the /breakdown endpoint now — these just fill the tiles)
// ============================================================
async function loadProjects() {
  try {
    const res = await fetch("/api/projects/summary-public");
    if (!res.ok) return;
    const s = await res.json();
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('projTotal', s.total || 0);
    set('projOngoing', (s.byStatus && s.byStatus.ongoing) || 0);
    set('projPending', (s.byStatus && s.byStatus.pending) || 0);
    set('projCompleted', (s.byStatus && s.byStatus.completed) || 0);
  } catch (e) { console.error("Failed to load projects:", e); }
}

async function loadFinance() {
  try {
    const now = new Date();
    const today = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
    const res = await fetch('/api/accounts/summary?from=' + today + '&to=' + today);
    const loginLink = document.getElementById('financeLoginLink');
    if (!res.ok) {
      const ids = ['finUsdNet', 'finZwgNet', 'finTxnCount'];
      ids.forEach(id => { const el = document.getElementById(id); if (el) el.textContent = '—'; });
      if (loginLink) loginLink.style.display = 'inline-block';
      return;
    }
    const data = await res.json();
    if (loginLink) loginLink.style.display = 'none';
    document.getElementById('finUsdNet').textContent = '$' + (data.usdNet || 0).toFixed(0);
    document.getElementById('finZwgNet').textContent = 'Z$' + (data.zwgNet || 0).toFixed(0);
    document.getElementById('finTxnCount').textContent = (data.flows || []).length;
  } catch (e) { console.error("Failed to load finance:", e); }
}

async function loadEstablishment() {
  try {
    const res = await fetch("/api/establishment/summary-public");
    if (!res.ok) return;
    const s = await res.json();
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('estTotal', s.total || 0);
    set('estTransfers', s.transfers || 0);
    set('estRetirements', s.retirements || 0);
    set('estResignations', s.resignations || 0);
    set('estUnder', s.understaffed || 0);
    set('estOver', s.overstaffed || 0);
  } catch (e) { console.error("Failed to load establishment:", e); }
}

async function loadLabour() {
  try {
    const now = new Date();
    const today = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
    const res = await fetch('/api/disciplinary/summary-public?from=' + today + '&to=' + today);
    if (!res.ok) return;
    const s = await res.json();
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('discTotal', s.total || 0);
    set('discOpen', (s.byStatus && s.byStatus.open) || 0);
    set('discInvestigation', (s.byStatus && s.byStatus.under_investigation) || 0);
    set('discResolved', (s.byStatus && s.byStatus.resolved) || 0);
    set('discDismissed', (s.byStatus && s.byStatus.dismissed) || 0);
    set('disc30d', s.last30Days || 0);
  } catch (e) { console.error("Failed to load labour:", e); }
}

async function loadInventory() {
  try {
    const res = await fetch("/api/inventory/summary", {
      headers: { Authorization: 'Bearer ' + (localStorage.getItem('token') || '') },
    });
    if (!res.ok) {
      const ids = ['invTotal', 'invCritical', 'invLow', 'invAdequate'];
      ids.forEach(id => { const el = document.getElementById(id); if (el) el.textContent = '—'; });
      return;
    }
    const s = await res.json();
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('invTotal', s.totalItems || 0);
    set('invCritical', s.critical || 0);
    set('invLow', s.low || 0);
    set('invAdequate', s.adequate || 0);
  } catch (e) { console.error("Failed to load inventory:", e); }
}

async function loadSystem() {
  try {
    const token = localStorage.getItem('token') || '';
    if (token) {
      const res = await fetch('/api/auth/system-status', { headers: { Authorization: 'Bearer ' + token } });
      if (res.ok) {
        const s = await res.json();
        const el = document.getElementById('itTotalUsers');
        if (el) el.textContent = s.totalUsers || 0;
      }
    }
  } catch (e) { /* silent */ }

  try {
    const token = localStorage.getItem('token') || '';
    if (token) {
      const res = await fetch('/api/audit?page=1&pageSize=1', { headers: { Authorization: 'Bearer ' + token } });
      if (res.ok) {
        const s = await res.json();
        const el = document.getElementById('auditRecent');
        if (el) el.textContent = s.total || 0;
      }
    }
  } catch (e) { /* silent */ }

  try {
    const res = await fetch('/api/dashboard/alerts');
    if (res.ok) {
      const a = await res.json();
      const el = document.getElementById('bioOutOfOrder');
      if (el) el.textContent = a.equipment || 0;
    }
  } catch (e) { /* silent */ }
}

// ============================================================
// DEPARTMENTS
// ============================================================
async function loadDepartments() {
  try {
    const res = await fetch("/api/dashboard/departments");
    if (!res.ok) return;
    allDepartments = await res.json();
  } catch (e) { console.error(e); }
}

function showDepartments(category) {
  currentCategory = category;
  document.getElementById("categoryView").style.display = "none";
  document.getElementById("departmentView").style.display = "block";
  document.getElementById("backToCategoriesBtn").style.display = "inline-block";

  const filtered = allDepartments.filter(d => d.category === category);
  const grid = document.getElementById("departmentGrid");

  grid.innerHTML = filtered.map(d => {
    const statusColor = d.status === 'critical' ? '#dc2626' : d.status === 'warning' ? '#ea580c' : '#16a34a';
    const statusLabel = d.status === 'critical' ? 'CRITICAL' : d.status === 'warning' ? 'WARNING' : 'HEALTHY';

    const statParts = [];
    Object.entries(d.stats).forEach(([k, v]) => {
      if (v !== null && v !== undefined) {
        const label = k.replace(/([A-Z])/g, ' $1').toLowerCase().trim();
        statParts.push('<strong>' + v + '</strong> ' + label);
      }
    });

    return '<div class="department-card ' + d.status + '">' +
      '<div>' +
      '<div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 10px;">' +
      '<h4 class="department-name">' + escapeHtml(d.name) + '</h4>' +
      '<span class="dept-status-pill" style="background: ' + statusColor + '15; color: ' + statusColor + ';">' + statusLabel + '</span>' +
      '</div>' +
      '<div class="department-stats">' + statParts.join(' · ') + '</div>' +
      '</div>' +
      '<a href="/' + d.id + '" style="margin-top: 14px; padding: 10px; background: var(--primary); color: #fff; border-radius: 6px; text-align: center; text-decoration: none; font-size: 13px; font-weight: 700;">View Portal</a>' +
      '</div>';
  }).join('');
}

function showCategoryView() {
  currentCategory = null;
  document.getElementById("categoryView").style.display = "block";
  document.getElementById("departmentView").style.display = "none";
  document.getElementById("backToCategoriesBtn").style.display = "none";
}

// ============================================================
// ACTIVITY FEED
// ============================================================
async function loadActivity() {
  try {
    const res = await fetch("/api/dashboard/activity");
    if (!res.ok) return;
    const events = await res.json();
    renderActivity(events);
  } catch (e) { console.error(e); }
}

function renderActivity(events) {
  const el = document.getElementById("activityFeed");

  if (!events || events.length === 0) {
    el.innerHTML = '<p style="font-size: 13px; text-align: center; padding: 12px; color: var(--board-muted);">No recent activity</p>';
    return;
  }

  el.innerHTML = events.map(e => {
    const time = fmtTime(e.timestamp);
    return '<div class="activity-row">' +
      '<span class="activity-dot ' + e.severity + '"></span>' +
      '<span class="activity-time">' + time + '</span>' +
      '<span class="activity-msg">' + escapeHtml(e.message) + '</span>' +
      '<a href="/' + e.portal + '" class="activity-link">View</a>' +
      '</div>';
  }).join('');
}

// ============================================================
// REFRESH ALL
// ============================================================
function refreshAll() {
  loadMorningBrief();
  loadStats();
  loadClinicalOutcomes();
  loadAttention();
  loadProjects();
  loadFinance();
  loadEstablishment();
  loadLabour();
  loadInventory();
  loadSystem();
  loadDepartments().then(() => {
    if (currentCategory) showDepartments(currentCategory);
  });
  loadActivity();
}

// ============================================================
// SOCKET
// ============================================================
const socket = io({
  transports: ["websocket", "polling"],
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
});

socket.on("connect", () => {
  const syncEl = document.getElementById("syncText");
  if (syncEl) syncEl.textContent = "CONNECTED";
  setTimeout(refreshAll, 800);
});

socket.on("disconnect", () => {
  const syncEl = document.getElementById("syncText");
  if (syncEl) syncEl.textContent = "DISCONNECTED";
});

socket.on("reconnect_attempt", (attempt) => {
  const syncEl = document.getElementById("syncText");
  if (syncEl) syncEl.textContent = "RECONNECTING " + attempt;
});

socket.on("patient:updated", () => { loadStats(); loadClinicalOutcomes(); loadActivity(); });
socket.on("patient:created", () => { loadStats(); loadClinicalOutcomes(); loadActivity(); });
socket.on("order:updated", () => { loadStats(); loadActivity(); });
socket.on("order:created", () => { loadStats(); loadActivity(); });
socket.on("security:incident", () => { loadAttention(); loadActivity(); });
socket.on("radiography:updated", () => loadActivity());
socket.on("catering:updated", () => loadActivity());
socket.on("biomedical:updated", () => { loadAttention(); loadSystem(); loadActivity(); });
socket.on("healthinfo:updated", () => { loadAttention(); loadActivity(); });
socket.on("project:updated", () => { loadAttention(); loadProjects(); });
socket.on("project:created", () => { loadAttention(); loadProjects(); loadActivity(); });
socket.on("inventory:updated", () => loadInventory());
socket.on("employee:updated", () => { loadStats(); loadEstablishment(); });
socket.on("establishment:updated", () => loadEstablishment());
socket.on("disciplinary:created", () => loadLabour());
socket.on("disciplinary:updated", () => loadLabour());

// ============================================================
// INIT
// ============================================================
initTheme();
loadBoardSettings();
setConnectionInfo();
tickClock();
setInterval(tickClock, 1000);

setInterval(() => {
  const syncEl = document.getElementById("syncText");
  if (!syncEl) return;
  const state = syncEl.textContent;
  if (state === "OFFLINE" || state === "DISCONNECTED" || state.startsWith("RECONNECTING")) {
    refreshAll();
  }
}, 60000);

document.addEventListener("visibilitychange", () => {
  if (!document.hidden) refreshAll();
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeAlertsModal();
    closeDeathsModal();
    closeBreakdownModal();
    if (currentCategory) showCategoryView();
  }
});
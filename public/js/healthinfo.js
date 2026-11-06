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
  if (icon) icon.textContent = theme === "light" ? "DARK" : "LIGHT";
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
// LOAD SETTINGS
// ============================================================
async function loadBoardSettings() {
  try {
    const res = await fetch("/api/settings/public");
    if (!res.ok) return;
    const data = await res.json();
    const title = document.getElementById("boardTitle");
    if (title) title.textContent = (data.hospitalName || "Hospital").toUpperCase();
    document.title = (data.hospitalName || "Hospital") + " — Command Center";
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

    const dist = data.distribution;
    const total = dist.admitted + dist.treatment + dist.discharged + dist.deceased;
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
        portal: 'healthinfo',
      });
    }

    if (alerts.details.blockedProjects.length > 0) {
      alerts.details.blockedProjects.forEach(p => {
        items.push({
          severity: p.daysStale > 14 ? 'critical' : 'warning',
          text: 'Project "' + p.name + '" blocked ' + p.daysStale + ' days',
          portal: 'projects',
        });
      });
    }

    if (alerts.details.outOfOrder.length > 0) {
      items.push({
        severity: 'critical',
        text: alerts.details.outOfOrder.length + ' equipment out of order (' + alerts.details.outOfOrder.map(e => e.name).slice(0, 2).join(', ') + ')',
        portal: 'biomedical',
      });
    }

    if (alerts.incidents > 0) {
      items.push({
        severity: 'critical',
        text: alerts.incidents + ' open security incident' + (alerts.incidents > 1 ? 's' : ''),
        portal: 'security',
      });
    }

    if (alerts.tenders > 0) {
      items.push({
        severity: 'warning',
        text: alerts.tenders + ' tender' + (alerts.tenders > 1 ? 's' : '') + ' stalled >14 days',
        portal: 'procurement',
      });
    }

    if (items.length === 0) {
      el.innerHTML = '<p style="font-size: 14px; text-align: center; padding: 20px; color: #16a34a; font-weight: 700;">All systems normal</p>';
      return;
    }

    el.innerHTML = items.map(i => {
      return '<div class="attention-item ' + i.severity + '">' +
        '<span><span class="attention-dot ' + i.severity + '"></span>' + escapeHtml(i.text) + '</span>' +
        '<a href="/' + i.portal + '" class="attention-link">View</a>' +
        '</div>';
    }).join('');
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
  document.getElementById("alertsModalBody").innerHTML = document.getElementById("attentionList").innerHTML;
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
        html += '<div style="display: flex; justify-content: space-between; padding: 8px 12px; background: var(--board-surface-2); border-radius: 4px; margin-bottom: 6px; font-size: 13px; font-weight: 600;">' +
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
        html += '<div style="display: flex; justify-content: space-between; padding: 8px 12px; background: var(--board-surface-2); border-radius: 4px; margin-bottom: 6px; font-size: 13px; font-weight: 600;">' +
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
          '<div style="font-size: 20px; font-weight: 900;">' + data.byGender[g] + '</div>' +
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
    el.innerHTML = '<p class="muted" style="font-size: 13px; text-align: center; padding: 12px;">No recent activity</p>';
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
  loadStats();
  loadClinicalOutcomes();
  loadAttention();
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
  document.getElementById("syncText").textContent = "CONNECTED";
  setTimeout(refreshAll, 800);
});

socket.on("disconnect", () => {
  document.getElementById("syncText").textContent = "DISCONNECTED";
});

socket.on("reconnect_attempt", (attempt) => {
  document.getElementById("syncText").textContent = "RECONNECTING " + attempt;
});

socket.on("patient:updated", () => { loadStats(); loadClinicalOutcomes(); loadActivity(); });
socket.on("patient:created", () => { loadStats(); loadClinicalOutcomes(); loadActivity(); });
socket.on("order:updated", () => { loadStats(); loadActivity(); });
socket.on("order:created", () => { loadStats(); loadActivity(); });
socket.on("security:incident", () => { loadAttention(); loadActivity(); });
socket.on("radiography:updated", () => loadActivity());
socket.on("catering:updated", () => loadActivity());
socket.on("biomedical:updated", () => { loadAttention(); loadActivity(); });
socket.on("healthinfo:updated", () => { loadAttention(); loadActivity(); });
socket.on("project:updated", () => loadAttention());
socket.on("project:created", () => { loadAttention(); loadActivity(); });

// ============================================================
// INIT
// ============================================================
initTheme();
loadBoardSettings();
tickClock();
setInterval(tickClock, 1000);

setInterval(() => {
  const state = document.getElementById("syncText").textContent;
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
    if (currentCategory) showCategoryView();
  }
});
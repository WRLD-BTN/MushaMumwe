// ============================================================
// Sally Mugabe Central Hospital - Super Admin Launcher
// ============================================================

async function init_super() {
  await refreshSuperAdminSettings();
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

    // Keep the outer shell in sync
    systemSettings.hospitalName = data.hospitalName || systemSettings.hospitalName;
    systemSettings.hospitalSubtitle = data.hospitalSubtitle || systemSettings.hospitalSubtitle;
    applySettingsToShell();
  } catch (e) {
    console.error(e);
  }
}
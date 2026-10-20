// Audit log helper + middleware.
// Every mutating request calls audit() to record what happened.

const prisma = require('./prismaClient');

// ============================================================
// DEVICE TAG — short fingerprint of client (IP + UA prefix)
// ============================================================
function deviceTag(req) {
  const ip = req.clientIp || clientIp(req);
  const ua = (req.headers['user-agent'] || '').slice(0, 40);
  return (ip + '|' + ua).slice(0, 100);
}

function clientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (fwd) return String(fwd).split(',')[0].trim();
  return req.ip || req.socket?.remoteAddress || req.connection?.remoteAddress || 'unknown';
}

// ============================================================
// audit() — fire-and-forget logging (never throws, never blocks)
// ============================================================
async function audit(req, {
  action,
  entity,
  entityId = null,
  summary,
  before = null,
  after = null,
}) {
  try {
    const user = req.user || {};
    await prisma.auditLog.create({
      data: {
        userId:     typeof user.id === 'number' ? user.id : null,
        username:   user.username || 'anonymous',
        fullName:   user.fullName || 'Anonymous',
        department: user.department || 'unknown',
        role:       user.role || 'anonymous',
        action:     String(action || '').slice(0, 50),
        entity:     String(entity || '').slice(0, 50),
        entityId:   entityId != null ? String(entityId).slice(0, 100) : null,
        summary:    String(summary || '').slice(0, 500),
        before:     before ? JSON.stringify(before).slice(0, 4000) : null,
        after:      after  ? JSON.stringify(after).slice(0, 4000)  : null,
        ipAddress:  clientIp(req),
        userAgent:  (req.headers['user-agent'] || '').slice(0, 300),
        deviceTag:  deviceTag(req),
      },
    });
  } catch (e) {
    // Never let audit failure break the actual operation.
    console.error('[audit] failed:', e.message);
  }
}

// ============================================================
// auditLogin() — special-case for login (no req.user yet)
// ============================================================
async function auditLogin(req, user, success = true) {
  try {
    await prisma.auditLog.create({
      data: {
        userId:     typeof user?.id === 'number' ? user.id : null,
        username:   user?.username || 'unknown',
        fullName:   user?.fullName || 'Unknown',
        department: user?.department || 'unknown',
        role:       user?.role || 'unknown',
        action:     success ? 'login' : 'login_failed',
        entity:     'auth',
        entityId:   null,
        summary:    success
          ? (user?.fullName || user?.username || 'Unknown') + ' logged in'
          : 'Failed login attempt for ' + (user?.username || 'unknown'),
        before:     null,
        after:      null,
        ipAddress:  clientIp(req),
        userAgent:  (req.headers['user-agent'] || '').slice(0, 300),
        deviceTag:  deviceTag(req),
      },
    });
  } catch (e) {
    console.error('[audit] login log failed:', e.message);
  }
}

module.exports = { audit, auditLogin, clientIp, deviceTag };
// src/audit.js
//
// Thin wrappers over writeAuditRow() for the two call patterns we use:
//   - audit(req, {...})         — user is already on req.user
//   - auditLogin(req, user)     — no req.user yet (login / login_failed)
//
// All persistence + hash-chaining happens in auditMiddleware.writeAuditRow.

const { writeAuditRow } = require('./auditMiddleware');
const { clientIp, deviceTag } = require('./auditUtils');

// General-purpose audit call from a route after authentication.
// Usage:
//   await audit(req, {
//     action: 'create',
//     entity: 'Patient',
//     entityId: patient.id,
//     summary: 'Admitted patient',
//     before: null,
//     after: JSON.stringify(patient),
//   });
async function audit(req, {
  action,
  entity,
  entityId = null,
  summary,
  before = null,
  after = null,
  body = null,
  query = null,
} = {}) {
  if (!req) throw new Error('audit() requires req');
  if (!action) throw new Error('audit() requires action');
  if (!entity) throw new Error('audit() requires entity');
  if (!summary) throw new Error('audit() requires summary');

  const u = req.user || {};
  return writeAuditRow(req, {
    action,
    entity,
    entityId,
    summary,
    before,
    after,
    body,
    query,
    // user may be missing on some public routes — fall back to 'anonymous'
    username:   u.username   || 'anonymous',
    fullName:   u.fullName   || 'Anonymous',
    department: u.department || 'unknown',
    role:       u.role       || 'unknown',
    userId:     u.id         || null,
  });
}

// Dedicated login / login_failed path. No req.user yet, so we pass the
// user object explicitly. Called from src/routes/auth.js.
//
//   await auditLogin(req, userObj, true)   -> action: 'login'
//   await auditLogin(req, userObj, false)  -> action: 'login_failed'
async function auditLogin(req, user, success = true) {
  if (!req) throw new Error('auditLogin() requires req');
  if (!user) throw new Error('auditLogin() requires user');

  const summary = success
    ? `User ${user.username} logged in`
    : `Failed login attempt for ${user.username}`;

  return writeAuditRow(req, {
    action: success ? 'login' : 'login_failed',
    entity: 'User',
    entityId: user.id ? String(user.id) : null,
    summary,
    before: null,
    after: null,
    body: null,
    query: null,
    username:   user.username   || 'unknown',
    fullName:   user.fullName   || 'Unknown',
    department: user.department || 'unknown',
    role:       user.role       || 'unknown',
    userId:     user.id         || null,
  });
}

module.exports = { audit, auditLogin, clientIp, deviceTag };
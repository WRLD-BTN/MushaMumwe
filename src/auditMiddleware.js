// src/auditMiddleware.js
//
// Express middleware that records every /api call as an AuditLog row and
// maintains a SHA-256 hash chain (prevHash -> rowHash) so DB tampering is
// detectable.
//
// Design notes:
//   * computeHashes(data, prevHash) hashes a canonical string of the row's
//     persisted fields + prevHash. Recomputing later MUST reproduce the same
//     digest — so we never include Date.now(), request objects, or anything
//     whose serialization could vary.
//   * The previous hash is read inside the same transaction as the insert,
//     so two concurrent writes cannot both link to the same predecessor.
//   * Genesis row uses prevHash = '0'.repeat(64). Pre-migration rows with a
//     NULL rowHash are skipped by "SELECT ... WHERE rowHash IS NOT NULL".
//   * Failures to write an audit row are logged but never bubble up to the
//     client — auditing must not take the app down.
//   * writeAuditRow is DEFINED and EXPORTED here. audit.js must import it
//     from this file (not the other way around) — that removes the circular
//     require that previously made writeAuditRow `undefined` at call time.
//   * /api/auth/login is skipped by the generic middleware because
//     routes/auth.js already calls auditLogin() for that path; recording
//     it here too would produce a duplicate row per login.

const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { clientIp, deviceTag } = require('./auditUtils');

const HASH_ALGO = 'sha256';
const GENESIS_HASH = '0'.repeat(64);

// ------------------------------------------------------------
// Canonical serialization + hashing
// ------------------------------------------------------------
function canonicalString(row) {
  // Field order is fixed and documented here so any change is a breaking
  // change to the hash chain. Do not reorder without migrating existing rows.
  const parts = [
    row.timestamp instanceof Date ? row.timestamp.toISOString() : (row.timestamp || ''),
    row.userId != null ? String(row.userId) : '',
    row.username || '',
    row.fullName || '',
    row.department || '',
    row.role || '',
    row.action || '',
    row.entity || '',
    row.entityId != null ? String(row.entityId) : '',
    row.summary || '',
    row.method || '',
    row.path || '',
    row.httpStatus != null ? String(row.httpStatus) : '',
    row.success === true ? '1' : row.success === false ? '0' : '',
    row.durationMs != null ? String(row.durationMs) : '',
    row.before || '',
    row.after || '',
    row.body || '',
    row.query || '',
    row.ipAddress || '',
    row.userAgent || '',
    row.deviceTag || '',
    row.requestId || '',
  ];
  return parts.join('\u001f'); // unit separator; never appears in user text
}

async function computeHashes(data, prevHash) {
  const prev = prevHash || GENESIS_HASH;
  const canonical = canonicalString(data);
  const rowHash = crypto
    .createHash(HASH_ALGO)
    .update(prev)
    .update(canonical)
    .digest('hex');
  return { prevHash: prev, rowHash };
}

// ------------------------------------------------------------
// Insertion with chain link (transactional)
// ------------------------------------------------------------
async function writeAuditRow(req, fields) {
  const {
    action,
    entity,
    entityId = null,
    summary,
    before = null,
    after = null,
    body = null,
    query = null,
    username,
    fullName,
    department,
    role,
    userId = null,
  } = fields;

  const now = new Date();
  const ip = clientIp(req);
  const ua = (req.headers['user-agent'] || '').slice(0, 500);
  const dev = deviceTag(req);
  const requestId = req.id || req.headers['x-request-id'] || null;
  const method = req.method || null;
  const path = req.originalUrl || req.url || null;

  // httpStatus / success / durationMs are filled by the wrapper below
  // after the response finishes; writeAuditRow itself is called from there.
  const httpStatus = req._auditStatus != null ? req._auditStatus : null;
  const success = req._auditSuccess != null ? req._auditSuccess : null;
  const durationMs = req._auditDurationMs != null ? req._auditDurationMs : null;

  const provisional = {
    timestamp: now,
    userId,
    username: username || 'anonymous',
    fullName: fullName || 'Anonymous',
    department: department || 'unknown',
    role: role || 'unknown',
    action,
    entity,
    entityId,
    summary,
    method,
    path,
    httpStatus,
    success,
    durationMs,
    before,
    after,
    body,
    query,
    ipAddress: ip,
    userAgent: ua,
    deviceTag: dev,
    requestId,
  };

  try {
    await prisma.$transaction(async (tx) => {
      const prev = await tx.auditLog.findFirst({
        where: { rowHash: { not: null } },
        orderBy: { id: 'desc' },
        select: { rowHash: true },
      });
      const prevHash = prev?.rowHash || GENESIS_HASH;
      const { rowHash } = await computeHashes(provisional, prevHash);

      await tx.auditLog.create({
        data: {
          ...provisional,
          prevHash,
          rowHash,
        },
      });
    });
  } catch (e) {
    // Auditing must never crash the request.
    console.error('[audit] write failed:', e.message);
  }
}

// ------------------------------------------------------------
// Express middleware: wrap res so we know the final status code
// ------------------------------------------------------------
function makeMiddleware(forceAction) {
  return function auditMiddlewareInner(req, res, next) {
    const start = Date.now();

    // Attach identity from req.user if present (auth middleware runs first).
    const u = req.user || {};

    // ---- Login dedup guard ------------------------------------------------
    // routes/auth.js calls auditLogin() for POST /api/auth/login, which writes
    // a row with action='login'. If we also record it here, every login
    // produces TWO rows (create + login). Skip it here.
    // Applies to both auditMiddleware() and auditReadMiddleware() — harmless
    // for GET because there is no GET on /api/auth/login.
    if ((req.originalUrl || req.url || '').startsWith('/api/auth/login')) {
      return next();
    }
    // -----------------------------------------------------------------------

    // Capture the final status after the response finishes.
    const originalEnd = res.end.bind(res);
    res.end = function patchedEnd(...args) {
      try {
        req._auditStatus = res.statusCode;
        req._auditSuccess = res.statusCode >= 200 && res.statusCode < 400;
        req._auditDurationMs = Date.now() - start;

        // Infer action: read vs the method-based default.
        const action = forceAction
          ? forceAction
          : (req.method === 'GET' ? 'read' : inferAction(req.method));

        const entity = inferEntity(req.originalUrl || req.url || '');
        const summary = `${req.method} ${req.originalUrl || req.url} -> ${res.statusCode}`;

        // Fire-and-forget; the transaction inside writeAuditRow is atomic.
        // .catch() prevents an unhandled rejection if prisma ever throws
        // outside writeAuditRow's own try/catch (e.g. tx rollback).
        Promise.resolve(
          writeAuditRow(req, {
            action,
            entity,
            entityId: null,
            summary,
            before: null,
            after: null,
            body: null,
            query: req.originalUrl && req.originalUrl.includes('?')
              ? req.originalUrl.split('?')[1]
              : null,
            username:   u.username   || 'anonymous',
            fullName:   u.fullName   || 'Anonymous',
            department: u.department || 'unknown',
            role:       u.role       || 'unknown',
            userId:     u.id         || null,
          })
        ).catch((e) => {
          console.error('[audit] async write rejected:', e.message);
        });
      } catch (e) {
        console.error('[audit] end-hook failed:', e.message);
      }
      return originalEnd(...args);
    };

    next();
  };
}

function inferAction(method) {
  switch ((method || '').toUpperCase()) {
    case 'POST':   return 'create';
    case 'PUT':
    case 'PATCH':  return 'update';
    case 'DELETE': return 'delete';
    default:       return 'other';
  }
}

function inferEntity(url) {
  // '/api/patients/123/discharge' -> 'patients'
  const m = /^\/api\/([^/?]+)/.exec(url || '');
  return m ? m[1] : 'unknown';
}

const auditMiddleware     = () => makeMiddleware(null);      // writes: POST/PUT/PATCH/DELETE
const auditReadMiddleware = () => makeMiddleware('read');    // forced action='read'

module.exports = {
  auditMiddleware,
  auditReadMiddleware,
  writeAuditRow,
  computeHashes,
};
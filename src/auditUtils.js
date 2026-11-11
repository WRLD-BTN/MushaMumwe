// src/auditUtils.js
//
// Shared helpers for audit + date-range handling.
// - clientIp / deviceTag: unchanged behaviour.
// - parseDateFrom / parseDateTo: safe YYYY-MM-DD -> Date with
//   end-of-day expansion for `to`, so same-day records are not lost.

function clientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (fwd) return String(fwd).split(',')[0].trim();
  return req.ip || req.socket?.remoteAddress || req.connection?.remoteAddress || 'unknown';
}

function deviceTag(req) {
  const ip = clientIp(req);
  const ua = (req.headers['user-agent'] || '').slice(0, 40);
  return (ip + '|' + ua).slice(0, 100);
}

// Parse a `from` filter. Accepts "YYYY-MM-DD" or ISO. Returns Date at 00:00:00.000 local-free (UTC).
function parseDateFrom(v) {
  if (!v) return undefined;
  const s = String(v).trim();
  if (!s) return undefined;
  // If the string is date-only, force start of day UTC.
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(s);
  const d = new Date(dateOnly ? s + 'T00:00:00.000Z' : s);
  return isNaN(d.getTime()) ? undefined : d;
}

// Parse a `to` filter. Accepts "YYYY-MM-DD" or ISO. Returns Date at 23:59:59.999 UTC when date-only.
function parseDateTo(v) {
  if (!v) return undefined;
  const s = String(v).trim();
  if (!s) return undefined;
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(s);
  const d = new Date(dateOnly ? s + 'T23:59:59.999Z' : s);
  return isNaN(d.getTime()) ? undefined : d;
}

// Convenience: build a Prisma where-clause fragment for a DateTime field.
//   whereClause('createdAt', from, to) -> { createdAt: { gte, lte } }
// Returns {} if both are absent (so Prisma sees no filter).
function dateRangeWhere(field, fromV, toV) {
  const from = parseDateFrom(fromV);
  const to = parseDateTo(toV);
  if (!from && !to) return {};
  const range = {};
  if (from) range.gte = from;
  if (to) range.lte = to;
  return { [field]: range };
}

module.exports = {
  clientIp,
  deviceTag,
  parseDateFrom,
  parseDateTo,
  dateRangeWhere,
};
const jwt = require('jsonwebtoken');

function normDept(d) {
  if (!d) return '';
  return String(d).trim().toLowerCase();
}

function canonicalDept(d) {
  const s = normDept(d);
  const map = {
    nurses: 'Nurses',
    it: 'IT',
    procurement: 'Procurement',
    stores: 'Stores',
    hr: 'HR',
    superadmin: 'SuperAdmin',
  };
  return map[s] || d;
}

function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: 'Missing token' });
  const token = header.replace('Bearer ', '');
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function requireRole(allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

function requireDepartment(allowedDepartments) {
  const allowed = allowedDepartments.map(normDept);
  return (req, res, next) => {
    if (!req.user) {
      return res.status(403).json({ error: 'Not authenticated' });
    }
    // Super Admin bypasses all department checks
    if (normDept(req.user.department) === 'superadmin') {
      return next();
    }
    if (!allowed.includes(normDept(req.user.department))) {
      return res.status(403).json({
        error: 'Not authorized. Requires one of: ' + allowedDepartments.join(', '),
      });
    }
    next();
  };
}

// Convenience: is the current user a Super Admin?
function isSuperAdmin(req) {
  return req.user && normDept(req.user.department) === 'superadmin';
}

// Convenience: is the current user IT or Super Admin?
function isITOrSuperAdmin(req) {
  if (!req.user) return false;
  const d = normDept(req.user.department);
  return d === 'it' || d === 'superadmin';
}

module.exports = {
  requireAuth,
  requireRole,
  requireDepartment,
  normDept,
  canonicalDept,
  isSuperAdmin,
  isITOrSuperAdmin,
};
const jwt = require('jsonwebtoken');

// Case-insensitive department normalization
function normDept(d) {
  if (!d) return '';
  return String(d).trim().toLowerCase();
}

// Canonical department name (matches DB values)
function canonicalDept(d) {
  const s = normDept(d);
  const map = {
    nurses: 'Nurses',
    it: 'IT',
    procurement: 'Procurement',
    stores: 'Stores',
    hr: 'HR',
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
    if (!req.user || !allowed.includes(normDept(req.user.department))) {
      return res.status(403).json({
        error: `Not authorized. Requires one of: ${allowedDepartments.join(', ')}`,
      });
    }
    next();
  };
}

module.exports = { requireAuth, requireRole, requireDepartment, normDept, canonicalDept };
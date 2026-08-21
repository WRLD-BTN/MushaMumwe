const jwt = require("jsonwebtoken");

function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: "Missing token" });

  const token = header.replace("Bearer ", "");
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

function requireRole(allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }
    next();
  };
}

// Restricts a route to specific departments — e.g. only "nurses" and "it" can
// touch patient status, while "accounts" might only reach billing-related routes.
function requireDepartment(allowedDepartments) {
  return (req, res, next) => {
    if (!req.user || !allowedDepartments.includes(req.user.department)) {
      return res.status(403).json({ error: "Not authorized for this department's actions" });
    }
    next();
  };
}

module.exports = { requireAuth, requireRole, requireDepartment };

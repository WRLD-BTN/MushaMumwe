const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const prisma = require("../prismaClient");

const router = express.Router();

// POST /api/auth/login
// Body: { username, password }
// Returns a JWT carrying username, department, role, wardId — every
// downstream route reads these claims to decide what a user can see/edit.
router.post("/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "Username and password required" });
  }

  const user = await prisma.user.findUnique({ where: { username } });
  if (!user) return res.status(401).json({ error: "Invalid credentials" });

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return res.status(401).json({ error: "Invalid credentials" });

  const token = jwt.sign(
    {
      username: user.username,
      fullName: user.fullName,
      department: user.department,
      role: user.role,
      wardId: user.wardId,
    },
    process.env.JWT_SECRET,
    { expiresIn: "12h" }
  );

  res.json({
    token,
    user: {
      fullName: user.fullName,
      department: user.department,
      role: user.role,
    },
  });
});

// GET /api/auth/me — lets the frontend confirm who's logged in without re-sending credentials
router.get("/me", (req, res) => {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: "Not signed in" });
  try {
    const payload = jwt.verify(header.replace("Bearer ", ""), process.env.JWT_SECRET);
    res.json(payload);
  } catch {
    res.status(401).json({ error: "Session expired" });
  }
});

module.exports = router;

const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const prisma = require('../prismaClient');
const { requireAuth, isITOrSuperAdmin } = require('../auth');

const router = express.Router();

// ============================================================
// LOGIN
// Super Admin password is stored as a bcrypt HASH in .env.
// Regular users authenticate against the User table.
// ============================================================
router.post('/login', async (req, res) => {
  const { username, password, department } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  // --- Super Admin check first ---
  const saUser = process.env.SUPER_ADMIN_USERNAME || 'Admin';
  const saHash = process.env.SUPER_ADMIN_PASSWORD_HASH || '';

  if (username === saUser && saHash) {
    let superAdminValid = false;
    try {
      superAdminValid = await bcrypt.compare(password, saHash);
    } catch (e) {
      // Malformed hash in .env — fail silently to "invalid credentials"
      superAdminValid = false;
    }

    if (superAdminValid) {
      const token = jwt.sign(
        {
          id: 0,
          username: saUser,
          fullName: 'Super Admin',
          department: 'SuperAdmin',
          role: 'superadmin',
          wardId: null,
        },
        process.env.JWT_SECRET,
        { expiresIn: '12h' }
      );

      return res.json({
        token,
        user: {
          id: 0,
          username: saUser,
          fullName: 'Super Admin',
          department: 'SuperAdmin',
          role: 'superadmin',
          wardId: null,
        },
      });
    }

    // Wrong password for Super Admin — fall through to generic error
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // --- Regular user login: department is REQUIRED ---
  if (!department || !department.trim()) {
    return res.status(400).json({ error: 'Please select a department' });
  }

  const deptNormalized = String(department).trim();

  try {
    const anyUser = await prisma.user.findUnique({ where: { username } });

    if (!anyUser) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (String(anyUser.department).trim().toLowerCase() !== deptNormalized.toLowerCase()) {
      return res.status(401).json({
        error: 'This username belongs to the ' + anyUser.department +
               ' department. Please select the correct department.'
      });
    }

    const valid = await bcrypt.compare(password, anyUser.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      {
        id: anyUser.id,
        username: anyUser.username,
        fullName: anyUser.fullName,
        department: anyUser.department,
        role: anyUser.role,
        wardId: anyUser.wardId,
      },
      process.env.JWT_SECRET,
      { expiresIn: '12h' }
    );

    res.json({
      token,
      user: {
        id: anyUser.id,
        username: anyUser.username,
        fullName: anyUser.fullName,
        department: anyUser.department,
        role: anyUser.role,
        wardId: anyUser.wardId,
      },
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================================
// ME
// ============================================================
router.get('/me', requireAuth, async (req, res) => {
  try {
    if (req.user.department === 'SuperAdmin') {
      return res.json({
        id: 0,
        username: req.user.username,
        fullName: 'Super Admin',
        department: 'SuperAdmin',
        role: 'superadmin',
        wardId: null,
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, username: true, fullName: true, department: true, role: true, wardId: true },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================================
// CHANGE OWN PASSWORD
// Super Admin password is managed via .env — cannot be changed here.
// ============================================================
router.post('/change-password', requireAuth, async (req, res) => {
  if (req.user.department === 'SuperAdmin') {
    return res.status(403).json({
      error: 'Super Admin password is managed in server configuration',
    });
  }

  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current and new passwords required' });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters' });
  }

  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });

    const hash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash: hash } });

    res.json({ message: 'Password updated successfully' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================================
// IT or Super Admin only - Create user
// ============================================================
router.post('/admin/create-user', requireAuth, async (req, res) => {
  if (!isITOrSuperAdmin(req)) {
    return res.status(403).json({ error: 'Only IT can create users' });
  }

  const { username, fullName, department, role } = req.body;
  if (!username || !fullName || !department) {
    return res.status(400).json({ error: 'username, fullName, and department are required' });
  }

  try {
    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing) return res.status(409).json({ error: 'Username already exists' });

    const tempPassword = crypto.randomBytes(4).toString('hex');
    const hash = await bcrypt.hash(tempPassword, 10);
    const user = await prisma.user.create({
      data: { username, passwordHash: hash, fullName, department, role: role || 'staff' },
    });

    res.status(201).json({
      message: 'User created',
      user: {
        id: user.id, username: user.username, fullName: user.fullName,
        department: user.department, role: user.role,
      },
      tempPassword,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================================
// IT or Super Admin only - Reset any user's password
// ============================================================
router.post('/admin/reset-password', requireAuth, async (req, res) => {
  if (!isITOrSuperAdmin(req)) {
    return res.status(403).json({ error: 'Only IT can reset passwords' });
  }

  const { userId, username } = req.body;
  if (!userId && !username) {
    return res.status(400).json({ error: 'userId or username required' });
  }

  try {
    const user = await prisma.user.findFirst({
      where: userId ? { id: parseInt(userId) } : { username },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const tempPassword = crypto.randomBytes(4).toString('hex');
    const hash = await bcrypt.hash(tempPassword, 10);
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash: hash } });

    res.json({
      message: 'Password reset for ' + user.username,
      user: { id: user.id, username: user.username, fullName: user.fullName },
      tempPassword,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================================
// IT or Super Admin only - List all users
// ============================================================
router.get('/admin/users', requireAuth, async (req, res) => {
  if (!isITOrSuperAdmin(req)) {
    return res.status(403).json({ error: 'Only IT can list users' });
  }

  try {
    const users = await prisma.user.findMany({
      select: { id: true, username: true, fullName: true, department: true, role: true, wardId: true },
      orderBy: [{ department: 'asc' }, { username: 'asc' }],
    });
    res.json(users);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================================
// IT or Super Admin only - System status
// ============================================================
router.get('/system-status', requireAuth, async (req, res) => {
  if (!isITOrSuperAdmin(req)) {
    return res.status(403).json({ error: 'Only IT can view system status' });
  }

  try {
    const totalUsers = await prisma.user.count();
    const byDept = await prisma.user.groupBy({ by: ['department'], _count: true });
    res.json({
      totalUsers,
      byDepartment: byDept.map(d => ({ department: d.department, count: d._count })),
      dbConnected: true,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
const express = require('express');
const prisma = require('../prismaClient');
const { requireAuth, isSuperAdmin } = require('../auth');

const router = express.Router();

// ============================================================
// PUBLIC - Get display settings (name, subtitle, contact)
// Anyone (including the Live Board) can read these.
// ============================================================
router.get('/public', async (req, res) => {
  try {
    const rows = await prisma.systemSettings.findMany();
    const map = {};
    rows.forEach(r => { map[r.key] = r.value; });
    res.json({
      hospitalName: map.hospital_name || 'Hospital',
      hospitalSubtitle: map.hospital_subtitle || 'Department Dashboard',
      contactPhone: map.contact_phone || '',
      contactAddress: map.contact_address || '',
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================================
// SUPER ADMIN - Get all settings
// ============================================================
router.get('/admin', requireAuth, async (req, res) => {
  if (!isSuperAdmin(req)) {
    return res.status(403).json({ error: 'Super Admin access required' });
  }

  try {
    const rows = await prisma.systemSettings.findMany();
    const map = {};
    rows.forEach(r => { map[r.key] = r.value; });
    res.json(map);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================================
// SUPER ADMIN - Update settings
// ============================================================
router.put('/admin', requireAuth, async (req, res) => {
  if (!isSuperAdmin(req)) {
    return res.status(403).json({ error: 'Super Admin access required' });
  }

  const { hospital_name, hospital_subtitle, contact_phone, contact_address } = req.body;

  const updates = [
    { key: 'hospital_name', value: hospital_name },
    { key: 'hospital_subtitle', value: hospital_subtitle },
    { key: 'contact_phone', value: contact_phone },
    { key: 'contact_address', value: contact_address },
  ].filter(u => typeof u.value === 'string');

  try {
    for (const u of updates) {
      await prisma.systemSettings.upsert({
        where: { key: u.key },
        update: { value: u.value },
        create: u,
      });
    }

    res.json({ message: 'Settings updated' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
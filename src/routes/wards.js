const express = require('express');
const prisma = require('../prismaClient');
const { requireAuth } = require('../auth');

const router = express.Router();

router.get('/', requireAuth, async (req, res) => {
  try {
    const wards = await prisma.ward.findMany({ orderBy: { name: 'asc' } });
    res.json(wards);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
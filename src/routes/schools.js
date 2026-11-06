const express = require('express');
const prisma = require('../prismaClient');
const { requireAuth } = require('../auth');

const router = express.Router();

function requireSchools(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  const dept = String(req.user.department || '').toLowerCase();
  const allowed = ['school of nursing', 'school of midwifery', 'it', 'superadmin'];
  if (!allowed.includes(dept)) {
    return res.status(403).json({ error: 'Not authorized' });
  }
  next();
}

function schoolFromDept(dept) {
  const d = String(dept || '').toLowerCase();
  if (d.includes('nursing')) return 'Nursing';
  if (d.includes('midwifery')) return 'Midwifery';
  return null;
}

// ============================================================
// STUDENTS
// ============================================================
router.get('/students', requireAuth, requireSchools, async (req, res) => {
  try {
    const school = schoolFromDept(req.user.department) || req.query.school;
    if (!school) return res.status(400).json({ error: 'School not determined' });
    
    const { search, status } = req.query;
    const where = { school };
    if (status && status !== 'all') where.status = status;
    
    let students = await prisma.schoolStudent.findMany({
      where,
      orderBy: { name: 'asc' }
    });
    
    if (search) {
      const q = search.toLowerCase();
      students = students.filter(s => 
        String(s.name).toLowerCase().includes(q) ||
        String(s.studentNumber).toLowerCase().includes(q) ||
        String(s.currentWard || '').toLowerCase().includes(q)
      );
    }
    
    res.json(students);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/students', requireAuth, requireSchools, async (req, res) => {
  const school = schoolFromDept(req.user.department);
  if (!school) return res.status(400).json({ error: 'School not determined' });
  
  const { name, intakeYear, currentClass, currentWard } = req.body;
  if (!name || !intakeYear || !currentClass) {
    return res.status(400).json({ error: 'Name, intake year, and class are required' });
  }
  
  try {
    const prefix = school === 'Nursing' ? 'SON' : 'SOM';
    const count = await prisma.schoolStudent.count({ where: { school } });
    const studentNumber = prefix + '-' + intakeYear + '-' + String(count + 1).padStart(4, '0');
    
    const student = await prisma.schoolStudent.create({
      data: {
        name,
        studentNumber,
        school,
        intakeYear: parseInt(intakeYear),
        currentClass,
        currentWard: currentWard || null,
        status: 'active'
      }
    });
    
    req.app.locals.emit('schools:updated', { id: student.id });
    res.status(201).json(student);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.patch('/students/:id/status', requireAuth, requireSchools, async (req, res) => {
  const { status } = req.body;
  try {
    const updated = await prisma.schoolStudent.update({
      where: { id: parseInt(req.params.id) },
      data: { status }
    });
    req.app.locals.emit('schools:updated', { id: updated.id });
    res.json(updated);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.patch('/students/:id/ward', requireAuth, requireSchools, async (req, res) => {
  const { ward } = req.body;
  try {
    const updated = await prisma.schoolStudent.update({
      where: { id: parseInt(req.params.id) },
      data: { currentWard: ward || null }
    });
    req.app.locals.emit('schools:updated', { id: updated.id });
    res.json(updated);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============================================================
// SCHEDULE
// ============================================================
router.get('/schedule', requireAuth, requireSchools, async (req, res) => {
  try {
    const school = schoolFromDept(req.user.department) || req.query.school;
    if (!school) return res.status(400).json({ error: 'School not determined' });
    
    const schedule = await prisma.classSchedule.findMany({
      where: { school },
      orderBy: { startTime: 'asc' }
    });
    res.json(schedule);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/schedule', requireAuth, requireSchools, async (req, res) => {
  const school = schoolFromDept(req.user.department);
  if (!school) return res.status(400).json({ error: 'School not determined' });
  
  const { title, tutor, location, dayOfWeek, startTime, endTime } = req.body;
  if (!title || !tutor || !dayOfWeek || !startTime || !endTime) {
    return res.status(400).json({ error: 'All fields required' });
  }
  
  try {
    const entry = await prisma.classSchedule.create({
      data: { school, title, tutor, location: location || 'TBA', dayOfWeek, startTime, endTime }
    });
    req.app.locals.emit('schools:updated', { id: entry.id });
    res.status(201).json(entry);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/schedule/:id', requireAuth, requireSchools, async (req, res) => {
  try {
    await prisma.classSchedule.delete({ where: { id: parseInt(req.params.id) } });
    req.app.locals.emit('schools:updated', { id: req.params.id });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
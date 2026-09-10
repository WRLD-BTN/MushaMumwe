const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Clear existing data
  await prisma.employeeStatusLog.deleteMany();
  await prisma.statusLog.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.patient.deleteMany();
  await prisma.user.deleteMany();
  await prisma.ward.deleteMany();

  // Create wards
  const wards = await Promise.all([
    prisma.ward.create({ data: { name: 'Ward A', capacity: 20 } }),
    prisma.ward.create({ data: { name: 'Ward B', capacity: 20 } }),
    prisma.ward.create({ data: { name: 'ICU', capacity: 10 } }),
    prisma.ward.create({ data: { name: 'Maternity', capacity: 15 } }),
    prisma.ward.create({ data: { name: 'Surgical', capacity: 18 } }),
    prisma.ward.create({ data: { name: 'Paediatrics', capacity: 12 } }),
  ]);

  // Create users
  const users = [
    { username: 'nurse1', password: 'nurse123', fullName: 'Sister Mutsa', department: 'Nurses', role: 'staff', wardId: wards[0].id },
    { username: 'nurse2', password: 'nurse123', fullName: 'Nurse Chipo', department: 'Nurses', role: 'staff', wardId: wards[1].id },
    { username: 'it1', password: 'it123', fullName: 'IT Manager - Tapiwa', department: 'IT', role: 'admin', wardId: null },
    { username: 'procurement1', password: 'proc123', fullName: 'Procurement Officer - Simba', department: 'Procurement', role: 'staff', wardId: null },
    { username: 'stores1', password: 'store123', fullName: 'Store Manager - Thabo', department: 'Stores', role: 'staff', wardId: null },
    { username: 'hr1', password: 'hr123', fullName: 'HR Manager - Lerato', department: 'HR', role: 'staff', wardId: null },
  ];

  for (const u of users) {
    const passwordHash = await bcrypt.hash(u.password, 10);
    await prisma.user.upsert({
      where: { username: u.username },
      update: {},
      create: {
        username: u.username,
        passwordHash,
        fullName: u.fullName,
        department: u.department,
        role: u.role,
        wardId: u.wardId,
      },
    });
    console.log(`✓ ${u.department}: ${u.username}`);
  }

  // Create test employees
  const employees = [
    { name: 'Dr. James Mwale', department: 'Medical', wardId: wards[0].id, status: 'active' },
    { name: 'Dr. Susan Banda', department: 'Medical', wardId: wards[2].id, status: 'active' },
    { name: 'Sr. Mutsa Mavhura', department: 'Nurses', wardId: wards[0].id, status: 'active' },
    { name: 'Nurse Chipo Ngwenya', department: 'Nurses', wardId: wards[1].id, status: 'active' },
    { name: 'Nurse Rose Dlamini', department: 'Nurses', wardId: wards[0].id, status: 'on_leave' },
    { name: 'Pharm. Tendai Chirenje', department: 'Pharmacy', wardId: null, status: 'active' },
    { name: 'Lab Tech - Moses Kanyemba', department: 'Laboratory', wardId: null, status: 'active' },
    { name: 'Receptionist - Linda Ndaba', department: 'Admin', wardId: null, status: 'active' },
    { name: 'Cleaner - John Mutasa', department: 'Support', wardId: null, status: 'sick' },
    { name: 'Maintenance - Paul Mhlanga', department: 'Support', wardId: null, status: 'active' },
  ];

  for (const emp of employees) {
    await prisma.employee.create({
      data: {
        name: emp.name,
        department: emp.department,
        wardId: emp.wardId,
        status: emp.status,
        hireDate: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000),
      },
    });
  }
  console.log(`✓ Created ${employees.length} test employees`);

  // Create test patients
  const patients = [
    { name: 'T. Moyo', gender: 'M', wardId: wards[0].id, status: 'admitted' },
    { name: 'R. Chikafu', gender: 'F', wardId: wards[1].id, status: 'admitted' },
    { name: 'S. Ndlovu', gender: 'M', wardId: wards[2].id, status: 'in_treatment' },
    { name: 'P. Gwenzi', gender: 'F', wardId: wards[3].id, status: 'in_treatment' },
    { name: 'L. Mabika', gender: 'M', wardId: wards[4].id, status: 'discharged' },
    { name: 'M. Dlamini', gender: 'F', wardId: wards[0].id, status: 'admitted' },
  ];

  for (const p of patients) {
    await prisma.patient.create({
      data: {
        name: p.name,
        gender: p.gender,
        wardId: p.wardId,
        status: p.status,
      },
    });
  }
  console.log(`✓ Created ${patients.length} test patients`);
  console.log('✅ Database seeded successfully!');
}

main()
  .catch(e => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
// Run with: node prisma/seed.js
// Creates one test user per department AND dummy wards/patients so you have
// real data to look at immediately, without needing a real hospital DB.

const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

const wardNames = ["Ward A", "Ward B", "ICU", "Maternity", "Surgical", "Paediatrics"];
const patientNames = [
  "T. Moyo", "R. Chikafu", "S. Ndlovu", "P. Gwenzi", "L. Mabika",
  "F. Chirwa", "N. Sithole", "D. Museva", "C. Banda", "A. Marufu"
];
const statuses = ["admitted", "treatment", "discharged", "deceased"];

async function seedUsers() {
  const users = [
    { username: "nurse1", password: "nurse123", fullName: "Nurse — Ward A", department: "nurses", role: "staff", wardId: 1 },
    { username: "records1", password: "records123", fullName: "Records Clerk", department: "records", role: "staff" },
    { username: "accounts1", password: "accounts123", fullName: "Accounts Officer", department: "accounts", role: "staff" },
    { username: "it1", password: "it123", fullName: "IT Administrator", department: "it", role: "admin" },
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
        wardId: u.wardId || null,
      },
    });
    console.log(`Seeded user ${u.username} (${u.department}) — password: ${u.password}`);
  }
}

async function seedWardsAndPatients() {
  const wards = [];
  for (const name of wardNames) {
    const ward = await prisma.ward.create({ data: { name, capacity: 20 } });
    wards.push(ward);
  }

  for (let i = 0; i < patientNames.length; i++) {
    const status = statuses[i % statuses.length];
    const ward = wards[i % wards.length];
    const patient = await prisma.patient.create({
      data: { name: patientNames[i], wardId: ward.id, status },
    });
    await prisma.statusLog.create({
      data: {
        patientId: patient.id,
        oldStatus: "—",
        newStatus: status,
        changedBy: "seed-script",
      },
    });
  }
  console.log(`Seeded ${wards.length} wards and ${patientNames.length} patients.`);
}

async function main() {
  await seedUsers();
  await seedWardsAndPatients();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

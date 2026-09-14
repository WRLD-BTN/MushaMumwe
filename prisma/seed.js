const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  try {
    // Clear all tables in correct order (respecting foreign keys)
    console.log('Clearing data...');
    
    // Delete in order of dependencies
    await prisma.itemReceive.deleteMany();
    await prisma.procurementOrder.deleteMany();
    await prisma.orderRequestStatusLog.deleteMany();
    await prisma.orderRequest.deleteMany();
    await prisma.inventoryItem.deleteMany();
    await prisma.statusLog.deleteMany();
    await prisma.employeeStatusLog.deleteMany();
    await prisma.patient.deleteMany();
    await prisma.employee.deleteMany();
    await prisma.user.deleteMany();
    await prisma.ward.deleteMany();

    console.log('Creating wards...');
    // Create wards
    const wards = await Promise.all([
      prisma.ward.create({ data: { name: 'Ward A', capacity: 20 } }),
      prisma.ward.create({ data: { name: 'Ward B', capacity: 20 } }),
      prisma.ward.create({ data: { name: 'ICU', capacity: 10 } }),
      prisma.ward.create({ data: { name: 'Maternity', capacity: 15 } }),
      prisma.ward.create({ data: { name: 'Surgical', capacity: 18 } }),
      prisma.ward.create({ data: { name: 'Paediatrics', capacity: 12 } }),
    ]);
    console.log(`  Created ${wards.length} wards`);

    console.log('Creating users...');
    // Create users
    const users = [
      { username: 'nurse1', password: 'nurse123', fullName: 'Sister Mutsa', department: 'Nurses', role: 'staff', wardId: wards[0].id },
      { username: 'nurse2', password: 'nurse123', fullName: 'Nurse Tatenda', department: 'Nurses', role: 'staff', wardId: wards[1].id },
      { username: 'it1', password: 'it123', fullName: 'IT Manager', department: 'IT', role: 'admin', wardId: null },
      { username: 'procurement1', password: 'proc123', fullName: 'Procurement Officer', department: 'Procurement', role: 'staff', wardId: null },
      { username: 'stores1', password: 'store123', fullName: 'Store Manager', department: 'Stores', role: 'staff', wardId: null },
      { username: 'hr1', password: 'hr123', fullName: 'HR Manager', department: 'HR', role: 'staff', wardId: null },
    ];

    for (const u of users) {
      const hash = await bcrypt.hash(u.password, 10);
      await prisma.user.create({
        data: { 
          username: u.username, 
          passwordHash: hash, 
          fullName: u.fullName, 
          department: u.department, 
          role: u.role, 
          wardId: u.wardId 
        },
      });
      console.log(`  ${u.department}: ${u.username} / ${u.password}`);
    }

    console.log('Creating employees...');
    // Create employees
    const employees = [
      { name: 'Dr. James Mwale', department: 'Medical', wardId: wards[0].id, status: 'active' },
      { name: 'Dr. Sarah Chen', department: 'Medical', wardId: wards[2].id, status: 'active' },
      { name: 'Nurse Rose Moyo', department: 'Nurses', wardId: wards[0].id, status: 'active' },
      { name: 'Nurse John Dube', department: 'Nurses', wardId: wards[1].id, status: 'active' },
      { name: 'Nurse Mary Ncube', department: 'Nurses', wardId: wards[3].id, status: 'on_leave' },
      { name: 'Dr. Peter Sibanda', department: 'Medical', wardId: wards[4].id, status: 'active' },
      { name: 'Pharmacist Lisa', department: 'Pharmacy', wardId: null, status: 'active' },
      { name: 'Lab Tech Tom', department: 'Laboratory', wardId: null, status: 'active' },
      { name: 'Admin Clerk Jane', department: 'Admin', wardId: null, status: 'active' },
      { name: 'Cleaner Mike', department: 'Support', wardId: wards[0].id, status: 'sick' },
      { name: 'Maintenance Bob', department: 'Maintenance', wardId: null, status: 'active' },
      { name: 'Security Guard Sam', department: 'Security', wardId: null, status: 'active' },
    ];

    for (const emp of employees) {
      await prisma.employee.create({
        data: { 
          name: emp.name, 
          department: emp.department, 
          wardId: emp.wardId, 
          status: emp.status, 
          hireDate: new Date() 
        },
      });
    }
    console.log(`  Created ${employees.length} employees`);

    console.log('Creating patients...');
    // Create patients
    const patients = [
      { name: 'Tendai Moyo', gender: 'M', nationalId: '63-1234567-A12', wardId: wards[0].id, status: 'admitted' },
      { name: 'Rudo Chikafu', gender: 'F', nationalId: '63-7654321-B45', wardId: wards[1].id, status: 'admitted' },
      { name: 'Blessing Ndlovu', gender: 'M', nationalId: '63-9876543-C78', wardId: wards[2].id, status: 'in_treatment' },
      { name: 'Chipo Mutasa', gender: 'F', nationalId: '63-4567890-D90', wardId: wards[3].id, status: 'admitted' },
      { name: 'Farai Zhou', gender: 'M', nationalId: '63-1122334-E11', wardId: wards[4].id, status: 'in_treatment' },
      { name: 'Nyasha Gumbo', gender: 'F', nationalId: '63-5566778-F22', wardId: wards[5].id, status: 'admitted' },
      { name: 'Tapiwa Mhaka', gender: 'M', nationalId: '63-9988776-G33', wardId: wards[0].id, status: 'discharged' },
      { name: 'Sekai Dube', gender: 'F', nationalId: '63-4433221-H44', wardId: wards[1].id, status: 'discharged' },
      { name: 'Munashe Chitongo', gender: 'M', nationalId: '63-8877665-I55', wardId: null, status: 'deceased' },
      { name: 'Precious Nkomo', gender: 'F', nationalId: '63-3322114-J66', wardId: wards[2].id, status: 'in_treatment' },
    ];

    for (const p of patients) {
      await prisma.patient.create({
        data: { 
          name: p.name, 
          gender: p.gender, 
          nationalId: p.nationalId,
          wardId: p.wardId, 
          status: p.status, 
          admissionDate: new Date() 
        },
      });
    }
    console.log(`  Created ${patients.length} patients`);

    console.log('Creating inventory items...');
    // Create inventory items
    const inventoryItems = [
      { name: 'Medical Gloves (Box)', quantity: 150, unit: 'boxes' },
      { name: 'Surgical Masks (Box)', quantity: 200, unit: 'boxes' },
      { name: 'Syringes 5ml (Pack)', quantity: 80, unit: 'packs' },
      { name: 'Bandages (Roll)', quantity: 45, unit: 'rolls' },
      { name: 'IV Drip Sets', quantity: 60, unit: 'sets' },
      { name: 'Antiseptic Solution (L)', quantity: 25, unit: 'liters' },
      { name: 'Paracetamol 500mg (Box)', quantity: 120, unit: 'boxes' },
      { name: 'Antibiotics (Box)', quantity: 35, unit: 'boxes' },
      { name: 'Thermometers', quantity: 8, unit: 'pieces' },
      { name: 'Wheelchairs', quantity: 5, unit: 'pieces' },
    ];

    for (const item of inventoryItems) {
      await prisma.inventoryItem.create({
        data: { 
          name: item.name, 
          quantity: item.quantity, 
          unit: item.unit,
          lastReceived: new Date()
        },
      });
    }
    console.log(`  Created ${inventoryItems.length} inventory items`);

    console.log('Creating order requests...');
    // Create sample order requests
    const orderRequests = [
      {
        requestingDepartment: 'Nurses',
        requestingBy: 'Sister Mutsa',
        itemName: 'Medical Gloves (Box)',
        quantity: 50,
        reason: 'Running low on stock',
        status: 'pending'
      },
      {
        requestingDepartment: 'Nurses',
        requestingBy: 'Nurse Tatenda',
        itemName: 'Surgical Masks (Box)',
        quantity: 100,
        reason: 'Monthly restock',
        status: 'approved'
      },
      {
        requestingDepartment: 'Medical',
        requestingBy: 'Dr. James Mwale',
        itemName: 'Syringes 5ml (Pack)',
        quantity: 30,
        reason: 'Increased patient intake',
        status: 'pending'
      },
      {
        requestingDepartment: 'Pharmacy',
        requestingBy: 'Pharmacist Lisa',
        itemName: 'Antibiotics (Box)',
        quantity: 20,
        reason: 'Low stock',
        status: 'ordered'
      },
    ];

    for (const order of orderRequests) {
      await prisma.orderRequest.create({
        data: order
      });
    }
    console.log(`  Created ${orderRequests.length} order requests`);

    console.log('\nDatabase seeded successfully!');
    console.log('\nTest Credentials:');
    console.log('  Nurses: nurse1 / nurse123');
    console.log('  Nurses: nurse2 / nurse123');
    console.log('  IT: it1 / it123');
    console.log('  Procurement: procurement1 / proc123');
    console.log('  Stores: stores1 / store123');
    console.log('  HR: hr1 / hr123');
    console.log('');
  } catch (e) {
    console.error('\nError:', e.message);
    console.error(e);
    process.exit(1);
  }
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  });
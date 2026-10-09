// ============================================================
// Full seed script
// Creates: wards, users, 1000 patients, 1000 employees,
//          inventory, tenders, 60 disciplinary cases
// Run with: npm run seed
// ============================================================

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

// ============================================================
// DATA POOLS
// ============================================================

const FIRST_NAMES_M = [
  'Tendai', 'Farai', 'Tapiwa', 'Munashe', 'Blessing', 'Tatenda', 'Simba',
  'Kudakwashe', 'Panashe', 'Takudzwa', 'Nyasha', 'Tinashe', 'Rufaro', 'Tafara',
  'Prosper', 'Knowledge', 'Prince', 'Wellington', 'Tichaona', 'Marshall',
  'Brighton', 'Lovemore', 'Never', 'Gift', 'Praise', 'Wisdom', 'Takunda',
  'Tanaka', 'Tanatswa', 'Tawananyasha', 'Tirivashe', 'Tonderai',
  'Tongai', 'Tungamirai', 'Vusumuzi', 'Zvikomborero', 'Simbarashe',
  'Shingirai', 'Shadreck', 'Ropafadzo', 'Nokutenda', 'Ngonidzashe',
  'Munyaradzi', 'Mthokozisi', 'Mqondisi', 'Luckson', 'Kudzanai',
];

const FIRST_NAMES_F = [
  'Rudo', 'Chipo', 'Nyasha', 'Tariro', 'Rumbidzai', 'Vimbai', 'Rutendo',
  'Fadzai', 'Nyaradzo', 'Tanyaradzwa', 'Anesu', 'Chiedza', 'Danai', 'Kudzai',
  'Precious', 'Memory', 'Grace', 'Faith', 'Hope', 'Patience', 'Mercy',
  'Charity', 'Beauty', 'Praise', 'Joy', 'Tafadzwa',
  'Tendai', 'Thandiwe', 'Thandeka', 'Sibongile', 'Sithembile',
  'Priscilla', 'Nyari', 'Nyarai',
  'Nomatter', 'Nomsa', 'Nokuthula', 'Nobuhle', 'Melody', 'Loveness',
  'Kundai', 'Gamuchirai', 'Fungai', 'Constance',
];

const SURNAMES = [
  'Moyo', 'Ncube', 'Dube', 'Sibanda', 'Mhlanga', 'Ndlovu', 'Chikafu', 'Mutasa',
  'Zhou', 'Gumbo', 'Mhaka', 'Chitongo', 'Nkomo', 'Muzenda', 'Mugabe', 'Chinamasa',
  'Makoni', 'Nyoni', 'Tsvangirai', 'Chamisa', 'Mwonzora', 'Khupe', 'Biti',
  'Chiwenga', 'Mnangagwa', 'Mavima', 'Marapira', 'Muswere', 'Mangwana',
  'Chigumba', 'Rusere', 'Sanyatwe', 'Kazembe', 'Murambinda', 'Nyathi',
  'Chikwanha', 'Mutinhiri', 'Mabuwa', 'Muronzi', 'Chimene', 'Madziva',
  'Mudzuri', 'Chibaya', 'Mliswa', 'Matemadanda', 'Ndebele',
  'Dlodlo', 'Mabuza', 'Ziyambi', 'Musabayana', 'Mhona',
];

const DIAGNOSES = [
  'Malaria', 'Severe malaria', 'Cerebral malaria', 'Typhoid fever',
  'Pneumonia', 'Bronchopneumonia', 'Tuberculosis', 'HIV-related illness',
  'Gastroenteritis', 'Cholera', 'Diarrhoea', 'Dehydration',
  'Hypertension', 'Diabetes mellitus type 2', 'Diabetic ketoacidosis',
  'Anaemia', 'Severe anaemia', 'Meningitis', 'Sepsis', 'Puerperal sepsis',
  'Pre-eclampsia', 'Eclampsia', 'Postpartum haemorrhage',
  'Obstructed labour', 'Malnutrition', 'Kwashiorkor', 'Marasmus',
  'Appendicitis', 'Intestinal obstruction', 'Fracture femur', 'Head injury',
  'Road traffic accident', 'Snake bite', 'Poisoning', 'Burns',
  'Asthma exacerbation', 'Heart failure', 'Stroke', 'Epilepsy', 'Renal failure',
];

const SYMPTOMS = [
  'Fever, chills, headache', 'Cough, difficulty breathing', 'Chest pain',
  'Abdominal pain, vomiting', 'Diarrhoea, dehydration', 'Weakness, fatigue',
  'Dizziness, fainting', 'Severe headache, neck stiffness', 'Convulsions',
  'Bleeding', 'Unconscious', 'Jaundice', 'Rash', 'Swelling',
];

const OUTCOMES = ['Recovered', 'Improved', 'Referred', 'Absconded'];

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

const REVIEW_DEPARTMENTS = ['Outpatient', 'Nurses', 'Medical', 'Pharmacy', 'Laboratory'];

const EMPLOYEE_DEPARTMENTS = [
  'Medical', 'Nurses', 'Pharmacy', 'Laboratory', 'Admin',
  'Support', 'Maintenance', 'Security',
];

const ROLES_BY_DEPT = {
  Medical: ['Doctor', 'Consultant', 'Medical Officer', 'Intern'],
  Nurses: ['Registered Nurse', 'Enrolled Nurse', 'Nurse Aide', 'Sister', 'Matron'],
  Pharmacy: ['Pharmacist', 'Pharmacy Technician', 'Pharmacy Assistant'],
  Laboratory: ['Lab Scientist', 'Lab Technician', 'Lab Assistant'],
  Admin: ['Clerk', 'Administrator', 'Receptionist', 'Data Entry Officer'],
  Support: ['Cleaner', 'Porter', 'Laundry Staff', 'Catering'],
  Maintenance: ['Technician', 'Electrician', 'Plumber', 'Handyman'],
  Security: ['Guard', 'Security Officer', 'Gate Officer'],
};

function pickEmployeeStatus() {
  const r = Math.random();
  if (r < 0.85) return 'active';
  if (r < 0.93) return 'on_leave';
  if (r < 0.97) return 'sick';
  return 'terminated';
}

// ============================================================
// DISCIPLINARY POOLS
// ============================================================

const DISCIPLINARY_OFFENSES = [
  'Absenteeism', 'Late arrival', 'Insubordination', 'Negligence', 'Misconduct',
  'Theft', 'Substance abuse', 'Harassment', 'Patient mistreatment',
  'Breach of confidentiality', 'Falsification of records', 'Other',
];

const DISCIPLINARY_DESCRIPTIONS = {
  'Absenteeism': [
    'Failed to report for shift on three consecutive days without notification.',
    'Absent from duty without approved leave for two days.',
    'Repeated unexcused absences documented over the past month.',
  ],
  'Late arrival': [
    'Arrived 90 minutes after scheduled start without notifying supervisor.',
    'Chronic lateness reported by shift supervisor over two weeks.',
    'Late for three consecutive morning handovers.',
  ],
  'Insubordination': [
    'Refused to follow supervisor instructions during ward round.',
    'Openly argued with senior nurse in front of patients.',
    'Failed to comply with departmental procedure.',
  ],
  'Negligence': [
    'Failed to record patient vitals for an entire shift.',
    'Did not administer prescribed medication at the scheduled time.',
    'Left patient unattended in restricted area.',
  ],
  'Misconduct': [
    'Used hospital equipment for personal purposes.',
    'Inappropriate conduct toward a colleague during working hours.',
    'Violated uniform and hygiene policy after prior warnings.',
  ],
  'Theft': [
    'Removed hospital supplies without authorisation.',
    'Reported for taking medication from the pharmacy store.',
    'Alleged theft of a colleague personal belongings.',
  ],
  'Substance abuse': [
    'Reported to duty under the influence of alcohol.',
    'Suspected substance use during shift, referred for testing.',
    'Positive breathalyser test at facility entrance.',
  ],
  'Harassment': [
    'Repeated unwanted comments toward a colleague.',
    'Reported for inappropriate messaging outside working hours.',
    'Verbal harassment complaint filed by junior staff.',
  ],
  'Patient mistreatment': [
    'Rough handling of a patient reported by another staff member.',
    'Patient complaint regarding verbal abuse during procedure.',
    'Inappropriate response to a patient request, witnessed by relative.',
  ],
  'Breach of confidentiality': [
    'Shared patient information with unauthorised third party.',
    'Posted patient details on social media.',
    'Discussed a patient case outside the clinical setting.',
  ],
  'Falsification of records': [
    'Recorded vitals that were not actually taken.',
    'Altered a shift log after the fact.',
    'Signed for another staff member duties.',
  ],
  'Other': [
    'Repeated failure to follow infection control procedures.',
    'Brought unauthorised persons into restricted areas.',
    'Refused mandatory training without valid reason.',
  ],
};

const DISCIPLINARY_OUTCOMES = [
  'Employee acknowledged the offense and received formal warning.',
  'Employee disputed the finding; case referred for arbitration.',
  'Employee accepted responsibility; case closed with corrective action.',
  'Committee recommended formal disciplinary action.',
  'Matter resolved through counselling and monitoring.',
];

const DISCIPLINARY_WITNESSES = [
  'Sister Mutsa, Nurse Tatenda',
  'Dr. Mwale',
  'Ward Supervisor',
  'Senior Nurse on duty',
  'Two colleagues on shift',
  null,
];

function pickDisciplinaryStatus(dayAge) {
  const r = Math.random();
  if (dayAge <= 7) {
    if (r < 0.6) return 'open';
    if (r < 0.9) return 'under_investigation';
    return 'resolved';
  }
  if (dayAge <= 30) {
    if (r < 0.2) return 'open';
    if (r < 0.55) return 'under_investigation';
    if (r < 0.9) return 'resolved';
    return 'dismissed';
  }
  if (r < 0.75) return 'resolved';
  if (r < 0.95) return 'dismissed';
  return 'under_investigation';
}

function pickDisciplinaryAction(status) {
  if (status === 'resolved') {
    return pick(['Verbal warning', 'Written warning', 'Final written warning', 'Suspension', 'Demotion', 'Termination', 'Counselling']);
  }
  if (status === 'dismissed') {
    return pick(['No action', 'Counselling']);
  }
  return null;
}

// ============================================================
// HELPERS
// ============================================================

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomDateWithinDays(daysAgo, hourStart = 6, hourEnd = 22) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  const hours = hourStart + Math.floor(Math.random() * (hourEnd - hourStart));
  const minutes = Math.floor(Math.random() * 60);
  const seconds = Math.floor(Math.random() * 60);
  d.setHours(hours, minutes, seconds, 0);
  return d;
}

function generateNationalId() {
  const part1 = String(Math.floor(10 + Math.random() * 90));
  const part2 = String(Math.floor(1000000 + Math.random() * 9000000));
  const part3 = String.fromCharCode(65 + Math.floor(Math.random() * 26));
  const part4 = String(Math.floor(10 + Math.random() * 90));
  return part1 + '-' + part2 + '-' + part3 + part4;
}

function pickPatientStatus(dayAge) {
  const r = Math.random();
  if (dayAge <= 7) {
    if (r < 0.5) return 'admitted';
    if (r < 0.9) return 'treatment';
    if (r < 0.95) return 'discharged';
    return 'deceased';
  }
  if (dayAge <= 30) {
    if (r < 0.25) return 'admitted';
    if (r < 0.55) return 'treatment';
    if (r < 0.92) return 'discharged';
    return 'deceased';
  }
  if (dayAge <= 60) {
    if (r < 0.1) return 'treatment';
    if (r < 0.92) return 'discharged';
    return 'deceased';
  }
  if (r < 0.9) return 'discharged';
  return 'deceased';
}

// ============================================================
// MAIN
// ============================================================

async function main() {
  console.log('Seeding database...');
  console.log('');

  try {
    // ---------- Clear all tables (order matters) ----------
    console.log('Clearing existing data...');
    await prisma.disciplinaryAttachment.deleteMany();
    await prisma.disciplinaryStatusLog.deleteMany();
    await prisma.disciplinaryCase.deleteMany();

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

    // ---------- Wards ----------
    console.log('Creating wards...');
    const wards = await Promise.all([
      prisma.ward.create({ data: { name: 'Ward A', capacity: 20 } }),
      prisma.ward.create({ data: { name: 'Ward B', capacity: 20 } }),
      prisma.ward.create({ data: { name: 'ICU', capacity: 10 } }),
      prisma.ward.create({ data: { name: 'Maternity', capacity: 15 } }),
      prisma.ward.create({ data: { name: 'Surgical', capacity: 18 } }),
      prisma.ward.create({ data: { name: 'Paediatrics', capacity: 12 } }),
    ]);
    console.log('  Created ' + wards.length + ' wards');

    // ---------- Users ----------
    console.log('Creating users...');
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
          wardId: u.wardId,
        },
      });
    }
    console.log('  Created ' + users.length + ' user accounts');

    // ---------- Employees (1000) ----------
    console.log('Creating 1000 employees...');

    const TOTAL_EMPLOYEES = 1000;
    const EMPLOYEE_DAYS_SPAN = 1825;

    const employeeBatchSize = 100;
    let empCreated = 0;

    for (let i = 0; i < TOTAL_EMPLOYEES; i++) {
      const gender = Math.random() < 0.45 ? 'M' : 'F';
      const firstName = gender === 'M' ? pick(FIRST_NAMES_M) : pick(FIRST_NAMES_F);
      const surname = pick(SURNAMES);
      const name = firstName + ' ' + surname;

      const department = pick(EMPLOYEE_DEPARTMENTS);
      const role = pick(ROLES_BY_DEPT[department]);
      const status = pickEmployeeStatus();

      const hireDaysAgo = Math.floor(Math.random() * EMPLOYEE_DAYS_SPAN);
      const hireDate = randomDateWithinDays(hireDaysAgo, 8, 17);

      const wardAssigned = ['Nurses', 'Medical', 'Support'].includes(department);
      const wardId = wardAssigned && Math.random() < 0.85 ? pick(wards).id : null;

      let terminationDate = null;
      if (status === 'terminated') {
        const daysAfterHire = 30 + Math.floor(Math.random() * Math.min(hireDaysAgo, 1000));
        const tDate = new Date(hireDate);
        tDate.setDate(tDate.getDate() + daysAfterHire);
        if (tDate <= new Date()) terminationDate = tDate;
      }

      try {
        const employee = await prisma.employee.create({
          data: {
            name,
            department,
            role,
            wardId,
            status,
            hireDate,
            terminationDate,
          },
        });

        await prisma.employeeStatusLog.create({
          data: {
            employeeId: employee.id,
            oldStatus: 'new',
            newStatus: status,
            changedBy: 'Seed Script',
          },
        });

        empCreated++;
        if (empCreated % employeeBatchSize === 0) {
          console.log('  ' + empCreated + ' / ' + TOTAL_EMPLOYEES + ' employees created');
        }
      } catch (e) {
        console.error('  Skipped one employee:', e.message);
      }
    }
    console.log('  Employees created: ' + empCreated);

    // ---------- Patients (1000) ----------
    console.log('Creating 1000 patients...');

    const TOTAL_PATIENTS = 1000;
    const PATIENT_DAYS_SPAN = 90;

    const patientBatchSize = 100;
    let patCreated = 0;

    for (let i = 0; i < TOTAL_PATIENTS; i++) {
      const gender = Math.random() < 0.5 ? 'M' : 'F';
      const firstName = gender === 'M' ? pick(FIRST_NAMES_M) : pick(FIRST_NAMES_F);
      const surname = pick(SURNAMES);
      const name = firstName + ' ' + surname;

      const daysAgo = Math.floor(Math.random() * PATIENT_DAYS_SPAN);
      const admissionDate = randomDateWithinDays(daysAgo);
      const status = pickPatientStatus(daysAgo);

      const ward = pick(wards);
      const diagnosis = pick(DIAGNOSES);
      const symptoms = pick(SYMPTOMS);
      const bloodGroup = Math.random() < 0.7 ? pick(BLOOD_GROUPS) : null;

      const phone = Math.random() < 0.8
        ? '+263 7' + Math.floor(1 + Math.random() * 8) + ' ' +
          Math.floor(1000000 + Math.random() * 9000000)
        : null;

      const nationalId = Math.random() < 0.8 ? generateNationalId() : null;

      let dischargeDate = null;
      let finalDiagnosis = null;
      let treatmentSummary = null;
      let outcome = null;
      let dischargeNotes = null;
      let dischargedBy = null;
      let nextReviewDate = null;
      let reviewDepartment = null;
      let patientInstructions = null;

      if (status === 'discharged') {
        const stayDays = 2 + Math.floor(Math.random() * 12);
        const dischargeCandidate = new Date(admissionDate);
        dischargeCandidate.setDate(dischargeCandidate.getDate() + stayDays);

        dischargeDate = dischargeCandidate <= new Date() ? dischargeCandidate : new Date();

        finalDiagnosis = diagnosis;
        treatmentSummary = 'Standard treatment protocol administered. Patient stabilised.';
        outcome = pick(OUTCOMES);
        dischargeNotes = 'Discharged in stable condition. Advised to return if symptoms recur.';
        dischargedBy = pick(['Sister Mutsa', 'Nurse Tatenda']);
        reviewDepartment = pick(REVIEW_DEPARTMENTS);

        if (Math.random() < 0.6) {
          const rv = new Date(dischargeDate);
          rv.setDate(rv.getDate() + 7 + Math.floor(Math.random() * 21));
          nextReviewDate = rv;
        }

        patientInstructions = 'Take medication as prescribed. Rest. Return for review.';
      }

      let causeOfDeath = null;
      if (status === 'deceased') {
        causeOfDeath = diagnosis;
      }

      try {
        const patient = await prisma.patient.create({
          data: {
            name,
            gender,
            nationalId,
            admissionDate,
            wardId: ward.id,
            status,
            diagnosis,
            symptoms,
            phone,
            bloodGroup,
            finalDiagnosis,
            treatmentSummary,
            outcome,
            dischargeDate,
            dischargeNotes,
            dischargedBy,
            nextReviewDate,
            reviewDepartment,
            patientInstructions,
            causeOfDeath,
          },
        });

        await prisma.statusLog.create({
          data: {
            patientId: patient.id,
            oldStatus: 'new',
            newStatus: status,
            changedBy: 'Seed Script',
          },
        });

        patCreated++;
        if (patCreated % patientBatchSize === 0) {
          console.log('  ' + patCreated + ' / ' + TOTAL_PATIENTS + ' patients created');
        }
      } catch (e) {
        console.error('  Skipped one patient:', e.message);
      }
    }
    console.log('  Patients created: ' + patCreated);

    // ---------- Inventory ----------
    console.log('Creating inventory items...');
    const inventoryItems = [
      { name: 'Medical Gloves (Box)', quantity: 150, unit: 'boxes', category: 'PPE' },
      { name: 'Surgical Masks (Box)', quantity: 200, unit: 'boxes', category: 'PPE' },
      { name: 'Syringes 5ml (Pack)', quantity: 80, unit: 'packs', category: 'Consumables' },
      { name: 'Bandages (Roll)', quantity: 45, unit: 'rolls', category: 'Consumables' },
      { name: 'IV Drip Sets', quantity: 60, unit: 'sets', category: 'Consumables' },
      { name: 'Antiseptic Solution (L)', quantity: 25, unit: 'liters', category: 'Consumables' },
      { name: 'Paracetamol 500mg (Box)', quantity: 120, unit: 'boxes', category: 'Pharmaceuticals' },
      { name: 'Antibiotics (Box)', quantity: 35, unit: 'boxes', category: 'Pharmaceuticals' },
      { name: 'Thermometers', quantity: 8, unit: 'pieces', category: 'Equipment' },
      { name: 'Wheelchairs', quantity: 5, unit: 'pieces', category: 'Equipment' },
    ];

    for (const item of inventoryItems) {
      await prisma.inventoryItem.create({
        data: {
          name: item.name,
          quantity: item.quantity,
          unit: item.unit,
          category: item.category,
          lastReceived: new Date(),
        },
      });
    }
    console.log('  Created ' + inventoryItems.length + ' inventory items');

    // ---------- Sample tenders ----------
    console.log('Creating sample tender requests...');
    const orderRequests = [
      {
        requestingDepartment: 'Nurses',
        originatorDepartment: 'Nurses',
        requestingBy: 'Sister Mutsa',
        itemName: 'Medical Gloves (Box)',
        quantity: 50,
        reason: 'Running low on stock',
        status: 'pending',
      },
      {
        requestingDepartment: 'IT',
        originatorDepartment: 'Nurses',
        requestingBy: 'IT Manager',
        itemName: 'Nurse Tablets',
        quantity: 20,
        reason: 'Computerised nurse registry',
        status: 'pending',
      },
      {
        requestingDepartment: 'Nurses',
        originatorDepartment: 'Nurses',
        requestingBy: 'Nurse Tatenda',
        itemName: 'Surgical Masks (Box)',
        quantity: 100,
        reason: 'Monthly restock',
        status: 'ordered',
      },
      {
        requestingDepartment: 'Procurement',
        originatorDepartment: 'Procurement',
        requestingBy: 'Procurement Officer',
        itemName: 'Office Chairs',
        quantity: 10,
        reason: 'Replacing broken furniture',
        status: 'awaiting_quotation',
      },
    ];

    for (const order of orderRequests) {
      await prisma.orderRequest.create({ data: order });
    }
    console.log('  Created ' + orderRequests.length + ' sample tenders');

    // ---------- Disciplinary cases (60) ----------
    console.log('Creating disciplinary cases...');

    const sampleEmployees = await prisma.employee.findMany({
      select: { id: true },
      take: 500,
    });

    if (sampleEmployees.length > 0) {
      const TOTAL_DISCIPLINARY = 60;
      const DISC_DAYS_SPAN = 90;
      const discYear = new Date().getFullYear();
      let discSeq = 1;

      for (let i = 0; i < TOTAL_DISCIPLINARY; i++) {
        const employee = pick(sampleEmployees);
        const offenseType = pick(DISCIPLINARY_OFFENSES);
        const description = pick(DISCIPLINARY_DESCRIPTIONS[offenseType] || DISCIPLINARY_DESCRIPTIONS.Other);

        const daysAgo = Math.floor(Math.random() * DISC_DAYS_SPAN);
        const reportedDate = randomDateWithinDays(daysAgo, 8, 17);
        const status = pickDisciplinaryStatus(daysAgo);
        const actionTaken = pickDisciplinaryAction(status);
        const witnesses = pick(DISCIPLINARY_WITNESSES);

        const caseNumber = 'DISC-' + discYear + '-' + String(discSeq).padStart(4, '0');
        discSeq++;

        let hearingDate = null;
        let hearingNotes = null;
        let effectiveDate = null;
        let durationDays = null;
        let outcome = null;
        let closedBy = null;
        let closedDate = null;

        if (status === 'resolved' || status === 'dismissed') {
          hearingDate = new Date(reportedDate);
          hearingDate.setDate(hearingDate.getDate() + 3 + Math.floor(Math.random() * 10));
          if (hearingDate > new Date()) hearingDate = new Date();

          hearingNotes = 'Panel reviewed the evidence and interviewed all parties.';
          outcome = pick(DISCIPLINARY_OUTCOMES);
          closedBy = 'HR Manager';
          closedDate = new Date(hearingDate);
          closedDate.setDate(closedDate.getDate() + 1 + Math.floor(Math.random() * 5));
          if (closedDate > new Date()) closedDate = new Date();

          if (actionTaken === 'Suspension') {
            effectiveDate = new Date(closedDate);
            durationDays = 3 + Math.floor(Math.random() * 25);
          }
        }

        try {
          const record = await prisma.disciplinaryCase.create({
            data: {
              caseNumber,
              employeeId: employee.id,
              offenseType,
              description,
              reportedBy: pick(['Ward Supervisor', 'Senior Nurse', 'Department Head', 'Shift Coordinator', 'Colleague']),
              reportedDate,
              witnesses,
              status,
              actionTaken,
              actionDetails: actionTaken ? 'Action approved by HR committee.' : null,
              outcome,
              hearingDate,
              hearingNotes,
              effectiveDate,
              durationDays,
              closedBy,
              closedDate,
            },
          });

          await prisma.disciplinaryStatusLog.create({
            data: {
              caseId: record.id,
              oldStatus: 'new',
              newStatus: 'open',
              changedBy: 'System',
              notes: 'Case filed',
            },
          });

          if (status !== 'open') {
            await prisma.disciplinaryStatusLog.create({
              data: {
                caseId: record.id,
                oldStatus: 'open',
                newStatus: status,
                changedBy: 'HR Manager',
                notes: 'Status updated to ' + status,
              },
            });
          }
        } catch (e) {
          console.error('  Skipped one disciplinary case:', e.message);
        }
      }
      console.log('  Created ' + TOTAL_DISCIPLINARY + ' disciplinary cases');
    } else {
      console.log('  Skipped disciplinary cases (no employees found)');
    }

    // ---------- Summary ----------
    console.log('');
    console.log('Database seeded successfully.');
    console.log('');

    const totalPatients = await prisma.patient.count();
    const totalEmployees = await prisma.employee.count();
    const totalUsers = await prisma.user.count();
    const totalCases = await prisma.disciplinaryCase.count();

    console.log('Totals:');
    console.log('  Patients: ' + totalPatients);
    console.log('  Employees: ' + totalEmployees);
    console.log('  Users: ' + totalUsers);
    console.log('  Disciplinary cases: ' + totalCases);
    console.log('');

    const patientStatuses = ['admitted', 'treatment', 'discharged', 'deceased'];
    const pCounts = {};
    for (const s of patientStatuses) {
      pCounts[s] = await prisma.patient.count({ where: { status: s } });
    }
    console.log('Patient status breakdown:');
    patientStatuses.forEach(s => console.log('  ' + s + ': ' + pCounts[s]));
    console.log('');

    const empStatuses = ['active', 'on_leave', 'sick', 'terminated'];
    const eCounts = {};
    for (const s of empStatuses) {
      eCounts[s] = await prisma.employee.count({ where: { status: s } });
    }
    console.log('Employee status breakdown:');
    empStatuses.forEach(s => console.log('  ' + s + ': ' + eCounts[s]));
    console.log('');

    const discStatuses = ['open', 'under_investigation', 'resolved', 'dismissed'];
    const dCounts = {};
    for (const s of discStatuses) {
      dCounts[s] = await prisma.disciplinaryCase.count({ where: { status: s } });
    }
    console.log('Disciplinary status breakdown:');
    discStatuses.forEach(s => console.log('  ' + s + ': ' + dCounts[s]));
    console.log('');

    console.log('Test credentials:');
    console.log('  Nurses:      nurse1 / nurse123');
    console.log('  IT:          it1 / it123');
    console.log('  Procurement: procurement1 / proc123');
    console.log('  Stores:      stores1 / store123');
    console.log('  HR:          hr1 / hr123');
    console.log('  Super Admin: Admin / (your hashed password)');
    console.log('');
  } catch (e) {
    console.error('');
    console.error('Error:', e.message);
    console.error(e);
    process.exit(1);
  }
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  });
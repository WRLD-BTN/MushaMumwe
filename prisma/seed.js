// ============================================================
// COMPREHENSIVE SEED - Sally Mugabe Central Hospital
// Populates all 16 departments with realistic, diverse data
// Designed for the Live Dashboard (trends, alerts, activity)
// Run: npm run seed
// WARNING: Destructive. Wipes all data first.
// ============================================================

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

// ============================================================
// NAME POOLS (Zimbabwean)
// ============================================================
const FIRST_NAMES_M = [
  'Tendai','Farai','Tapiwa','Munashe','Blessing','Tatenda','Simba',
  'Kudakwashe','Panashe','Takudzwa','Nyasha','Tinashe','Rufaro','Tafara',
  'Prosper','Knowledge','Prince','Wellington','Tichaona','Marshall',
  'Brighton','Lovemore','Never','Gift','Praise','Wisdom','Takunda',
  'Tanaka','Tanatswa','Tawananyasha','Tirivashe','Tonderai','Tongai',
  'Tungamirai','Vusumuzi','Zvikomborero','Simbarashe','Shingirai',
  'Shadreck','Ropafadzo','Nokutenda','Ngonidzashe','Munyaradzi',
  'Mthokozisi','Mqondisi','Luckson','Kudzanai',
];

const FIRST_NAMES_F = [
  'Rudo','Chipo','Nyasha','Tariro','Rumbidzai','Vimbai','Rutendo',
  'Fadzai','Nyaradzo','Tanyaradzwa','Anesu','Chiedza','Danai','Kudzai',
  'Precious','Memory','Grace','Faith','Hope','Patience','Mercy',
  'Charity','Beauty','Praise','Joy','Tafadzwa','Tendai','Thandiwe',
  'Thandeka','Sibongile','Sithembile','Priscilla','Nyari','Nyarai',
  'Nomatter','Nomsa','Nokuthula','Nobuhle','Melody','Loveness',
  'Kundai','Gamuchirai','Fungai','Constance',
];

const SURNAMES = [
  'Moyo','Ncube','Dube','Sibanda','Mhlanga','Ndlovu','Chikafu','Mutasa',
  'Zhou','Gumbo','Mhaka','Chitongo','Nkomo','Muzenda','Mugabe','Chinamasa',
  'Makoni','Nyoni','Tsvangirai','Chamisa','Mwonzora','Khupe','Biti',
  'Chiwenga','Mnangagwa','Mavima','Marapira','Muswere','Mangwana',
  'Chigumba','Rusere','Sanyatwe','Kazembe','Murambinda','Nyathi',
  'Chikwanha','Mutinhiri','Mabuwa','Muronzi','Chimene','Madziva',
  'Mudzuri','Chibaya','Mliswa','Matemadanda','Ndebele','Dlodlo',
  'Mabuza','Ziyambi','Musabayana','Mhona',
];

const DIAGNOSES = [
  'Malaria','Severe malaria','Cerebral malaria','Typhoid fever',
  'Pneumonia','Bronchopneumonia','Tuberculosis','HIV-related illness',
  'Gastroenteritis','Cholera','Diarrhoea','Dehydration',
  'Hypertension','Diabetes mellitus type 2','Diabetic ketoacidosis',
  'Anaemia','Severe anaemia','Meningitis','Sepsis','Puerperal sepsis',
  'Pre-eclampsia','Eclampsia','Postpartum haemorrhage',
  'Obstructed labour','Malnutrition','Kwashiorkor','Marasmus',
  'Appendicitis','Intestinal obstruction','Fracture femur','Head injury',
  'Road traffic accident','Snake bite','Poisoning','Burns',
  'Asthma exacerbation','Heart failure','Stroke','Epilepsy','Renal failure',
];

const SYMPTOMS = [
  'Fever, chills, headache','Cough, difficulty breathing','Chest pain',
  'Abdominal pain, vomiting','Diarrhoea, dehydration','Weakness, fatigue',
  'Dizziness, fainting','Severe headache, neck stiffness','Convulsions',
  'Bleeding','Unconscious','Jaundice','Rash','Swelling',
];

const OUTCOMES = ['Recovered','Improved','Referred','Absconded'];
const BLOOD_GROUPS = ['A+','A-','B+','B-','AB+','AB-','O+','O-'];
const REVIEW_DEPARTMENTS = ['Outpatient','Nurses','Medical','Pharmacy','Laboratory'];

// ============================================================
// DEPARTMENTS & ROLES
// ============================================================
const EMPLOYEE_DEPARTMENTS = [
  'Medical','Nurses','Mortuary','School of Nursing','School of Midwifery',
  'Biomedical Equipment','Radiography','Catering','Security','Laundry',
  'Health Information','Accounts',
];

const ROLES_BY_DEPT = {
  Medical: ['Doctor','Consultant','Medical Officer','Intern','Registered Nurse','Enrolled Nurse','Nurse Aide','Sister','Matron'],
  Nurses: ['Registered Nurse','Enrolled Nurse','Nurse Aide','Sister','Matron'],
  Mortuary: ['Mortuary Attendant','Mortician','Mortuary Technician','Mortuary Supervisor'],
  'School of Nursing': ['Tutor','Clinical Instructor','Lecturer','Principal Tutor','Student Nurse'],
  'School of Midwifery': ['Midwifery Tutor','Clinical Instructor','Lecturer','Principal Tutor','Student Midwife'],
  'Biomedical Equipment': ['Biomedical Engineer','Biomedical Technician','Electronics Technician','Equipment Officer'],
  Radiography: ['Radiologist','Radiographer','Sonographer','CT Technologist','MRI Technologist','X-Ray Technician','ECG Technician'],
  Catering: ['Chef','Head Chef','Sous Chef','Cook','Kitchen Assistant','Waiter','Waitress','Catering Supervisor','Dietitian','Food Service Manager'],
  Security: ['Security Guard','Security Officer','Gate Officer','Security Supervisor'],
  Laundry: ['Laundry Attendant','Laundry Supervisor','Laundry Technician'],
  'Health Information': ['Health Information Officer','Records Clerk','Medical Coder','Data Entry Officer','Records Manager'],
  Accounts: ['Accountant','Assistant Accountant','Accounts Clerk','Finance Officer','Cashier','Payroll Officer','Auditor'],
};

// ============================================================
// DISCIPLINARY POOLS
// ============================================================
const DISCIPLINARY_OFFENSES = [
  'Absenteeism','Late arrival','Insubordination','Negligence','Misconduct',
  'Theft','Substance abuse','Harassment','Patient mistreatment',
  'Breach of confidentiality','Falsification of records','Other',
];

const DISCIPLINARY_DESCRIPTIONS = {
  Absenteeism: ['Failed to report for shift on three consecutive days without notification.','Absent from duty without approved leave for two days.','Repeated unexcused absences documented over the past month.'],
  'Late arrival': ['Arrived 90 minutes after scheduled start without notifying supervisor.','Chronic lateness reported by shift supervisor over two weeks.','Late for three consecutive morning handovers.'],
  Insubordination: ['Refused to follow supervisor instructions during ward round.','Openly argued with senior nurse in front of patients.','Failed to comply with departmental procedure.'],
  Negligence: ['Failed to record patient vitals for an entire shift.','Did not administer prescribed medication at the scheduled time.','Left patient unattended in restricted area.'],
  Misconduct: ['Used hospital equipment for personal purposes.','Inappropriate conduct toward a colleague during working hours.','Violated uniform and hygiene policy after prior warnings.'],
  Theft: ['Removed hospital supplies without authorisation.','Reported for taking medication from the pharmacy store.','Alleged theft of a colleague personal belongings.'],
  'Substance abuse': ['Reported to duty under the influence of alcohol.','Suspected substance use during shift, referred for testing.','Positive breathalyser test at facility entrance.'],
  Harassment: ['Repeated unwanted comments toward a colleague.','Reported for inappropriate messaging outside working hours.','Verbal harassment complaint filed by junior staff.'],
  'Patient mistreatment': ['Rough handling of a patient reported by another staff member.','Patient complaint regarding verbal abuse during procedure.','Inappropriate response to a patient request, witnessed by relative.'],
  'Breach of confidentiality': ['Shared patient information with unauthorised third party.','Posted patient details on social media.','Discussed a patient case outside the clinical setting.'],
  'Falsification of records': ['Recorded vitals that were not actually taken.','Altered a shift log after the fact.','Signed for another staff member duties.'],
  Other: ['Repeated failure to follow infection control procedures.','Brought unauthorised persons into restricted areas.','Refused mandatory training without valid reason.'],
};

const DISCIPLINARY_OUTCOMES = ['Employee acknowledged the offense and received formal warning.','Employee disputed the finding; case referred for arbitration.','Employee accepted responsibility; case closed with corrective action.','Committee recommended formal disciplinary action.','Matter resolved through counselling and monitoring.'];

// ============================================================
// HELPER FUNCTIONS
// ============================================================
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function pickN(arr, n) {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

function pickEmployeeStatus() {
  const r = Math.random();
  if (r < 0.85) return 'active';
  if (r < 0.93) return 'on_leave';
  if (r < 0.97) return 'sick';
  return 'terminated';
}

function pickPatientStatus(dayAge) {
  const r = Math.random();
  if (dayAge <= 7) {
    if (r < 0.55) return 'admitted';
    if (r < 0.92) return 'treatment';
    if (r < 0.97) return 'discharged';
    return 'deceased';
  }
  if (dayAge <= 30) {
    if (r < 0.2) return 'admitted';
    if (r < 0.5) return 'treatment';
    if (r < 0.95) return 'discharged';
    return 'deceased';
  }
  if (r < 0.05) return 'treatment';
  if (r < 0.9) return 'discharged';
  return 'deceased';
}

function pickDisciplinaryStatus(dayAge) {
  const r = Math.random();
  if (dayAge <= 7) {
    if (r < 0.55) return 'open';
    if (r < 0.88) return 'under_investigation';
    return 'resolved';
  }
  if (dayAge <= 30) {
    if (r < 0.15) return 'open';
    if (r < 0.5) return 'under_investigation';
    if (r < 0.9) return 'resolved';
    return 'dismissed';
  }
  if (r < 0.7) return 'resolved';
  if (r < 0.95) return 'dismissed';
  return 'under_investigation';
}

function randomDateWithinDays(daysAgo, hourStart = 6, hourEnd = 22) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  const hours = hourStart + Math.floor(Math.random() * (hourEnd - hourStart));
  d.setHours(hours, Math.floor(Math.random() * 60), Math.floor(Math.random() * 60), 0);
  return d;
}

function todayAtHour(hourStart = 8, hourEnd = 18) {
  const d = new Date();
  const hours = hourStart + Math.floor(Math.random() * (hourEnd - hourStart));
  d.setHours(hours, Math.floor(Math.random() * 60), Math.floor(Math.random() * 60), 0);
  return d;
}

function dateOffsetDays(offset) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d;
}

function generateNationalId() {
  const p1 = String(Math.floor(10 + Math.random() * 90));
  const p2 = String(Math.floor(1000000 + Math.random() * 9000000));
  const p3 = String.fromCharCode(65 + Math.floor(Math.random() * 26));
  const p4 = String(Math.floor(10 + Math.random() * 90));
  return p1 + '-' + p2 + '-' + p3 + p4;
}

// ============================================================
// MAIN
// ============================================================
async function main() {
  console.log('🏥 Seeding database...');
  console.log('');

  try {
    // ============================================================
    // STEP 1: CLEAR ALL TABLES
    // ============================================================
    console.log('🧹 Clearing all tables...');
    
    await prisma.mealDelivery.deleteMany();
    await prisma.cateringWard.deleteMany();
    await prisma.cateringMealType.deleteMany();
    await prisma.scanRequest.deleteMany();
    await prisma.gateLog.deleteMany();
    await prisma.securityIncident.deleteMany();
    await prisma.linenMovement.deleteMany();
    await prisma.mortuaryRecord.deleteMany();
    await prisma.patientFile.deleteMany();
    await prisma.maintenanceLog.deleteMany();
    await prisma.equipment.deleteMany();
    await prisma.classSchedule.deleteMany();
    await prisma.schoolStudent.deleteMany();
    await prisma.cashFlow.deleteMany();
    await prisma.projectUpdate.deleteMany();
    await prisma.project.deleteMany();
    await prisma.employeeMovement.deleteMany();
    await prisma.establishmentTarget.deleteMany();
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
    await prisma.auditLog.deleteMany();
    
    console.log('  ✓ All tables cleared');

    // ============================================================
    // STEP 2: WARDS
    // ============================================================
    console.log('🏥 Creating wards...');
    const wards = await Promise.all([
      prisma.ward.create({ data: { name: 'Ward A', capacity: 20 } }),
      prisma.ward.create({ data: { name: 'Ward B', capacity: 20 } }),
      prisma.ward.create({ data: { name: 'ICU', capacity: 10 } }),
      prisma.ward.create({ data: { name: 'Maternity', capacity: 15 } }),
      prisma.ward.create({ data: { name: 'Surgical', capacity: 18 } }),
      prisma.ward.create({ data: { name: 'Paediatrics', capacity: 12 } }),
    ]);
    console.log('  ✓ Created ' + wards.length + ' wards');

    // ============================================================
    // STEP 3: CATERING WARDS & MEAL TYPES
    // ============================================================
    console.log('🍽️  Seeding catering...');
    const cateringWards = ['Ward A', 'Ward B', 'ICU', 'Maternity', 'Surgical', 'Paediatrics', 'Outpatient', 'Theatre'];
    for (const name of cateringWards) {
      await prisma.cateringWard.create({ data: { name } });
    }
    const mealTypes = ['Breakfast', 'Lunch', 'Dinner', 'Snack', 'Special - Diabetic', 'Special - Low Salt', 'Special - Soft Diet', 'Special - Renal'];
    for (const name of mealTypes) {
      await prisma.cateringMealType.create({ data: { name } });
    }
    console.log('  ✓ Created ' + cateringWards.length + ' catering wards and ' + mealTypes.length + ' meal types');

    // ============================================================
    // STEP 4: USERS (all 21 test accounts)
    // ============================================================
    console.log('👤 Creating users...');
    const users = [
      { username: 'nurse1', password: 'nurse123', fullName: 'Sister Mutsa', department: 'Nurses', role: 'staff', wardId: wards[0].id },
      { username: 'nurse2', password: 'nurse123', fullName: 'Nurse Tatenda', department: 'Nurses', role: 'staff', wardId: wards[1].id },
      { username: 'it1', password: 'it123', fullName: 'IT Manager', department: 'IT', role: 'admin', wardId: null },
      { username: 'it2', password: 'it123', fullName: 'IT Support Officer', department: 'IT', role: 'staff', wardId: null },
      { username: 'procurement1', password: 'proc123', fullName: 'Procurement Officer', department: 'Procurement', role: 'staff', wardId: null },
      { username: 'procurement2', password: 'proc123', fullName: 'Procurement Assistant', department: 'Procurement', role: 'staff', wardId: null },
      { username: 'stores1', password: 'store123', fullName: 'Store Manager', department: 'Stores', role: 'staff', wardId: null },
      { username: 'stores2', password: 'store123', fullName: 'Store Clerk', department: 'Stores', role: 'staff', wardId: null },
      { username: 'hr1', password: 'hr123', fullName: 'HR Manager', department: 'HR', role: 'staff', wardId: null },
      { username: 'hr2', password: 'hr123', fullName: 'HR Officer', department: 'HR', role: 'staff', wardId: null },
      { username: 'medical1', password: 'med123', fullName: 'Dr. James Mwale', department: 'Medical', role: 'staff', wardId: null },
      { username: 'mortuary1', password: 'mort123', fullName: 'Mortuary Supervisor', department: 'Mortuary', role: 'staff', wardId: null },
      { username: 'son1', password: 'son123', fullName: 'Principal Tutor', department: 'School of Nursing', role: 'staff', wardId: null },
      { username: 'som1', password: 'som123', fullName: 'Midwifery Tutor', department: 'School of Midwifery', role: 'staff', wardId: null },
      { username: 'biomed1', password: 'bio123', fullName: 'Biomedical Engineer', department: 'Biomedical Equipment', role: 'staff', wardId: null },
      { username: 'radio1', password: 'rad123', fullName: 'Radiographer', department: 'Radiography', role: 'staff', wardId: null },
      { username: 'catering1', password: 'cat123', fullName: 'Head Chef', department: 'Catering', role: 'staff', wardId: null },
      { username: 'security1', password: 'sec123', fullName: 'Security Supervisor', department: 'Security', role: 'staff', wardId: null },
      { username: 'laundry1', password: 'lau123', fullName: 'Laundry Supervisor', department: 'Laundry', role: 'staff', wardId: null },
      { username: 'healthinfo1', password: 'hi123', fullName: 'Records Manager', department: 'Health Information', role: 'staff', wardId: null },
      { username: 'accounts1', password: 'acc123', fullName: 'Accountant', department: 'Accounts', role: 'staff', wardId: null },
    ];

    for (const u of users) {
      const hash = await bcrypt.hash(u.password, 10);
      await prisma.user.create({
        data: { username: u.username, passwordHash: hash, fullName: u.fullName, department: u.department, role: u.role, wardId: u.wardId },
      });
    }
    console.log('  ✓ Created ' + users.length + ' user accounts');

    // ============================================================
    // STEP 5: EMPLOYEES (1,000)
    // ============================================================
    console.log('👥 Creating 1,000 employees...');
    const TOTAL_EMPLOYEES = 1000;
    let empCreated = 0;

    for (let i = 0; i < TOTAL_EMPLOYEES; i++) {
      const gender = Math.random() < 0.45 ? 'M' : 'F';
      const firstName = gender === 'M' ? pick(FIRST_NAMES_M) : pick(FIRST_NAMES_F);
      const surname = pick(SURNAMES);
      const name = firstName + ' ' + surname;

      const department = pick(EMPLOYEE_DEPARTMENTS);
      const role = pick(ROLES_BY_DEPT[department]);
      const status = pickEmployeeStatus();

      const hireDaysAgo = Math.floor(Math.random() * 1825);
      const hireDate = randomDateWithinDays(hireDaysAgo, 8, 17);

      const wardAssigned = ['Nurses', 'Medical'].includes(department);
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
          data: { name, department, role, wardId, status, hireDate, terminationDate },
        });
        await prisma.employeeStatusLog.create({
          data: { employeeId: employee.id, oldStatus: 'new', newStatus: status, changedBy: 'Seed Script' },
        });
        empCreated++;
        if (empCreated % 250 === 0) console.log('  → ' + empCreated + ' / ' + TOTAL_EMPLOYEES);
      } catch (e) {
        console.error('  Skipped one employee:', e.message);
      }
    }
    console.log('  ✓ Employees created: ' + empCreated);

    // ============================================================
    // STEP 6: PATIENTS (1,500 with realistic age distribution)
    // ============================================================
    console.log('🏥 Creating 1,500 patients...');
    const TOTAL_PATIENTS = 1500;
    let patCreated = 0;

    for (let i = 0; i < TOTAL_PATIENTS; i++) {
      const gender = Math.random() < 0.5 ? 'M' : 'F';
      const firstName = gender === 'M' ? pick(FIRST_NAMES_M) : pick(FIRST_NAMES_F);
      const surname = pick(SURNAMES);
      const name = firstName + ' ' + surname;

      // 30% admitted in last 7 days, 40% in last 8-30 days, 30% in last 31-90 days
      let daysAgo;
      if (Math.random() < 0.30) daysAgo = Math.floor(Math.random() * 7);
      else if (Math.random() < 0.60) daysAgo = 8 + Math.floor(Math.random() * 23);
      else daysAgo = 31 + Math.floor(Math.random() * 60);

      const admissionDate = daysAgo === 0 ? todayAtHour(6, 20) : randomDateWithinDays(daysAgo, 6, 20);
      const status = pickPatientStatus(daysAgo);

      const ward = pick(wards);
      const diagnosis = pick(DIAGNOSES);
      const symptoms = pick(SYMPTOMS);
      const bloodGroup = Math.random() < 0.7 ? pick(BLOOD_GROUPS) : null;
      const phone = Math.random() < 0.8 ? '+263 7' + Math.floor(1 + Math.random() * 8) + ' ' + Math.floor(1000000 + Math.random() * 9000000) : null;
      const nationalId = Math.random() < 0.8 ? generateNationalId() : null;

      let dischargeDate = null, finalDiagnosis = null, treatmentSummary = null, outcome = null;
      let dischargeNotes = null, dischargedBy = null, nextReviewDate = null, reviewDepartment = null, patientInstructions = null;

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
      if (status === 'deceased') causeOfDeath = diagnosis;

      try {
        const patient = await prisma.patient.create({
          data: {
            name, gender, nationalId, admissionDate,
            wardId: ward.id, status, diagnosis, symptoms,
            phone, bloodGroup, finalDiagnosis, treatmentSummary,
            outcome, dischargeDate, dischargeNotes, dischargedBy,
            nextReviewDate, reviewDepartment, patientInstructions, causeOfDeath,
          },
        });
        await prisma.statusLog.create({
          data: { patientId: patient.id, oldStatus: 'new', newStatus: status, changedBy: 'Seed Script' },
        });
        patCreated++;
        if (patCreated % 300 === 0) console.log('  → ' + patCreated + ' / ' + TOTAL_PATIENTS);
      } catch (e) {
        console.error('  Skipped one patient:', e.message);
      }
    }
    console.log('  ✓ Patients created: ' + patCreated);

    // ============================================================
    // STEP 7: INVENTORY
    // ============================================================
    console.log('📦 Creating inventory items...');
    const inventoryItems = [
      { name: 'Medical Gloves (Box)', quantity: 150, unit: 'boxes', category: 'PPE' },
      { name: 'Surgical Masks (Box)', quantity: 200, unit: 'boxes', category: 'PPE' },
      { name: 'N95 Respirators (Box)', quantity: 8, unit: 'boxes', category: 'PPE' },
      { name: 'Face Shields', quantity: 30, unit: 'pieces', category: 'PPE' },
      { name: 'Syringes 5ml (Pack)', quantity: 80, unit: 'packs', category: 'Consumables' },
      { name: 'Bandages (Roll)', quantity: 12, unit: 'rolls', category: 'Consumables' },
      { name: 'IV Drip Sets', quantity: 60, unit: 'sets', category: 'Consumables' },
      { name: 'Antiseptic Solution (L)', quantity: 25, unit: 'liters', category: 'Consumables' },
      { name: 'Paracetamol 500mg (Box)', quantity: 120, unit: 'boxes', category: 'Pharmaceuticals' },
      { name: 'Antibiotics (Box)', quantity: 6, unit: 'boxes', category: 'Pharmaceuticals' },
      { name: 'Thermometers', quantity: 8, unit: 'pieces', category: 'Equipment' },
      { name: 'Wheelchairs', quantity: 5, unit: 'pieces', category: 'Equipment' },
    ];
    for (const item of inventoryItems) {
      await prisma.inventoryItem.create({
        data: { name: item.name, quantity: item.quantity, unit: item.unit, category: item.category, lastReceived: new Date() },
      });
    }
    console.log('  ✓ Created ' + inventoryItems.length + ' inventory items');

    // ============================================================
    // STEP 8: TENDERS (60, with deliberate age spread)
    // ============================================================
    console.log('📋 Creating 60 tenders...');
    const allDepartments = ['Nurses','Medical','Mortuary','School of Nursing','School of Midwifery','Biomedical Equipment','Radiography','Catering','Security','Laundry','Health Information','Accounts','HR','Stores','Procurement','IT'];
    const itemNames = ['Surgical Gloves (Box)','Surgical Masks (Box)','Network Cables','Office Chairs','Recruitment Pack','Anatomical Models','Birthing Simulators','Calibration Kits','X-Ray Film (Box)','CT Scan Contrast Media','Patient File Folders','Invoice Books','Filing Cabinets','Shelf Labels','Stethoscopes','Body Bags (Pack)','Commercial Cooking Pots','Laundry Detergent (Bulk)','Access Cards (Pack)','Accounting Software Licenses'];
    
    const tenderStatuses = ['pending', 'awaiting_quotation', 'ordered', 'received', 'in_storage', 'completed'];
    
    for (let i = 0; i < 60; i++) {
      const dept = pick(allDepartments);
      const itemName = pick(itemNames);
      
      let status, daysAgo;
      if (i < 10) {
        // 10 from today
        daysAgo = 0;
        status = pick(['pending', 'awaiting_quotation', 'ordered', 'received']);
      } else if (i < 25) {
        // 15 from this week
        daysAgo = 1 + Math.floor(Math.random() * 6);
        status = pick(tenderStatuses);
      } else if (i < 45) {
        // 20 from this month
        daysAgo = 7 + Math.floor(Math.random() * 23);
        status = pick(tenderStatuses);
      } else {
        // 15 older, with 3+ stalled >14 days
        daysAgo = 14 + Math.floor(Math.random() * 30);
        // Force some to be stalled
        status = i % 5 === 0 ? 'pending' : pick(tenderStatuses);
      }
      
      const createdAt = daysAgo === 0 ? todayAtHour(8, 17) : randomDateWithinDays(daysAgo, 8, 17);
      
      await prisma.orderRequest.create({
        data: {
          requestingDepartment: dept,
          originatorDepartment: dept,
          requestingBy: pick(['Sister Mutsa','Nurse Tatenda','Dr. James Mwale','HR Manager','Store Manager','Head Chef']),
          itemName,
          quantity: 5 + Math.floor(Math.random() * 100),
          reason: 'Restock required',
          status,
          category: pick(['PPE', 'Consumables', 'Equipment', 'Furniture', 'Stationery']),
          urgency: pick(['normal', 'high', 'low']),
          createdAt,
        }
      });
    }
    console.log('  ✓ Created 60 tenders (3+ deliberately stalled >14 days)');

    // ============================================================
    // STEP 9: CASH FLOW (200 records over 30 days)
    // ============================================================
    console.log('💰 Creating 200 cash flow records...');
    const cashFlowSamples = [
      { type: 'in', currency: 'USD', amount: 1500, source: 'OPD Fees', reason: 'Morning consultations' },
      { type: 'in', currency: 'ZWG', amount: 20000, source: 'OPD Fees', reason: 'Morning consultations' },
      { type: 'in', currency: 'USD', amount: 450, source: 'Pharmacy', reason: 'Drug sales' },
      { type: 'out', currency: 'USD', amount: 200, source: 'Other', reason: 'Cleaning supplies' },
      { type: 'in', currency: 'ZWG', amount: 5000, source: 'Radiology', reason: 'X-Ray scans' },
      { type: 'in', currency: 'USD', amount: 10000, source: 'Grants / Donations', reason: 'Ministry of Health grant' },
      { type: 'out', currency: 'ZWG', amount: 15000, source: 'Staff Payments', reason: 'Locum nurse payments' },
      { type: 'in', currency: 'USD', amount: 300, source: 'Laboratory', reason: 'Blood tests' },
    ];

    for (let i = 0; i < 200; i++) {
      const sample = pick(cashFlowSamples);
      const daysAgo = Math.floor(Math.random() * 30);
      const date = daysAgo === 0 ? todayAtHour(8, 17) : randomDateWithinDays(daysAgo, 8, 17);
      
      await prisma.cashFlow.create({
        data: {
          date,
          type: sample.type,
          currency: sample.currency,
          amount: sample.amount * (0.8 + Math.random() * 0.4),
          source: sample.source,
          reason: sample.reason,
          addedBy: 'Accountant',
        }
      });
    }
    console.log('  ✓ Created 200 cash flow records (30 days)');

    // ============================================================
    // STEP 10: PROJECTS (25, with 2 blocked >14 days)
    // ============================================================
    console.log('🎯 Creating 25 projects...');
    const projectTemplates = [
      { name: 'CCTV installation - Phase 2', description: 'Install 12 new CCTV cameras covering main corridor, pharmacy, and maternity ward.', department: 'IT', head: 'IT Manager', status: 'pending', blockedDays: 15 },
      { name: 'Patient ID card system upgrade', description: 'Roll out new patient ID card system with barcodes.', department: 'Nurses', head: 'Sister Mutsa', status: 'pending', blockedDays: 20 },
      { name: 'Ward A painting and repairs', description: 'Repaint Ward A walls, replace broken beds.', department: 'Biomedical Equipment', head: 'Maintenance Supervisor', status: 'ongoing' },
      { name: 'Staff wellness programme', description: 'Quarterly wellness check-ups and counselling.', department: 'HR', head: 'HR Manager', status: 'ongoing' },
      { name: 'Radiology equipment servicing', description: 'Annual servicing of X-ray, CT, MRI, ultrasound.', department: 'Radiography', head: 'Radiographer', status: 'ongoing' },
      { name: 'Medical records digitisation', description: 'Scan and digitise 5 years of paper records.', department: 'Health Information', head: 'Records Manager', status: 'ongoing' },
      { name: 'Security gate access control', description: 'Replace manual gate logs with electronic access.', department: 'Security', head: 'Security Supervisor', status: 'ongoing' },
      { name: 'Laundry linen replacement', description: 'Replace 200 sets of worn bed linen.', department: 'Laundry', head: 'Laundry Supervisor', status: 'completed' },
      { name: 'ICU ventilator maintenance', description: 'Preventive maintenance of ICU ventilators.', department: 'Biomedical Equipment', head: 'Biomedical Engineer', status: 'ongoing' },
      { name: 'Nurses training - infection control', description: 'Refresher training on infection control.', department: 'School of Nursing', head: 'Principal Tutor', status: 'ongoing' },
      { name: 'Catering kitchen renovation', description: 'New stoves, extractor fans, workspace redesign.', department: 'Catering', head: 'Head Chef', status: 'ongoing' },
      { name: 'Mortuary cold storage upgrade', description: 'Upgrade refrigeration units.', department: 'Mortuary', head: 'Mortuary Supervisor', status: 'ongoing' },
      { name: 'Accounts audit readiness', description: 'Prepare finance records for annual audit.', department: 'Accounts', head: 'Accountant', status: 'completed' },
      { name: 'Emergency generator servicing', description: 'Full service of backup generators.', department: 'Biomedical Equipment', head: 'Equipment Officer', status: 'completed' },
      { name: 'IT network switch replacement', description: 'Replace aging network switches.', department: 'IT', head: 'IT Manager', status: 'ongoing' },
      { name: 'Pharmacy stock reconciliation', description: 'Full physical inventory count.', department: 'Stores', head: 'Store Manager', status: 'completed' },
      { name: 'Ward B bed replacement', description: 'Replace 20 old beds in Ward B.', department: 'Biomedical Equipment', head: 'Maintenance Supervisor', status: 'ongoing' },
      { name: 'Midwifery simulation lab upgrade', description: 'New birthing simulators.', department: 'School of Midwifery', head: 'Midwifery Tutor', status: 'ongoing' },
      { name: 'Security guard training', description: 'Refresher training on emergency protocols.', department: 'Security', head: 'Security Supervisor', status: 'completed' },
      { name: 'Laundry equipment upgrade', description: 'New industrial washing machines.', department: 'Laundry', head: 'Laundry Supervisor', status: 'ongoing' },
      { name: 'Patient records audit', description: 'Audit patient records for completeness.', department: 'Health Information', head: 'Records Manager', status: 'ongoing' },
      { name: 'Cafeteria renovation', description: 'Expand staff cafeteria.', department: 'Catering', head: 'Head Chef', status: 'ongoing' },
      { name: 'IT helpdesk system', description: 'Deploy ticketing system for IT requests.', department: 'IT', head: 'IT Manager', status: 'ongoing' },
      { name: 'Radiology waiting room upgrade', description: 'Renovate waiting room.', department: 'Radiography', head: 'Radiographer', status: 'ongoing' },
      { name: 'HR records digitisation', description: 'Digitise all HR staff files.', department: 'HR', head: 'HR Manager', status: 'ongoing' },
    ];

    let projectCount = 0;
    for (const p of projectTemplates) {
      const startDate = dateOffsetDays(-60 - Math.floor(Math.random() * 30));
      const targetDate = dateOffsetDays(15 + Math.floor(Math.random() * 60));
      const lastUpdateDaysAgo = p.status === 'pending' ? p.blockedDays || 5 : Math.floor(Math.random() * 10);
      
      const project = await prisma.project.create({
        data: {
          name: p.name,
          description: p.description,
          department: p.department,
          projectHead: p.head,
          status: p.status,
          startDate,
          targetDate,
          obstacleReason: p.status === 'pending' ? 'Awaiting approval / supplier' : null,
          createdBy: p.head,
          createdAt: startDate,
          updatedAt: dateOffsetDays(-lastUpdateDaysAgo),
        }
      });

      await prisma.projectUpdate.create({
        data: {
          projectId: project.id,
          note: p.status === 'pending' ? 'Blocked - awaiting resolution' : 'Progress update',
          statusAtUpdate: p.status,
          obstacleReason: p.status === 'pending' ? 'Awaiting approval' : null,
          actionTaken: 'Followed up',
          updatedBy: p.head,
          timestamp: dateOffsetDays(-lastUpdateDaysAgo),
        }
      });
      projectCount++;
    }
    console.log('  ✓ Created ' + projectCount + ' projects (2 blocked >14 days)');

    // ============================================================
    // STEP 11: DISCIPLINARY CASES (60)
    // ============================================================
    console.log('⚖️  Creating 60 disciplinary cases...');
    const sampleEmployees = await prisma.employee.findMany({ select: { id: true }, take: 500 });

    if (sampleEmployees.length > 0) {
      const discYear = new Date().getFullYear();
      let discSeq = 1;

      for (let i = 0; i < 60; i++) {
        const employee = pick(sampleEmployees);
        const offenseType = pick(DISCIPLINARY_OFFENSES);
        const description = pick(DISCIPLINARY_DESCRIPTIONS[offenseType] || DISCIPLINARY_DESCRIPTIONS.Other);

        const daysAgo = Math.floor(Math.random() * 90);
        const status = pickDisciplinaryStatus(daysAgo);
        const reportedDate = daysAgo === 0 ? todayAtHour(8, 17) : randomDateWithinDays(daysAgo, 8, 17);

        const caseNumber = 'DISC-' + discYear + '-' + String(discSeq).padStart(4, '0');
        discSeq++;

        const closedBy = (status === 'resolved' || status === 'dismissed') ? 'HR Manager' : null;
        const closedDate = closedBy ? new Date(reportedDate.getTime() + 5 * 86400000) : null;

        const record = await prisma.disciplinaryCase.create({
          data: {
            caseNumber,
            employeeId: employee.id,
            offenseType,
            description,
            reportedBy: pick(['Ward Supervisor','Senior Nurse','Department Head','Shift Coordinator','Colleague']),
            reportedDate,
            witnesses: pick([null, 'Sister Mutsa', 'Nurse Tatenda', 'Dr. Mwale']),
            status,
            actionTaken: status === 'resolved' ? pick(['Verbal warning','Written warning','Suspension']) : null,
            outcome: status === 'resolved' ? pick(DISCIPLINARY_OUTCOMES) : null,
            closedBy,
            closedDate,
          },
        });

        await prisma.disciplinaryStatusLog.create({
          data: { caseId: record.id, oldStatus: 'new', newStatus: 'open', changedBy: 'System', notes: 'Case filed' },
        });

        if (status !== 'open') {
          await prisma.disciplinaryStatusLog.create({
            data: { caseId: record.id, oldStatus: 'open', newStatus: status, changedBy: 'HR Manager', notes: 'Status updated' },
          });
        }
      }
    }
    console.log('  ✓ Created 60 disciplinary cases');

    // ============================================================
    // STEP 12: ESTABLISHMENT TARGETS
    // ============================================================
    console.log('📊 Creating establishment targets...');
    const establishmentTargets = [
      { department: 'Medical', minHeadcount: 30, maxHeadcount: 80 },
      { department: 'Nurses', minHeadcount: 150, maxHeadcount: 250 },
      { department: 'Mortuary', minHeadcount: 3, maxHeadcount: 10 },
      { department: 'School of Nursing', minHeadcount: 8, maxHeadcount: 20 },
      { department: 'School of Midwifery', minHeadcount: 5, maxHeadcount: 15 },
      { department: 'Biomedical Equipment', minHeadcount: 4, maxHeadcount: 12 },
      { department: 'Radiography', minHeadcount: 6, maxHeadcount: 20 },
      { department: 'Catering', minHeadcount: 10, maxHeadcount: 30 },
      { department: 'Security', minHeadcount: 8, maxHeadcount: 20 },
      { department: 'Laundry', minHeadcount: 5, maxHeadcount: 15 },
      { department: 'Health Information', minHeadcount: 4, maxHeadcount: 12 },
      { department: 'Accounts', minHeadcount: 4, maxHeadcount: 12 },
    ];
    for (const t of establishmentTargets) {
      await prisma.establishmentTarget.create({ data: t });
    }
    console.log('  ✓ Created ' + establishmentTargets.length + ' establishment targets');

    // ============================================================
    // STEP 13: EMPLOYEE MOVEMENTS (40)
    // ============================================================
    console.log('🔄 Creating 40 employee movements...');
    const sampleEmployeesForMovement = await prisma.employee.findMany({
      select: { id: true, department: true, wardId: true },
      take: 200,
    });

    const RESIGNATION_REASONS = ['Better opportunity elsewhere','Relocation','Health reasons','Family reasons','Further studies','Salary dissatisfaction'];

    for (let i = 0; i < 40; i++) {
      const emp = pick(sampleEmployeesForMovement);
      const daysAgo = Math.floor(Math.random() * 90);
      const date = daysAgo === 0 ? todayAtHour(8, 17) : randomDateWithinDays(daysAgo, 8, 17);

      const typeRoll = Math.random();
      let movementData = {
        employeeId: emp.id,
        approvedBy: 'HR Manager',
        effectiveDate: date,
        createdAt: date,
      };

      if (typeRoll < 0.4) {
        movementData.movementType = 'transfer';
        movementData.fromDepartment = emp.department;
        movementData.fromWardId = emp.wardId;
        movementData.toDepartment = pick(EMPLOYEE_DEPARTMENTS);
        movementData.reason = 'Operational requirement';
      } else if (typeRoll < 0.7) {
        movementData.movementType = 'retirement';
        movementData.plannedDate = date;
        movementData.actualDate = date;
        movementData.yearsOfService = Math.floor(5 + Math.random() * 30);
        movementData.pensionNotes = 'Standard pension arrangement';
      } else {
        movementData.movementType = 'resignation';
        movementData.resignationDate = date;
        const lastDay = new Date(date);
        lastDay.setDate(lastDay.getDate() + 30);
        movementData.lastWorkingDay = lastDay;
        movementData.noticePeriodDays = 30;
        movementData.reason = pick(RESIGNATION_REASONS);
        movementData.exitInterviewDone = Math.random() < 0.6;
        movementData.eligibleForRehire = Math.random() < 0.7;
      }

      await prisma.employeeMovement.create({ data: movementData });
    }
    console.log('  ✓ Created 40 employee movements');

    // ============================================================
    // STEP 14: SECURITY INCIDENTS (30)
    // ============================================================
    console.log('🔒 Creating 30 security incidents...');
    const incidentTypes = ['Theft', 'Trespassing', 'Patient Wandering', 'Equipment Damage', 'Assault', 'Fire', 'Other'];
    const locations = ['Ward A', 'Ward B', 'ICU', 'Main Gate', 'Pharmacy', 'Parking Lot', 'Maternity'];

    for (let i = 0; i < 30; i++) {
      const daysAgo = Math.floor(Math.random() * 30);
      const isOpen = i < 8; // First 8 are open
      
      await prisma.securityIncident.create({
        data: {
          type: pick(incidentTypes),
          location: pick(locations),
          description: 'Incident reported and logged by security staff.',
          severity: pick(['low', 'medium', 'high']),
          reportedBy: 'Security Supervisor',
          status: isOpen ? 'open' : pick(['under_investigation', 'resolved']),
          createdAt: daysAgo === 0 ? todayAtHour(6, 22) : randomDateWithinDays(daysAgo, 6, 22),
        }
      });
    }
    console.log('  ✓ Created 30 incidents (8 open)');

    // Gate Logs (40)
    for (let i = 0; i < 40; i++) {
      const daysAgo = Math.floor(Math.random() * 7);
      const timeIn = daysAgo === 0 ? todayAtHour(8, 18) : randomDateWithinDays(daysAgo, 8, 18);
      const hasLeft = Math.random() < 0.7;
      let timeOut = null;
      if (hasLeft) {
        const tOut = new Date(timeIn);
        tOut.setHours(tOut.getHours() + 1 + Math.floor(Math.random() * 4));
        timeOut = tOut;
      }
      
      await prisma.gateLog.create({
        data: {
          name: pick(FIRST_NAMES_M.concat(FIRST_NAMES_F)) + ' ' + pick(SURNAMES),
          idNumber: generateNationalId(),
          purpose: pick(['Visiting patient', 'Delivery', 'Meeting', 'Maintenance', 'Interview']),
          timeIn,
          timeOut,
          loggedBy: 'Security Supervisor',
        }
      });
    }
    console.log('  ✓ Created 40 gate logs');

    // ============================================================
    // STEP 15: RADIOGRAPHY SCANS (80)
    // ============================================================
    console.log('🩻 Creating 80 scan requests...');
    const admittedPatients = await prisma.patient.findMany({
      where: { status: { in: ['admitted', 'treatment'] } },
      take: 100,
      select: { id: true },
    });

    const scanTypes = ['X-Ray', 'CT Scan', 'MRI', 'Ultrasound', 'ECG'];
    for (let i = 0; i < 80; i++) {
      if (admittedPatients.length === 0) break;
      const patient = pick(admittedPatients);
      const daysAgo = Math.floor(Math.random() * 7);
      
      let status;
      if (i < 30) status = 'pending';
      else if (i < 50) status = 'in_progress';
      else status = 'completed';
      
      await prisma.scanRequest.create({
        data: {
          patientId: patient.id,
          scanType: pick(scanTypes),
          requestedBy: pick(['Dr. James Mwale', 'Sister Mutsa', 'Nurse Tatenda']),
          status,
          notes: Math.random() < 0.4 ? 'Routine scan' : null,
          createdAt: daysAgo === 0 ? todayAtHour(8, 16) : randomDateWithinDays(daysAgo, 8, 16),
        }
      });
    }
    console.log('  ✓ Created 80 scan requests');

    // ============================================================
    // STEP 16: CATERING DELIVERIES (150 over 7 days)
    // ============================================================
    console.log('🍽️  Creating 150 meal deliveries...');
    const cateringWardRecords = await prisma.cateringWard.findMany();
    const mealTypeRecords = await prisma.cateringMealType.findMany();
    
    for (let day = 0; day < 7; day++) {
      for (let batch = 0; batch < 5; batch++) {
        const batchId = 'B-' + dateOffsetDays(-day).toISOString().slice(0, 10).replace(/-/g, '') + '-' + String(100 + batch);
        const ward = pick(cateringWardRecords);
        const mealsPerBatch = 1 + Math.floor(Math.random() * 3);
        const usedMealTypes = new Set();
        
        for (let m = 0; m < mealsPerBatch; m++) {
          let mealType;
          let attempts = 0;
          do {
            mealType = pick(mealTypeRecords);
            attempts++;
          } while (usedMealTypes.has(mealType.id) && attempts < 10);
          
          if (usedMealTypes.has(mealType.id)) continue;
          usedMealTypes.add(mealType.id);
          
          await prisma.mealDelivery.create({
            data: {
              batchId,
              wardId: ward.id,
              mealTypeId: mealType.id,
              quantity: 20 + Math.floor(Math.random() * 60),
              notes: Math.random() < 0.3 ? 'Extra portions' : null,
              deliveredBy: 'Head Chef',
              status: day === 0 && Math.random() < 0.4 ? 'prepared' : 'delivered',
              createdAt: day === 0 ? todayAtHour(6, 18) : randomDateWithinDays(day, 6, 18),
            }
          });
        }
      }
    }
    console.log('  ✓ Created 150 meal delivery batches (7 days)');

    // ============================================================
    // STEP 17: LAUNDRY MOVEMENTS (100 over 7 days)
    // ============================================================
    console.log('🧺 Creating 100 laundry movements...');
    const linenItems = ['Bed Sheets', 'Towels', 'Pillow Cases', 'Gowns', 'Blankets'];
    const laundryWards = ['Ward A', 'Ward B', 'ICU', 'Maternity', 'Surgical', 'Paediatrics'];

    for (let i = 0; i < 100; i++) {
      const daysAgo = Math.floor(Math.random() * 7);
      const date = daysAgo === 0 ? todayAtHour(6, 18) : randomDateWithinDays(daysAgo, 6, 18);
      
      await prisma.linenMovement.create({
        data: {
          type: pick(['sent', 'received']),
          itemType: pick(linenItems),
          ward: pick(laundryWards),
          quantity: 10 + Math.floor(Math.random() * 60),
          condition: Math.random() < 0.85 ? 'good' : pick(['damaged', 'lost']),
          loggedBy: 'Laundry Supervisor',
          createdAt: date,
        }
      });
    }
    console.log('  ✓ Created 100 laundry movements');

    // ============================================================
    // STEP 18: MORTUARY RECORDS (25)
    // ============================================================
    console.log('⚰️  Creating 25 mortuary records...');
    const mortuaryCauses = ['Cardiac arrest', 'Respiratory failure', 'Severe malaria', 'Road traffic accident', 'Stroke', 'Sepsis'];
    const mortuaryNames = ['Tendai Moyo', 'Rudo Ncube', 'Farai Dube', 'Chipo Sibanda', 'Simba Mhlanga'];

    for (let i = 0; i < 25; i++) {
      const daysAgo = Math.floor(Math.random() * 30);
      const date = daysAgo === 0 ? todayAtHour(6, 20) : randomDateWithinDays(daysAgo, 6, 20);
      const isReleased = i < 20;
      const year = new Date().getFullYear();
      
      await prisma.mortuaryRecord.create({
        data: {
          bodyId: 'MOR-' + year + '-' + String(i + 1).padStart(4, '0'),
          patientName: pick(mortuaryNames),
          age: 20 + Math.floor(Math.random() * 70),
          gender: pick(['Male', 'Female']),
          dateOfDeath: date,
          causeOfDeath: pick(mortuaryCauses),
          nextOfKin: pick(FIRST_NAMES_M.concat(FIRST_NAMES_F)) + ' ' + pick(SURNAMES),
          contactPhone: '+263 7' + Math.floor(1 + Math.random() * 8) + ' ' + Math.floor(1000000 + Math.random() * 9000000),
          status: isReleased ? 'released' : 'in_mortuary',
          receivedBy: 'Mortuary Supervisor',
          releasedTo: isReleased ? 'Family Member' : null,
          releasedBy: isReleased ? 'Mortuary Supervisor' : null,
          releaseNotes: isReleased ? 'Burial permit verified' : null,
          releasedAt: isReleased ? new Date(date.getTime() + 86400000) : null,
          createdAt: date,
        }
      });
    }
    console.log('  ✓ Created 25 mortuary records (5 currently in mortuary)');

    // ============================================================
    // STEP 19: HEALTH INFO FILES (80, with 2+ overdue >5 days)
    // ============================================================
    console.log('📁 Creating 80 health info files...');
    const wardsForFiles = ['Ward A', 'Ward B', 'ICU', 'Maternity', 'Surgical', 'Paediatrics', 'Outpatient', 'Theatre', 'Radiology', 'Laboratory', 'Pharmacy', 'Accounts'];

    for (let i = 0; i < 80; i++) {
      const year = new Date().getFullYear();
      const fileNumber = 'HI-' + year + '-' + String(i + 1).padStart(4, '0');
      const isReturned = i < 50;
      
      // 2 files overdue >5 days (critical)
      let daysAgo;
      if (!isReturned && i < 52) {
        // First 2 unreturned files: >5 days overdue
        daysAgo = 6 + Math.floor(Math.random() * 3);
      } else if (!isReturned) {
        daysAgo = Math.floor(Math.random() * 4);
      } else {
        daysAgo = Math.floor(Math.random() * 14);
      }
      
      const checkedOutAt = daysAgo === 0 ? todayAtHour(8, 17) : randomDateWithinDays(daysAgo, 8, 17);
      
      await prisma.patientFile.create({
        data: {
          fileNumber,
          patientName: pick(FIRST_NAMES_M.concat(FIRST_NAMES_F)) + ' ' + pick(SURNAMES),
          patientId: generateNationalId(),
          ward: pick(wardsForFiles),
          requestedBy: pick(['Dr. James Mwale', 'Sister Mutsa', 'Nurse Tatenda', 'Accountant']),
          purpose: pick(['Clinical review', 'Billing', 'Audit', 'Research']),
          status: isReturned ? 'returned' : 'out',
          checkedOutAt,
          checkedOutBy: 'Records Manager',
          returnedAt: isReturned ? new Date(checkedOutAt.getTime() + 86400000) : null,
          returnedBy: isReturned ? 'Records Manager' : null,
        }
      });
    }
    console.log('  ✓ Created 80 files (2+ overdue >5 days for dashboard)');

    // ============================================================
    // STEP 20: BIOMEDICAL EQUIPMENT (40)
    // ============================================================
    console.log('🔧 Creating 40 equipment records...');
    const equipmentNames = [
      { name: 'Ventilator', category: 'Life Support' },
      { name: 'Defibrillator', category: 'Life Support' },
      { name: 'X-Ray Machine', category: 'Diagnostic' },
      { name: 'CT Scanner', category: 'Diagnostic' },
      { name: 'MRI Scanner', category: 'Diagnostic' },
      { name: 'Ultrasound Machine', category: 'Diagnostic' },
      { name: 'Patient Monitor', category: 'Monitoring' },
      { name: 'ECG Machine', category: 'Monitoring' },
      { name: 'Anesthesia Machine', category: 'Surgical' },
      { name: 'Infusion Pump', category: 'Surgical' },
      { name: 'Centrifuge', category: 'Laboratory' },
      { name: 'Microscope', category: 'Laboratory' },
    ];
    const equipmentLocations = ['Ward A', 'Ward B', 'ICU', 'Maternity', 'Surgical', 'Paediatrics', 'Radiology', 'Laboratory', 'Theatre', 'Outpatient'];
    const year = new Date().getFullYear();

    for (let i = 0; i < 40; i++) {
      const template = pick(equipmentNames);
      const equipmentId = 'EQ-' + year + '-' + String(i + 1).padStart(4, '0');
      
      // 4 out of order, 4 maintenance
      let status;
      if (i < 4) status = 'out_of_order';
      else if (i < 8) status = 'maintenance';
      else status = 'operational';
      
      const equipment = await prisma.equipment.create({
        data: {
          equipmentId,
          name: template.name + ' #' + (i + 1),
          category: template.category,
          location: pick(equipmentLocations),
          status,
          lastServiced: Math.random() < 0.7 ? dateOffsetDays(-30 - Math.floor(Math.random() * 60)) : null,
          nextService: dateOffsetDays(Math.floor(Math.random() * 90)),
          notes: Math.random() < 0.3 ? 'Serial: SN-' + Math.floor(100000 + Math.random() * 900000) : null,
        }
      });

      // Add a couple maintenance logs
      for (let l = 0; l < 2; l++) {
        await prisma.maintenanceLog.create({
          data: {
            equipmentId: equipment.id,
            logType: pick(['routine', 'calibration', 'inspection']),
            description: 'Routine maintenance check completed',
            performedBy: 'Biomedical Engineer',
            cost: Math.random() < 0.5 ? 50 + Math.random() * 200 : null,
            statusBefore: 'operational',
            statusAfter: 'operational',
            loggedAt: dateOffsetDays(-30 - Math.floor(Math.random() * 60)),
          }
        });
      }
    }
    console.log('  ✓ Created 40 equipment records (4 out_of_order)');

    // ============================================================
    // STEP 21: SCHOOLS (Nursing 60 + Midwifery 40)
    // ============================================================
    console.log('🎓 Creating school students and schedules...');
    
    // Nursing students
    for (let i = 0; i < 60; i++) {
      const gender = Math.random() < 0.3 ? 'M' : 'F';
      const name = (gender === 'M' ? pick(FIRST_NAMES_M) : pick(FIRST_NAMES_F)) + ' ' + pick(SURNAMES);
      const year = new Date().getFullYear();
      
      await prisma.schoolStudent.create({
        data: {
          studentNumber: 'SON-' + year + '-' + String(i + 1).padStart(4, '0'),
          name,
          school: 'Nursing',
          intakeYear: year - Math.floor(Math.random() * 4),
          currentClass: pick(['Year 1', 'Year 2', 'Year 3', 'Year 4']),
          currentWard: Math.random() < 0.6 ? pick(['Ward A', 'Ward B', 'ICU', 'Maternity', 'Surgical', 'Paediatrics']) : null,
          status: Math.random() < 0.85 ? 'active' : pick(['graduated', 'withdrawn']),
        }
      });
    }
    
    // Midwifery students
    for (let i = 0; i < 40; i++) {
      const gender = Math.random() < 0.2 ? 'M' : 'F';
      const name = (gender === 'M' ? pick(FIRST_NAMES_M) : pick(FIRST_NAMES_F)) + ' ' + pick(SURNAMES);
      const year = new Date().getFullYear();
      
      await prisma.schoolStudent.create({
        data: {
          studentNumber: 'SOM-' + year + '-' + String(i + 1).padStart(4, '0'),
          name,
          school: 'Midwifery',
          intakeYear: year - Math.floor(Math.random() * 4),
          currentClass: pick(['Year 1', 'Year 2', 'Year 3', 'Year 4']),
          currentWard: Math.random() < 0.6 ? pick(['Maternity', 'Ward A', 'Ward B']) : null,
          status: Math.random() < 0.85 ? 'active' : pick(['graduated', 'withdrawn']),
        }
      });
    }

    // Class schedules
    const nursingClasses = [
      { title: 'Anatomy & Physiology', tutor: 'Principal Tutor', day: 'Monday', start: '08:00', end: '10:00' },
      { title: 'Infection Control', tutor: 'Principal Tutor', day: 'Monday', start: '11:00', end: '13:00' },
      { title: 'Pharmacology', tutor: 'Lecturer Moyo', day: 'Tuesday', start: '08:00', end: '10:00' },
      { title: 'Clinical Practice', tutor: 'Clinical Instructor', day: 'Tuesday', start: '14:00', end: '16:00' },
      { title: 'Medical-Surgical Nursing', tutor: 'Principal Tutor', day: 'Wednesday', start: '08:00', end: '10:00' },
      { title: 'Patient Assessment', tutor: 'Lecturer Ncube', day: 'Thursday', start: '09:00', end: '11:00' },
      { title: 'Wound Care', tutor: 'Clinical Instructor', day: 'Friday', start: '08:00', end: '10:00' },
    ];

    const midwiferyClasses = [
      { title: 'Antenatal Care', tutor: 'Midwifery Tutor', day: 'Monday', start: '08:00', end: '10:00' },
      { title: 'Labour & Delivery', tutor: 'Midwifery Tutor', day: 'Monday', start: '11:00', end: '13:00' },
      { title: 'Postnatal Care', tutor: 'Lecturer Dube', day: 'Tuesday', start: '08:00', end: '10:00' },
      { title: 'Neonatal Care', tutor: 'Clinical Instructor', day: 'Wednesday', start: '09:00', end: '11:00' },
      { title: 'Obstetric Emergencies', tutor: 'Midwifery Tutor', day: 'Thursday', start: '08:00', end: '10:00' },
      { title: 'Family Planning', tutor: 'Lecturer Sibanda', day: 'Friday', start: '10:00', end: '12:00' },
    ];

    for (const c of nursingClasses) {
      await prisma.classSchedule.create({
        data: { school: 'Nursing', title: c.title, tutor: c.tutor, location: 'Lecture Room 1', dayOfWeek: c.day, startTime: c.start, endTime: c.end }
      });
    }

    for (const c of midwiferyClasses) {
      await prisma.classSchedule.create({
        data: { school: 'Midwifery', title: c.title, tutor: c.tutor, location: 'Lecture Room 2', dayOfWeek: c.day, startTime: c.start, endTime: c.end }
      });
    }
    console.log('  ✓ Created 100 students and 13 classes');

    // ============================================================
    // PRINT SUMMARY
    // ============================================================
    console.log('');
    console.log('════════════════════════════════════════════════');
    console.log('🎉 DATABASE SEEDED SUCCESSFULLY');
    console.log('════════════════════════════════════════════════');
    console.log('');

    const totals = {
      'Wards': await prisma.ward.count(),
      'Users': await prisma.user.count(),
      'Employees': await prisma.employee.count(),
      'Patients': await prisma.patient.count(),
      'Inventory Items': await prisma.inventoryItem.count(),
      'Tenders': await prisma.orderRequest.count(),
      'Cash Flow Records': await prisma.cashFlow.count(),
      'Projects': await prisma.project.count(),
      'Project Updates': await prisma.projectUpdate.count(),
      'Disciplinary Cases': await prisma.disciplinaryCase.count(),
      'Employee Movements': await prisma.employeeMovement.count(),
      'Security Incidents': await prisma.securityIncident.count(),
      'Gate Logs': await prisma.gateLog.count(),
      'Scan Requests': await prisma.scanRequest.count(),
      'Meal Deliveries': await prisma.mealDelivery.count(),
      'Laundry Movements': await prisma.linenMovement.count(),
      'Mortuary Records': await prisma.mortuaryRecord.count(),
      'Patient Files': await prisma.patientFile.count(),
      'Equipment': await prisma.equipment.count(),
      'Maintenance Logs': await prisma.maintenanceLog.count(),
      'School Students': await prisma.schoolStudent.count(),
      'Class Schedules': await prisma.classSchedule.count(),
    };

    Object.entries(totals).forEach(([key, val]) => {
      console.log('  ' + key.padEnd(24) + ': ' + val);
    });

    console.log('');
    console.log('════════════════════════════════════════════════');
    console.log('🎯 DASHBOARD TRIGGERS ACTIVE');
    console.log('════════════════════════════════════════════════');
    
    const overdueFiles = await prisma.patientFile.count({
      where: {
        status: 'out',
        checkedOutAt: { lte: new Date(Date.now() - 5 * 86400000) }
      }
    });
    console.log('  Files overdue >5 days      : ' + overdueFiles);

    const blockedProjects = await prisma.project.count({ where: { status: 'pending' } });
    console.log('  Blocked projects           : ' + blockedProjects);

    const outOfOrderEquipment = await prisma.equipment.count({ where: { status: 'out_of_order' } });
    console.log('  Equipment out of order     : ' + outOfOrderEquipment);

    const openIncidents = await prisma.securityIncident.count({ where: { status: 'open' } });
    console.log('  Open security incidents    : ' + openIncidents);

    const stalledTenders = await prisma.orderRequest.count({
      where: {
        status: 'pending',
        createdAt: { lte: new Date(Date.now() - 14 * 86400000) }
      }
    });
    console.log('  Tenders stalled >14 days   : ' + stalledTenders);

    const staleProjects = await prisma.project.count({
      where: {
        status: 'ongoing',
        updatedAt: { lte: new Date(Date.now() - 7 * 86400000) }
      }
    });
    console.log('  Stale projects (>7 days)   : ' + staleProjects);

    console.log('');
    console.log('════════════════════════════════════════════════');
    console.log('🔐 TEST CREDENTIALS');
    console.log('════════════════════════════════════════════════');
    console.log('  Nurses:              nurse1 / nurse123');
    console.log('  IT:                  it1 / it123');
    console.log('  Procurement:         procurement1 / proc123');
    console.log('  Stores:              stores1 / store123');
    console.log('  HR:                  hr1 / hr123');
    console.log('  Medical:             medical1 / med123');
    console.log('  Mortuary:            mortuary1 / mort123');
    console.log('  School of Nursing:   son1 / son123');
    console.log('  School of Midwifery: som1 / som123');
    console.log('  Biomedical Equip:    biomed1 / bio123');
    console.log('  Radiography:         radio1 / rad123');
    console.log('  Catering:            catering1 / cat123');
    console.log('  Security:            security1 / sec123');
    console.log('  Laundry:             laundry1 / lau123');
    console.log('  Health Information:  healthinfo1 / hi123');
    console.log('  Accounts:            accounts1 / acc123');
    console.log('  Super Admin:         Admin / (your configured password)');
    console.log('');
    console.log('✅ Ready for the Live Dashboard build!');
    console.log('');

  } catch (e) {
    console.error('');
    console.error('❌ SEED FAILED:', e.message);
    console.error(e);
    process.exit(1);
  }
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  });
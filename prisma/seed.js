// Full seed script — diversified + today-loaded.
// Run with: npm run seed
// WARNING: destructive. Wipes all data first.

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

// ============================================================
// NAME / DIAGNOSIS POOLS
// ============================================================

const FIRST_NAMES_M = [
  'Tendai','Farai','Tapiwa','Munashe','Blessing','Tatenda','Simba',
  'Kudakwashe','Panashe','Takudzwa','Nyasha','Tinashe','Rufaro','Tafara',
  'Prosper','Knowledge','Prince','Wellington','Tichaona','Marshall',
  'Brighton','Lovemore','Never','Gift','Praise','Wisdom','Takunda',
  'Tanaka','Tanatswa','Tawananyasha','Tirivashe','Tonderai',
  'Tongai','Tungamirai','Vusumuzi','Zvikomborero','Simbarashe',
  'Shingirai','Shadreck','Ropafadzo','Nokutenda','Ngonidzashe',
  'Munyaradzi','Mthokozisi','Mqondisi','Luckson','Kudzanai',
];

const FIRST_NAMES_F = [
  'Rudo','Chipo','Nyasha','Tariro','Rumbidzai','Vimbai','Rutendo',
  'Fadzai','Nyaradzo','Tanyaradzwa','Anesu','Chiedza','Danai','Kudzai',
  'Precious','Memory','Grace','Faith','Hope','Patience','Mercy',
  'Charity','Beauty','Praise','Joy','Tafadzwa',
  'Tendai','Thandiwe','Thandeka','Sibongile','Sithembile',
  'Priscilla','Nyari','Nyarai',
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
  'Mudzuri','Chibaya','Mliswa','Matemadanda','Ndebele',
  'Dlodlo','Mabuza','Ziyambi','Musabayana','Mhona',
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

const EMPLOYEE_DEPARTMENTS = [
  'Medical','Nurses','Pharmacy','Laboratory','Admin',
  'Support','Maintenance','Security',
];

const ROLES_BY_DEPT = {
  Medical:     ['Doctor','Consultant','Medical Officer','Intern'],
  Nurses:      ['Registered Nurse','Enrolled Nurse','Nurse Aide','Sister','Matron'],
  Pharmacy:    ['Pharmacist','Pharmacy Technician','Pharmacy Assistant'],
  Laboratory:  ['Lab Scientist','Lab Technician','Lab Assistant'],
  Admin:       ['Clerk','Administrator','Receptionist','Data Entry Officer'],
  Support:     ['Cleaner','Porter','Laundry Staff','Catering'],
  Maintenance: ['Technician','Electrician','Plumber','Handyman'],
  Security:    ['Guard','Security Officer','Gate Officer'],
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
  'Absenteeism','Late arrival','Insubordination','Negligence','Misconduct',
  'Theft','Substance abuse','Harassment','Patient mistreatment',
  'Breach of confidentiality','Falsification of records','Other',
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
    return pick(['Verbal warning','Written warning','Final written warning','Suspension','Demotion','Termination','Counselling']);
  }
  if (status === 'dismissed') {
    return pick(['No action','Counselling']);
  }
  return null;
}

// ============================================================
// PROJECT SAMPLES — diversified with phase progression
// ============================================================

const PROJECT_SAMPLES = [
  {
    name: 'CCTV installation - Phase 2',
    description: 'Install 12 new CCTV cameras covering the main corridor, pharmacy entrance, and maternity ward waiting area.',
    department: 'IT',
    projectHead: 'IT Manager',
    startOffsetDays: 45,
    targetOffsetDays: 15,
    createdBy: 'IT Manager',
    phases: [
      { offsetDays: 45, status: 'ongoing',  note: 'Project initiated at IT committee. Scope defined for 12 cameras across 3 zones.', actionTaken: 'Scope document approved' },
      { offsetDays: 32, status: 'pending',  note: 'Waiting on supplier quote from SecureVision Pvt Ltd.', obstacleReason: 'Awaiting formal quotation from SecureVision', actionTaken: 'RFQ sent to 3 suppliers' },
      { offsetDays: 20, status: 'ongoing',  note: 'Supplier selected (SecureVision). Cabling underway in main corridor.', actionTaken: 'Signed supply agreement' },
      { offsetDays: 8,  status: 'ongoing',  note: 'Cabling complete in main corridor. Cameras delivered. Installation in progress.', actionTaken: '3 of 12 cameras installed' },
      { offsetDays: 2,  status: 'ongoing',  note: 'Installation 60% complete. Power supply to pharmacy entrance pending.', actionTaken: '8 of 12 cameras installed' },
    ],
  },
  {
    name: 'Patient ID card system upgrade',
    description: 'Roll out new patient ID card system with barcodes for faster admission and file retrieval.',
    department: 'Nurses',
    projectHead: 'Sister Mutsa',
    startOffsetDays: 40,
    targetOffsetDays: 25,
    createdBy: 'Sister Mutsa',
    phases: [
      { offsetDays: 40, status: 'ongoing', note: 'Project initiated at nurses meeting. Budget approved by hospital board.', actionTaken: 'Board approval received' },
      { offsetDays: 25, status: 'ongoing', note: 'Scanners ordered and delivered to IT.', actionTaken: 'Hardware delivered' },
      { offsetDays: 10, status: 'pending', note: 'Scanners delivered but firmware not configured. Blocked on IT.', obstacleReason: 'Waiting for IT to configure barcode scanner firmware', actionTaken: 'Escalated to IT Manager' },
      { offsetDays: 3,  status: 'pending', note: 'Firmware still pending. IT committed to delivery by end of week.', obstacleReason: 'IT firmware configuration delayed - scheduled for Friday', actionTaken: 'Followed up with IT twice this week' },
    ],
  },
  {
    name: 'Ward A painting and repairs',
    description: 'Repaint Ward A walls, replace 4 broken beds, and fix leaking ceiling in the west corner.',
    department: 'Maintenance',
    projectHead: 'Maintenance Supervisor',
    startOffsetDays: 35,
    targetOffsetDays: 5,
    createdBy: 'HR Manager',
    phases: [
      { offsetDays: 35, status: 'ongoing', note: 'Project started. Painting east wing. Beds ordered.', actionTaken: 'Painting supplies procured' },
      { offsetDays: 15, status: 'ongoing', note: 'Painting 50% done. Beds delivered but awaiting assembly.', actionTaken: 'Half of east wing painted' },
      { offsetDays: 4,  status: 'ongoing', note: 'Painting 85% done. Three of four beds assembled. Ceiling leak scheduled for repair this week.', actionTaken: '3 of 4 beds assembled' },
    ],
  },
  {
    name: 'Staff wellness programme',
    description: 'Introduce quarterly wellness check-ups and counselling service for all staff members.',
    department: 'HR',
    projectHead: 'HR Manager',
    startOffsetDays: 60,
    targetOffsetDays: 60,
    createdBy: 'HR Manager',
    phases: [
      { offsetDays: 60, status: 'ongoing', note: 'Programme approved by hospital board. Budget allocated.', actionTaken: 'Board approval' },
      { offsetDays: 40, status: 'ongoing', note: 'Counsellor contracted. First wellness day scheduled.', actionTaken: 'Signed MOU with counsellor' },
      { offsetDays: 12, status: 'ongoing', note: 'First wellness day held. 47 staff screened, 8 referrals made.', actionTaken: '47 staff attended' },
      { offsetDays: 3,  status: 'ongoing', note: 'Second wellness day scheduled for next month. Counselling sessions booked.', actionTaken: 'Next session: 15 Nov' },
    ],
  },
  {
    name: 'Pharmacy stock reconciliation',
    description: 'Full physical inventory count and reconciliation against system records for pharmacy.',
    department: 'Pharmacy',
    projectHead: 'Pharmacist Lisa',
    startOffsetDays: 30,
    targetOffsetDays: 0,
    createdBy: 'Store Manager',
    phases: [
      { offsetDays: 30, status: 'ongoing', note: 'Count started. Two-person team assigned.', actionTaken: 'Team briefed' },
      { offsetDays: 15, status: 'ongoing', note: 'Count complete. Reconciling discrepancies in controlled substances.', actionTaken: 'Physical count done' },
      { offsetDays: 1,  status: 'completed', note: 'Reconciliation complete. Discrepancies logged and corrected. Final report submitted.', actionTaken: 'Report submitted to Stores' },
    ],
  },
  {
    name: 'Laboratory equipment servicing',
    description: 'Annual servicing of all laboratory analyzers and microscopes, plus calibration.',
    department: 'Laboratory',
    projectHead: 'Lab Tech Tom',
    startOffsetDays: 25,
    targetOffsetDays: 10,
    createdBy: 'Lab Tech Tom',
    phases: [
      { offsetDays: 25, status: 'ongoing', note: 'Servicing contract signed with BioMed Services.', actionTaken: 'Contract signed' },
      { offsetDays: 14, status: 'ongoing', note: 'Two analyzers serviced. Microscope calibration scheduled.', actionTaken: 'Partial servicing done' },
      { offsetDays: 5,  status: 'ongoing', note: 'Four of five instruments serviced. Final instrument in use, service pending.', actionTaken: '4 of 5 serviced' },
    ],
  },
  {
    name: 'Medical records digitisation',
    description: 'Scan and digitise 5 years of paper patient records for electronic access.',
    department: 'Admin',
    projectHead: 'Admin Clerk Jane',
    startOffsetDays: 90,
    targetOffsetDays: 90,
    createdBy: 'Admin Clerk Jane',
    phases: [
      { offsetDays: 90, status: 'ongoing', note: 'Project approved. Supplier contacted.', actionTaken: 'Approval received' },
      { offsetDays: 60, status: 'ongoing', note: 'Purchase order raised. Waiting for delivery of scanning hardware.', actionTaken: 'PO issued to supplier' },
      { offsetDays: 30, status: 'pending', note: 'Delivery delayed. Warehouse backlog at supplier.', obstacleReason: 'Scanner hardware not yet delivered by supplier', actionTaken: 'Followed up with supplier twice' },
      { offsetDays: 10, status: 'pending', note: 'Supplier confirmed dispatch next Monday. ETA 2 weeks.', obstacleReason: 'Awaiting final delivery from supplier (ETA 2 weeks)', actionTaken: 'Confirmed dispatch date with supplier' },
    ],
  },
  {
    name: 'Security gate access control',
    description: 'Replace manual gate logs with electronic access control system at staff entrance.',
    department: 'Security',
    projectHead: 'Security Guard Sam',
    startOffsetDays: 50,
    targetOffsetDays: 10,
    createdBy: 'Security Guard Sam',
    phases: [
      { offsetDays: 50, status: 'ongoing', note: 'System selected. Supplier is AccessTech Pvt Ltd.', actionTaken: 'Vendor selected' },
      { offsetDays: 30, status: 'ongoing', note: 'Hardware installed. Staff card issuance in progress.', actionTaken: '150 of 300 cards issued' },
      { offsetDays: 6,  status: 'ongoing', note: '250 of 300 cards issued. Remaining staff scheduled this week.', actionTaken: '250 of 300 cards issued' },
    ],
  },
  {
    name: 'Ward B linen replacement',
    description: 'Replace 200 sets of worn bed linen across Ward B.',
    department: 'Support',
    projectHead: 'Support Supervisor',
    startOffsetDays: 45,
    targetOffsetDays: 0,
    createdBy: 'Sister Mutsa',
    phases: [
      { offsetDays: 45, status: 'ongoing', note: 'Order placed with linen supplier.', actionTaken: 'PO issued' },
      { offsetDays: 20, status: 'ongoing', note: 'Linen received and being distributed to Ward B.', actionTaken: '50% distributed' },
      { offsetDays: 2,  status: 'completed', note: 'All 200 sets deployed to Ward B. Old linen removed and disposed.', actionTaken: '200 sets deployed' },
    ],
  },
  {
    name: 'ICU ventilator maintenance',
    description: 'Preventive maintenance and calibration of all ICU ventilators.',
    department: 'Medical',
    projectHead: 'Dr. James Mwale',
    startOffsetDays: 22,
    targetOffsetDays: 8,
    createdBy: 'Dr. James Mwale',
    phases: [
      { offsetDays: 22, status: 'ongoing', note: 'Biomedical engineer scheduled. Ventilators marked for service.', actionTaken: 'Engineer booked' },
      { offsetDays: 10, status: 'ongoing', note: 'First ventilator serviced and returned to service.', actionTaken: '1 of 6 serviced' },
      { offsetDays: 4,  status: 'ongoing', note: '4 of 6 ventilators serviced. Remaining 2 in use, service pending.', actionTaken: 'Partial service complete' },
    ],
  },
  {
    name: 'Nurses training - infection control',
    description: 'Refresher training for all nurses on infection control protocols.',
    department: 'Nurses',
    projectHead: 'Nurse Tatenda',
    startOffsetDays: 40,
    targetOffsetDays: 30,
    createdBy: 'Nurse Tatenda',
    phases: [
      { offsetDays: 40, status: 'ongoing', note: 'Training curriculum finalised. Sessions scheduled.', actionTaken: 'Curriculum approved' },
      { offsetDays: 25, status: 'ongoing', note: 'First batch of 20 nurses trained.', actionTaken: '20 of 80 nurses trained' },
      { offsetDays: 8,  status: 'ongoing', note: '45 of 80 nurses trained. Second batch underway.', actionTaken: '45 of 80 trained' },
    ],
  },
  {
    name: 'Emergency generator servicing',
    description: 'Full service of backup generators including fuel system and electrical panel check.',
    department: 'Maintenance',
    projectHead: 'Maintenance Bob',
    startOffsetDays: 55,
    targetOffsetDays: -5,
    createdBy: 'Maintenance Bob',
    phases: [
      { offsetDays: 55, status: 'ongoing', note: 'Generator 1 and 2 scheduled for service.', actionTaken: 'Contractor booked' },
      { offsetDays: 30, status: 'ongoing', note: 'Generator 1 serviced, tested under load.', actionTaken: 'Generator 1 complete' },
      { offsetDays: 5,  status: 'completed', note: 'Both generators serviced, tested under load. Certificates issued.', actionTaken: 'Full service complete' },
    ],
  },
  {
    name: 'Ward C furniture procurement',
    description: 'Procure and install 30 hospital beds and 15 bedside cabinets for Ward C.',
    department: 'Procurement',
    projectHead: 'Procurement Officer',
    startOffsetDays: 25,
    targetOffsetDays: 45,
    createdBy: 'Procurement Officer',
    phases: [
      { offsetDays: 25, status: 'ongoing',  note: 'Tender published. 4 suppliers invited.', actionTaken: 'Tender issued' },
      { offsetDays: 15, status: 'pending',  note: 'Awaiting quotation from 2 suppliers.', obstacleReason: 'Two suppliers have not yet submitted quotes', actionTaken: 'Reminder sent' },
      { offsetDays: 6,  status: 'ongoing',  note: 'Quotations received. Evaluation committee meeting scheduled.', actionTaken: 'All quotes received' },
    ],
  },
  {
    name: 'Pharmacy refrigeration upgrade',
    description: 'Upgrade vaccine refrigeration units to meet new cold-chain standards.',
    department: 'Pharmacy',
    projectHead: 'Pharmacist Lisa',
    startOffsetDays: 60,
    targetOffsetDays: 30,
    createdBy: 'Pharmacist Lisa',
    phases: [
      { offsetDays: 60, status: 'ongoing', note: 'Cold-chain audit identified 2 units needing replacement.', actionTaken: 'Audit complete' },
      { offsetDays: 40, status: 'ongoing', note: 'Supplier selected. Order placed for 2 pharmaceutical-grade fridges.', actionTaken: 'Order placed' },
      { offsetDays: 15, status: 'ongoing', note: 'Units delivered. Installation and temperature validation scheduled.', actionTaken: 'Units delivered' },
      { offsetDays: 3,  status: 'ongoing', note: 'Both units installed and running. Validation tests in progress.', actionTaken: 'Installation complete' },
    ],
  },
  {
    name: 'IT network switch replacement',
    description: 'Replace aging network switches in admin block to resolve intermittent connectivity.',
    department: 'IT',
    projectHead: 'IT Manager',
    startOffsetDays: 20,
    targetOffsetDays: 15,
    createdBy: 'IT Manager',
    phases: [
      { offsetDays: 20, status: 'ongoing',  note: 'Network audit identified 3 switches past end-of-life.', actionTaken: 'Audit complete' },
      { offsetDays: 8,  status: 'pending',  note: 'Awaiting procurement approval for 3 Cisco switches.', obstacleReason: 'Procurement approval pending - submitted 8 days ago', actionTaken: 'Escalated to Procurement' },
      { offsetDays: 2,  status: 'ongoing',  note: 'Approval received. Purchase order issued. Delivery expected next week.', actionTaken: 'PO issued to supplier' },
    ],
  },
  {
    name: 'Maternity ward breastfeeding support',
    description: 'Establish peer breastfeeding support programme with trained counsellors.',
    department: 'Nurses',
    projectHead: 'Sister Mutsa',
    startOffsetDays: 50,
    targetOffsetDays: 40,
    createdBy: 'Sister Mutsa',
    phases: [
      { offsetDays: 50, status: 'ongoing', note: 'Programme approved. 4 peer counsellors recruited.', actionTaken: 'Counsellors selected' },
      { offsetDays: 30, status: 'ongoing', note: 'Counsellor training complete. Programme launch set for next month.', actionTaken: 'Training complete' },
      { offsetDays: 5,  status: 'ongoing', note: 'Programme launched. 12 mothers enrolled in first week.', actionTaken: '12 mothers enrolled' },
    ],
  },
  {
    name: 'Laboratory information system integration',
    description: 'Integrate lab results with patient records for faster clinical decisions.',
    department: 'Laboratory',
    projectHead: 'Lab Tech Tom',
    startOffsetDays: 35,
    targetOffsetDays: 55,
    createdBy: 'Lab Tech Tom',
    phases: [
      { offsetDays: 35, status: 'ongoing',  note: 'Requirements gathering with IT and clinical staff.', actionTaken: 'Requirements documented' },
      { offsetDays: 20, status: 'pending',  note: 'Waiting for IT to confirm API integration timeline.', obstacleReason: 'IT API integration timeline pending', actionTaken: 'Follow-up sent to IT' },
      { offsetDays: 7,  status: 'ongoing',  note: 'IT confirmed API integration will begin next sprint.', actionTaken: 'Timeline confirmed' },
    ],
  },
  {
    name: 'Ward C staffing plan',
    description: 'Review and update staffing levels for Ward C to match patient load.',
    department: 'HR',
    projectHead: 'HR Manager',
    startOffsetDays: 30,
    targetOffsetDays: 20,
    createdBy: 'HR Manager',
    phases: [
      { offsetDays: 30, status: 'ongoing', note: 'Patient load analysis completed. Staffing gaps identified.', actionTaken: 'Data analysis complete' },
      { offsetDays: 15, status: 'ongoing', note: 'Draft staffing plan submitted to hospital management.', actionTaken: 'Draft plan submitted' },
      { offsetDays: 4,  status: 'ongoing', note: 'Plan approved. Recruitment for 3 new positions starting next week.', actionTaken: 'Plan approved by board' },
    ],
  },
  {
    name: 'Hospital waste management upgrade',
    description: 'Upgrade waste segregation and disposal protocols across all wards.',
    department: 'Support',
    projectHead: 'Support Supervisor',
    startOffsetDays: 45,
    targetOffsetDays: 30,
    createdBy: 'Support Supervisor',
    phases: [
      { offsetDays: 45, status: 'ongoing', note: 'Waste audit completed. New segregation bins ordered.', actionTaken: 'Audit complete' },
      { offsetDays: 25, status: 'ongoing', note: 'Bins delivered. Staff training on new protocols underway.', actionTaken: 'Bins delivered' },
      { offsetDays: 6,  status: 'ongoing', note: 'Training 80% complete. First weekly compliance check performed.', actionTaken: 'Training ongoing' },
    ],
  },
];

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

// For "loaded today" records — clamp to today at a random hour between 8am-6pm.
function todayAtHour(hourStart = 8, hourEnd = 18) {
  const d = new Date();
  const hours = hourStart + Math.floor(Math.random() * (hourEnd - hourStart));
  const minutes = Math.floor(Math.random() * 60);
  const seconds = Math.floor(Math.random() * 60);
  d.setHours(hours, minutes, seconds, 0);
  return d;
}

function dateOffsetDays(offset) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
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
    // Clear all tables in dependency order.
    console.log('Clearing existing data...');
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

    // Wards.
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

    // Users.
    console.log('Creating users...');
    const users = [
      { username: 'nurse1',       password: 'nurse123',  fullName: 'Sister Mutsa',          department: 'Nurses',      role: 'staff', wardId: wards[0].id },
      { username: 'nurse2',       password: 'nurse123',  fullName: 'Nurse Tatenda',         department: 'Nurses',      role: 'staff', wardId: wards[1].id },
      { username: 'it1',          password: 'it123',     fullName: 'IT Manager',            department: 'IT',          role: 'admin', wardId: null },
      { username: 'it2',          password: 'it123',     fullName: 'IT Support Officer',    department: 'IT',          role: 'staff', wardId: null },
      { username: 'procurement1', password: 'proc123',   fullName: 'Procurement Officer',   department: 'Procurement', role: 'staff', wardId: null },
      { username: 'procurement2', password: 'proc123',   fullName: 'Procurement Assistant', department: 'Procurement', role: 'staff', wardId: null },
      { username: 'stores1',      password: 'store123',  fullName: 'Store Manager',         department: 'Stores',      role: 'staff', wardId: null },
      { username: 'stores2',      password: 'store123',  fullName: 'Store Clerk',           department: 'Stores',      role: 'staff', wardId: null },
      { username: 'hr1',          password: 'hr123',     fullName: 'HR Manager',            department: 'HR',          role: 'staff', wardId: null },
      { username: 'hr2',          password: 'hr123',     fullName: 'HR Officer',            department: 'HR',          role: 'staff', wardId: null },
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

    // Employees.
    console.log('Creating 1000 employees...');
    const TOTAL_EMPLOYEES = 1000;
    const EMPLOYEE_DAYS_SPAN = 1825;
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
          data: { name, department, role, wardId, status, hireDate, terminationDate },
        });

        await prisma.employeeStatusLog.create({
          data: { employeeId: employee.id, oldStatus: 'new', newStatus: status, changedBy: 'Seed Script' },
        });

        empCreated++;
        if (empCreated % 200 === 0) console.log('  ' + empCreated + ' / ' + TOTAL_EMPLOYEES);
      } catch (e) {
        console.error('  Skipped one employee:', e.message);
      }
    }
    console.log('  Employees created: ' + empCreated);

    // Patients — first 20 force "today" admission, first 5 discharged force today discharge.
    console.log('Creating 1000 patients...');
    const TOTAL_PATIENTS = 1000;
    const PATIENT_DAYS_SPAN = 90;
    let patCreated = 0;

    for (let i = 0; i < TOTAL_PATIENTS; i++) {
      const gender = Math.random() < 0.5 ? 'M' : 'F';
      const firstName = gender === 'M' ? pick(FIRST_NAMES_M) : pick(FIRST_NAMES_F);
      const surname = pick(SURNAMES);
      const name = firstName + ' ' + surname;

      const forceToday = i < 20;
      const daysAgo = forceToday ? 0 : Math.floor(Math.random() * PATIENT_DAYS_SPAN);
      const admissionDate = forceToday ? todayAtHour(8, 18) : randomDateWithinDays(daysAgo);
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

        // First 5 discharged → force today's discharge
        if (i < 5) {
          dischargeDate = todayAtHour(8, 18);
        } else {
          dischargeDate = dischargeCandidate <= new Date() ? dischargeCandidate : new Date();
        }

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
            nextReviewDate, reviewDepartment, patientInstructions,
            causeOfDeath,
          },
        });

        await prisma.statusLog.create({
          data: { patientId: patient.id, oldStatus: 'new', newStatus: status, changedBy: 'Seed Script' },
        });

        patCreated++;
        if (patCreated % 200 === 0) console.log('  ' + patCreated + ' / ' + TOTAL_PATIENTS);
      } catch (e) {
        console.error('  Skipped one patient:', e.message);
      }
    }
    console.log('  Patients created: ' + patCreated);

    // Inventory.
    console.log('Creating inventory items...');
    const inventoryItems = [
      { name: 'Medical Gloves (Box)',    quantity: 150, unit: 'boxes',  category: 'PPE' },
      { name: 'Surgical Masks (Box)',    quantity: 200, unit: 'boxes',  category: 'PPE' },
      { name: 'N95 Respirators (Box)',   quantity: 45,  unit: 'boxes',  category: 'PPE' },
      { name: 'Face Shields',            quantity: 30,  unit: 'pieces', category: 'PPE' },
      { name: 'Syringes 5ml (Pack)',     quantity: 80,  unit: 'packs',  category: 'Consumables' },
      { name: 'Bandages (Roll)',         quantity: 45,  unit: 'rolls',  category: 'Consumables' },
      { name: 'IV Drip Sets',            quantity: 60,  unit: 'sets',   category: 'Consumables' },
      { name: 'Antiseptic Solution (L)', quantity: 25,  unit: 'liters', category: 'Consumables' },
      { name: 'Paracetamol 500mg (Box)', quantity: 120, unit: 'boxes',  category: 'Pharmaceuticals' },
      { name: 'Antibiotics (Box)',       quantity: 35,  unit: 'boxes',  category: 'Pharmaceuticals' },
      { name: 'Thermometers',            quantity: 8,   unit: 'pieces', category: 'Equipment' },
      { name: 'Wheelchairs',             quantity: 5,   unit: 'pieces', category: 'Equipment' },
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

    // Tenders — first 3 forced today.
    console.log('Creating sample tender requests...');
    const orderRequests = [
      // Forced-today tenders
      { requestingDepartment: 'Nurses',      originatorDepartment: 'Nurses',      requestingBy: 'Sister Mutsa',        itemName: 'Surgical Gloves (Box)',  quantity: 40,  reason: 'Ward stock depleted after weekend admissions', status: 'pending',            createdAt: todayAtHour(9, 15) },
      { requestingDepartment: 'IT',          originatorDepartment: 'IT',          requestingBy: 'IT Manager',          itemName: 'Network Cables',          quantity: 30,  reason: 'Replacing damaged cables in admin block',      status: 'ordered',            createdAt: todayAtHour(8, 14) },
      { requestingDepartment: 'HR',          originatorDepartment: 'HR',          requestingBy: 'HR Manager',          itemName: 'Recruitment Pack',        quantity: 25,  reason: 'Interview materials for new hires',           status: 'awaiting_quotation', createdAt: todayAtHour(10, 16) },

      // Older tenders (varied status)
      { requestingDepartment: 'Nurses',      originatorDepartment: 'Nurses',      requestingBy: 'Sister Mutsa',        itemName: 'Medical Gloves (Box)',   quantity: 50,  reason: 'Running low on stock',                                       status: 'pending' },
      { requestingDepartment: 'IT',          originatorDepartment: 'Nurses',      requestingBy: 'IT Manager',          itemName: 'Nurse Tablets',          quantity: 20,  reason: 'Computerised nurse registry - requested on behalf of Nurses', status: 'pending' },
      { requestingDepartment: 'Nurses',      originatorDepartment: 'Nurses',      requestingBy: 'Nurse Tatenda',       itemName: 'Surgical Masks (Box)',   quantity: 100, reason: 'Monthly restock',                                            status: 'ordered' },
      { requestingDepartment: 'Procurement', originatorDepartment: 'Procurement', requestingBy: 'Procurement Officer', itemName: 'Office Chairs',          quantity: 10,  reason: 'Replacing broken furniture',                                 status: 'awaiting_quotation' },
      { requestingDepartment: 'HR',          originatorDepartment: 'HR',          requestingBy: 'HR Manager',          itemName: 'Filing Cabinets',        quantity: 5,   reason: 'New staff records require additional storage',              status: 'received' },
      { requestingDepartment: 'Stores',      originatorDepartment: 'Stores',      requestingBy: 'Store Manager',       itemName: 'Shelf Labels',           quantity: 200, reason: 'Reorganising inventory shelves',                             status: 'completed' },
    ];

    for (const order of orderRequests) {
      await prisma.orderRequest.create({ data: order });
    }
    console.log('  Created ' + orderRequests.length + ' sample tenders');

    // Disciplinary cases — first 4 forced today with mixed statuses.
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

        // First 4 cases forced to today with mixed statuses
        let daysAgo;
        let status;
        if (i < 4) {
          daysAgo = 0;
          status = i === 0 ? 'open'
                 : i === 1 ? 'under_investigation'
                 : i === 2 ? 'resolved'
                 : 'open';
        } else {
          daysAgo = Math.floor(Math.random() * DISC_DAYS_SPAN);
          status = pickDisciplinaryStatus(daysAgo);
        }
        const reportedDate = daysAgo === 0 ? todayAtHour(8, 17) : randomDateWithinDays(daysAgo, 8, 17);

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
              reportedBy: pick(['Ward Supervisor','Senior Nurse','Department Head','Shift Coordinator','Colleague']),
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
            data: { caseId: record.id, oldStatus: 'new', newStatus: 'open', changedBy: 'System', notes: 'Case filed' },
          });

          if (status !== 'open') {
            await prisma.disciplinaryStatusLog.create({
              data: { caseId: record.id, oldStatus: 'open', newStatus: status, changedBy: 'HR Manager', notes: 'Status updated to ' + status },
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

    // Establishment targets.
    console.log('Creating establishment targets...');
    const establishmentTargets = [
      { department: 'Medical',     minHeadcount: 10,  maxHeadcount: 50  },
      { department: 'Nurses',      minHeadcount: 150, maxHeadcount: 250 },
      { department: 'Pharmacy',    minHeadcount: 5,   maxHeadcount: 15  },
      { department: 'Laboratory',  minHeadcount: 5,   maxHeadcount: 20  },
      { department: 'Admin',       minHeadcount: 10,  maxHeadcount: 30  },
      { department: 'Support',     minHeadcount: 20,  maxHeadcount: 60  },
      { department: 'Maintenance', minHeadcount: 3,   maxHeadcount: 10  },
      { department: 'Security',    minHeadcount: 5,   maxHeadcount: 15  },
    ];
    for (const t of establishmentTargets) {
      await prisma.establishmentTarget.create({ data: t });
    }
    console.log('  Created ' + establishmentTargets.length + ' establishment targets');

    // Movements — first 5 forced today with type variety.
    console.log('Creating sample employee movements...');
    const sampleEmployeesForMovement = await prisma.employee.findMany({
      select: { id: true, name: true, department: true, wardId: true, hireDate: true },
      take: 100,
    });

    if (sampleEmployeesForMovement.length > 0) {
      const TOTAL_MOVEMENTS = 30;
      const DEPARTMENTS = ['Medical','Nurses','Pharmacy','Laboratory','Admin','Support','Maintenance','Security'];
      const RESIGNATION_REASONS = [
        'Better opportunity elsewhere','Relocation','Health reasons',
        'Family reasons','Further studies','Salary dissatisfaction',
      ];
      let movementCount = 0;

      for (let i = 0; i < TOTAL_MOVEMENTS; i++) {
        const emp = sampleEmployeesForMovement[Math.floor(Math.random() * sampleEmployeesForMovement.length)];

        const forceTodayMovement = i < 5;
        const daysAgo = forceTodayMovement ? 0 : Math.floor(Math.random() * 90);

        let date;
        if (forceTodayMovement) {
          date = todayAtHour(8, 17);
        } else {
          date = new Date();
          date.setDate(date.getDate() - daysAgo);
        }

        let movementData = {
          employeeId: emp.id,
          approvedBy: 'HR Manager',
          effectiveDate: date,
          createdAt: date,
        };

        // First 5 movements → force type to guarantee variety today
        let typeRoll = Math.random();
        if (forceTodayMovement) {
          typeRoll = i < 2 ? 0.1   // transfer
                   : i < 4 ? 0.6   // retirement
                   : 0.9;          // resignation
        }

        if (typeRoll < 0.5) {
          movementData.movementType = 'transfer';
          movementData.fromDepartment = emp.department;
          movementData.fromWardId = emp.wardId;
          movementData.toDepartment = DEPARTMENTS[Math.floor(Math.random() * DEPARTMENTS.length)];
          movementData.reason = 'Operational requirement';
        } else if (typeRoll < 0.75) {
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
          movementData.reason = RESIGNATION_REASONS[Math.floor(Math.random() * RESIGNATION_REASONS.length)];
          movementData.exitInterviewDone = Math.random() < 0.6;
          movementData.eligibleForRehire = Math.random() < 0.7;
        }

        try {
          await prisma.employeeMovement.create({ data: movementData });
          movementCount++;
        } catch (e) {
          console.error('  Skipped one movement:', e.message);
        }
      }
      console.log('  Created ' + movementCount + ' sample movements');
    }

    // Projects.
    console.log('Creating projects with phase history...');
    let projectCount = 0;
    let updateCount = 0;

    for (const sample of PROJECT_SAMPLES) {
      try {
        const lastPhase = sample.phases[sample.phases.length - 1];
        const currentStatus = lastPhase.status;

        const project = await prisma.project.create({
          data: {
            name: sample.name,
            description: sample.description,
            department: sample.department,
            projectHead: sample.projectHead,
            status: currentStatus,
            startDate: dateOffsetDays(-sample.startOffsetDays),
            targetDate: dateOffsetDays(sample.targetOffsetDays),
            obstacleReason: currentStatus === 'pending' ? lastPhase.obstacleReason : null,
            createdBy: sample.createdBy,
            createdAt: dateOffsetDays(-sample.startOffsetDays),
            updatedAt: dateOffsetDays(-lastPhase.offsetDays),
          },
        });
        projectCount++;

        for (const phase of sample.phases) {
          await prisma.projectUpdate.create({
            data: {
              projectId: project.id,
              note: phase.note,
              statusAtUpdate: phase.status,
              obstacleReason: phase.status === 'pending' ? phase.obstacleReason : null,
              actionTaken: phase.actionTaken || null,
              updatedBy: sample.projectHead,
              timestamp: dateOffsetDays(-phase.offsetDays),
            },
          });
          updateCount++;
        }
      } catch (e) {
        console.error('  Skipped one project:', e.message);
      }
    }

    // Post-pass: force a "today" update on the first 3 ongoing projects
    // so the Live Board "projects this week" widget is always populated.
    const ongoingProjects = await prisma.project.findMany({
      where: { status: 'ongoing' },
      take: 3,
      orderBy: { createdAt: 'desc' },
    });

    for (const proj of ongoingProjects) {
      const todayStamp = todayAtHour(8, 12);
      await prisma.projectUpdate.create({
        data: {
          projectId: proj.id,
          note: 'Daily progress update: work continues as scheduled.',
          statusAtUpdate: 'ongoing',
          obstacleReason: null,
          actionTaken: 'Routine progress logged today',
          updatedBy: proj.projectHead,
          timestamp: todayStamp,
        },
      });
      await prisma.project.update({
        where: { id: proj.id },
        data: { updatedAt: todayStamp },
      });
      updateCount++;
    }
    console.log('  Added today updates to ' + ongoingProjects.length + ' ongoing projects');
    console.log('  Created ' + projectCount + ' projects with ' + updateCount + ' phase updates');

    // Summary.
    console.log('');
    console.log('Database seeded successfully.');
    console.log('');

    const totalPatients       = await prisma.patient.count();
    const totalEmployees      = await prisma.employee.count();
    const totalUsers          = await prisma.user.count();
    const totalCases          = await prisma.disciplinaryCase.count();
    const totalMovements      = await prisma.employeeMovement.count();
    const totalTargets        = await prisma.establishmentTarget.count();
    const totalProjects       = await prisma.project.count();
    const totalProjectUpdates = await prisma.projectUpdate.count();

    console.log('Totals:');
    console.log('  Patients: '              + totalPatients);
    console.log('  Employees: '             + totalEmployees);
    console.log('  Users: '                 + totalUsers);
    console.log('  Disciplinary cases: '    + totalCases);
    console.log('  Movements: '             + totalMovements);
    console.log('  Establishment targets: ' + totalTargets);
    console.log('  Projects: '              + totalProjects);
    console.log('  Project updates: '       + totalProjectUpdates);
    console.log('');

    const patientStatuses = ['admitted', 'treatment', 'discharged', 'deceased'];
    console.log('Patient status breakdown:');
    for (const s of patientStatuses) {
      const count = await prisma.patient.count({ where: { status: s } });
      console.log('  ' + s + ': ' + count);
    }
    console.log('');

    const empStatuses = ['active', 'on_leave', 'sick', 'terminated'];
    console.log('Employee status breakdown:');
    for (const s of empStatuses) {
      const count = await prisma.employee.count({ where: { status: s } });
      console.log('  ' + s + ': ' + count);
    }
    console.log('');

    const discStatuses = ['open', 'under_investigation', 'resolved', 'dismissed'];
    console.log('Disciplinary status breakdown:');
    for (const s of discStatuses) {
      const count = await prisma.disciplinaryCase.count({ where: { status: s } });
      console.log('  ' + s + ': ' + count);
    }
    console.log('');

    const projStatuses = ['ongoing', 'pending', 'completed'];
    console.log('Project status breakdown:');
    for (const s of projStatuses) {
      const count = await prisma.project.count({ where: { status: s } });
      console.log('  ' + s + ': ' + count);
    }
    console.log('');

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentUpdates = await prisma.projectUpdate.findMany({
      where: { timestamp: { gte: sevenDaysAgo } },
      select: { projectId: true },
      distinct: ['projectId'],
    });
    console.log('Projects with activity in last 7 days: ' + recentUpdates.length + ' / ' + totalProjects);
    console.log('');

    console.log('Test credentials:');
    console.log('  Nurses:      nurse1 / nurse123');
    console.log('  Nurses:      nurse2 / nurse123');
    console.log('  IT:          it1 / it123');
    console.log('  IT:          it2 / it123');
    console.log('  Procurement: procurement1 / proc123');
    console.log('  Procurement: procurement2 / proc123');
    console.log('  Stores:      stores1 / store123');
    console.log('  Stores:      stores2 / store123');
    console.log('  HR:          hr1 / hr123');
    console.log('  HR:          hr2 / hr123');
    console.log('  Super Admin: Admin / (your configured password)');
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
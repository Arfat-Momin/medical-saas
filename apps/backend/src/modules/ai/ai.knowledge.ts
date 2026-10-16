/**
 * Complete System Knowledge Base for the Hospital ERP SaaS.
 * Covers every module: Patients, Appointments, Consultations, Laboratory,
 * IPD & Pricing, Pharmacy & Stock, Billing & Invoices, Finance & Cash Closing,
 * Roles, Branches, Departments, and Offline Sync.
 */

export interface SystemGuide {
  topic: string;
  keywords: string[];
  route: string;
  requiredRole?: string;
  summary: string;
  steps: string[];
}

export const SYSTEM_GUIDES: SystemGuide[] = [
  // ─────────────────────────────────────────────────────────────
  // 1. PATIENT MANAGEMENT
  // ─────────────────────────────────────────────────────────────
  {
    topic: 'Add / Register a New Patient',
    keywords: [
      'patient', 'register', 'add patient', 'new patient', 'uhid', 'registration',
      'create patient', 'patient registration', 'register patient', 'enroll patient',
      'patient entry', 'patient form', 'new registration',
    ],
    route: '/patients',
    summary: 'Registering a patient creates a unique UHID (Unique Hospital Identification) and initiates their medical profile.',
    steps: [
      'Click on "Patients" in the left navigation sidebar (or go to /patients).',
      'Click the "+ New patient" button in the top right corner.',
      'Fill in the Patient Demographics: Full Name, Date of Birth / Age, Gender, and Mobile Number.',
      'Optional: Enter Blood Group, Known Allergies, Medical History, and Emergency Contact details.',
      'Insurance & Policy Coverage: Select coverage type (None, Government Policy, Mediclaim, Swasthya Sathi, etc.) and policy number if insured.',
      'Registration Fee & Receipt: Enter registration amount and payment mode (Cash, UPI, Card) if your hospital charges an initial registration fee.',
      'Click "Save Patient". The system automatically generates a unique UHID and redirects you to the patient record.',
      'Tip: You can upload identity documents or past medical records in the "Attachments" tab of the patient detail page.',
    ],
  },
  {
    topic: 'Search & View Patient Records',
    keywords: [
      'search patient', 'find patient', 'view patient', 'patient detail', 'patient history',
      'patient record', 'patient list', 'lookup patient', 'patient info',
    ],
    route: '/patients',
    summary: 'Search for patients by name, mobile number, or UHID and view their complete medical profile.',
    steps: [
      'Go to "Patients" (/patients) from the left sidebar.',
      'Use the search bar at the top to search by Patient Name, Mobile Number, or UHID.',
      'Click on a patient row to open the Patient Detail page showing demographics, visit history, and attachments.',
      'Use tabs to view: Profile, Visit History, Consultation Records, Lab Reports, and Attachments.',
    ],
  },
  {
    topic: 'Patient Attachments & Document Management',
    keywords: [
      'attachment', 'document', 'upload pdf', 'patient files', 'scan', 'id proof',
      'discharge summary', 'upload document', 'patient document', 'medical record upload',
    ],
    route: '/patients',
    summary: 'Upload, view, and manage external medical records, past lab reports, and ID proofs for any patient.',
    steps: [
      'Go to "Patients" (/patients) and search for the patient by Name, Mobile, or UHID.',
      'Click on the patient row to open the Patient Detail page (/patients/:patientId).',
      'Click on the "Attachments" tab.',
      'Click "Upload file" or drag & drop a PDF, PNG, or JPEG file (up to 10MB).',
      'Enter an optional description or document label (e.g. "Previous ECG Report", "Aadhaar Card").',
      'The file uploads securely to Supabase Storage with instant preview and download options.',
    ],
  },

  // ─────────────────────────────────────────────────────────────
  // 2. APPOINTMENTS & DOCTOR CONSULTATION
  // ─────────────────────────────────────────────────────────────
  {
    topic: 'Book / Schedule an Appointment',
    keywords: [
      'appointment', 'book', 'schedule', 'doctor slot', 'queue token', 'visit',
      'book appointment', 'new appointment', 'schedule appointment', 'opd appointment',
      'create appointment', 'appointment booking',
    ],
    route: '/appointments',
    summary: 'Appointments link patients with consulting doctors for specific time slots and track queue statuses.',
    steps: [
      'Navigate to "Appointments" from the sidebar menu (/appointments).',
      'Click "+ New appointment" button at the top right.',
      'Select or search the Patient by name or UHID.',
      'Select the Consulting Doctor and Department.',
      'Pick the Appointment Date and desired Time Slot.',
      'Select the visit type (e.g. New Visit, Follow-up, Routine Checkup).',
      'Click "Schedule Appointment". The patient is assigned a queue token number.',
      'Status flow: SCHEDULED -> CHECKED_IN -> IN_CONSULTATION -> COMPLETED.',
    ],
  },
  {
    topic: 'Doctor Consultation & Clinical Notes',
    keywords: [
      'consultation', 'doctor', 'opd', 'prescription', 'clinical notes', 'vitals',
      'soap', 'diagnosis', 'consultation attachments', 'start consultation',
      'doctor visit', 'examine patient', 'write prescription', 'medical notes',
      'blood pressure', 'bp', 'pulse', 'temperature', 'spo2',
    ],
    route: '/appointments',
    requiredRole: 'DOCTOR or HOSPITAL_ADMIN',
    summary: 'Doctors record clinical examination, vitals, diagnoses, prescriptions, and upload medical attachments.',
    steps: [
      'From the Appointments page, click "Start Consultation" on a checked-in patient.',
      'Record Vitals: Enter Blood Pressure (BP), Pulse, Temperature, SpO2, and Weight.',
      'Enter Clinical Notes: Chief Complaint, History of Present Illness (HPI), and Physical Examination findings.',
      'Diagnosis: Add primary and secondary diagnoses with optional ICD-10 codes.',
      'Prescription: Search and add medicines, dosage frequency (e.g. 1-0-1), duration in days, and special instructions.',
      'Upload Attachments: In the "Consultation Attachments" section, click "Upload Attachment" to attach lab reports, scans, or clinical photos with image preview.',
      'Click "Complete Consultation". Prescriptions are automatically queued in the Pharmacy queue for dispensing.',
    ],
  },

  // ─────────────────────────────────────────────────────────────
  // 3. LABORATORY MANAGEMENT
  // ─────────────────────────────────────────────────────────────
  {
    topic: 'Laboratory: Lab Test Master Catalog',
    keywords: [
      'lab catalog', 'add lab test', 'create lab test', 'new lab test', 'test price',
      'reference range', 'normal range', 'test catalog', 'sample type',
      'biochemistry test', 'hematology', 'lab test master', 'configure test',
      'test setup', 'lab setup', 'add test', 'new test',
    ],
    route: '/laboratory/tests',
    requiredRole: 'LAB_TECHNICIAN or HOSPITAL_ADMIN',
    summary: 'Configure available diagnostic tests, test codes, sample types, normal reference ranges, and test pricing.',
    steps: [
      'Go to Laboratory > "Lab Tests" (/laboratory/tests).',
      'Click "+ New test" button at the top right.',
      'Enter Test Name (e.g. "Complete Blood Count", "Lipid Profile", "Serum Creatinine") and Test Code.',
      'Select Category: Hematology, Biochemistry, Microbiology, Serology, Urine, Pathology, Radiology, or Other.',
      'Select Sample Type: Blood, Serum, Plasma, Urine, Stool, Swab, Sputum, etc.',
      'Set Reference Ranges: Enter Unit (e.g. mg/dL, g/dL, %), Reference Min and Reference Max values, or textual normal findings.',
      'Set Pricing & Turnaround Time: Enter test price (Rs.) and expected turnaround time in hours.',
      'Click "Create". The test is now available for doctors to order during consultations or receptionists at billing.',
    ],
  },
  {
    topic: 'Laboratory: Order a Lab Test',
    keywords: [
      'order lab', 'order lab test', 'order test', 'new lab order', 'request lab',
      'diagnostic order', 'prescribe test', 'lab order', 'create lab order',
      'request test', 'lab request',
    ],
    route: '/laboratory/orders',
    requiredRole: 'DOCTOR, LAB_TECHNICIAN, or HOSPITAL_ADMIN',
    summary: 'Place diagnostic test orders for patients with priority tagging (Routine, Urgent, STAT).',
    steps: [
      'Navigate to Laboratory > "Lab Orders" (/laboratory/orders).',
      'Click "+ New order" button.',
      'Select the Patient (by name or UHID) and the Referring Doctor.',
      'Set Order Priority: ROUTINE, URGENT, or STAT (Immediate emergency).',
      'Select Test Items: Check the boxes for the tests requested (e.g. CBC, Blood Sugar, LFT).',
      'Add optional clinical notes or instructions for the lab.',
      'Click "Create Order". The order is assigned status "ORDERED" and appears in the laboratory collection queue.',
    ],
  },
  {
    topic: 'Laboratory: Collect Sample & Enter Test Results',
    keywords: [
      'enter lab results', 'enter results', 'lab results', 'collect sample',
      'sample collection', 'specimen', 'result value', 'test value', 'normal flag',
      'abnormal flag', 'lab result entry', 'type results', 'add results',
      'record results', 'blood test results',
    ],
    route: '/laboratory/orders',
    requiredRole: 'LAB_TECHNICIAN or HOSPITAL_ADMIN',
    summary: 'Collect physical patient samples, record sample barcodes, and enter laboratory test results with flags.',
    steps: [
      'Go to Laboratory > "Lab Orders" (/laboratory/orders).',
      'Click on the target order to open the Lab Order Detail page (/laboratory/orders/:orderId).',
      'Step 1 - Collect Sample: Click "Collect Sample" button. Confirm sample type (Blood, Urine, etc.), enter the vial barcode, and click "Confirm Collection". Order status changes to "COLLECTED".',
      'Step 2 - Enter Results: Click "Enter Results" button.',
      'For each test item, enter the measured Result Value, Unit, and Flag (e.g. NORMAL, HIGH, LOW, or ABNORMAL). Add any technician remarks.',
      'Click "Save Results". Order status transitions to "RESULTED".',
    ],
  },
  {
    topic: 'Laboratory: Verify Lab Results & Print Report',
    keywords: [
      'verify lab', 'verify order', 'verify results', 'approve lab', 'print lab report',
      'lab report pdf', 'pathologist verification', 'finalize lab', 'lab report',
      'print report', 'download lab report', 'lab verification',
    ],
    route: '/laboratory/orders',
    requiredRole: 'LAB_TECHNICIAN or HOSPITAL_ADMIN',
    summary: 'Verify test results, approve medical accuracy, and issue the finalized laboratory report.',
    steps: [
      'Open the resulted lab order at /laboratory/orders/:orderId.',
      'Review all entered test values against the highlighted normal reference intervals.',
      'Click "Verify Order" (requires LAB_RESULT_VERIFY permission).',
      'The order status locks to "VERIFIED" with the verifier timestamp.',
      'Click "Print Report" or "Download PDF" to print the official laboratory report featuring hospital header and verification signature.',
    ],
  },
  {
    topic: 'Laboratory Overview & Complete Workflow',
    keywords: [
      'lab', 'laboratory', 'lab workflow', 'lab module', 'lab features', 'lab overview',
      'how lab works', 'lab process', 'complete lab', 'lab management',
    ],
    route: '/laboratory/orders',
    requiredRole: 'LAB_TECHNICIAN or HOSPITAL_ADMIN',
    summary: 'The Laboratory module handles the full diagnostic lifecycle: test catalog setup, ordering, sample collection, result entry, verification, and report printing.',
    steps: [
      '**Lab Test Catalog** (/laboratory/tests): Define available tests with codes, categories, sample types, reference ranges, and prices.',
      '**Order a Lab Test** (/laboratory/orders): Doctors or lab staff create orders for patients, selecting specific tests and priority (Routine/Urgent/STAT).',
      '**Collect Sample**: Open an order and click "Collect Sample" to record specimen collection with barcode.',
      '**Enter Results**: After collection, click "Enter Results" to input measured values, units, and normal/abnormal flags.',
      '**Verify Results**: A senior lab tech or pathologist verifies the accuracy of results, locking the order status.',
      '**Print Report**: Generate official PDF lab reports with hospital branding and verification signatures.',
      'Navigate to [Lab Orders](/laboratory/orders) or [Lab Tests](/laboratory/tests) to get started.',
    ],
  },

  // ─────────────────────────────────────────────────────────────
  // 4. INPATIENT DEPARTMENT (IPD)
  // ─────────────────────────────────────────────────────────────
  {
    topic: 'IPD Inpatient Admission & Bed Allocation',
    keywords: [
      'ipd', 'admit', 'admission', 'bed', 'ward', 'inpatient', 'room', 'admit patient',
      'ipd admission', 'new admission', 'allocate bed', 'assign bed', 'admit in ipd',
      'ipd admit', 'patient admission', 'bed allocation', 'bed assignment',
      'how to admit', 'admitting',
    ],
    route: '/ipd/admissions',
    requiredRole: 'DOCTOR, NURSE, or HOSPITAL_ADMIN',
    summary: 'Manage inpatient admissions, assign ward beds with dynamic pricing, and monitor active stays.',
    steps: [
      'Navigate to IPD > "Admissions" (/ipd/admissions).',
      'Click "+ New Admission" button.',
      'Select the Patient and Admitting Doctor.',
      'Select the Location: Choose Ward, Room, and Bed. (Ensure the bed is in VACANT status).',
      'Review Bed Daily Pricing: Ward and bed pricing configured in IPD Pricing automatically calculate per-day charges.',
      'Enter Admission Reason, Initial Diagnosis, and Advance Deposit (if collected).',
      'Click "Admit Patient". The bed status automatically switches to OCCUPIED.',
      'Consent Form: In the admission detail page, you can open the "Consent Forms" section to generate or upload signed admission consent.',
    ],
  },
  {
    topic: 'IPD Locations & Bed Pricing Setup',
    keywords: [
      'ipd location', 'ward', 'bed pricing', 'room pricing', 'rate', 'pricing',
      'add bed', 'add ward', 'add room', 'bed setup', 'ward setup', 'location setup',
      'ipd setup', 'configure ward', 'configure bed', 'manage beds', 'manage wards',
    ],
    route: '/ipd/locations',
    requiredRole: 'HOSPITAL_ADMIN',
    summary: 'Configure wards, rooms, beds, and standard daily room rates.',
    steps: [
      'Go to IPD > "Locations" (/ipd/locations).',
      'Click "+ Add Ward" to create a ward (e.g. General Ward, ICU, Deluxe Room).',
      'Add Rooms and Beds inside the Ward with unique bed codes.',
      'To set pricing, go to IPD > "Pricing" (/ipd/pricing) to configure the base rate per day for each ward category.',
      'Bed daily rates are automatically computed on IPD bills when generating discharge invoices.',
    ],
  },
  {
    topic: 'IPD Bill Builder & Patient Discharge',
    keywords: [
      'ipd bill', 'discharge', 'ipd billing', 'consolidated bill', 'bed charge',
      'discharge patient', 'discharge bill', 'ipd invoice', 'final bill',
      'hospital bill', 'patient discharge',
    ],
    route: '/ipd/admissions',
    requiredRole: 'ACCOUNTANT or HOSPITAL_ADMIN',
    summary: 'Calculate total hospital stay days, consolidate bed charges, nursing fees, and procedures, then discharge patient.',
    steps: [
      'Go to IPD > "Admissions" (/ipd/admissions) and click on the admitted patient.',
      'Click "Build Bill" or "Discharge Bill" (/ipd/admissions/:admissionId/bill).',
      'The system automatically calculates total stay duration (days) and multiplies by the bed daily rate.',
      'Add additional hospital charges: Doctor visits, nursing care, OT charges, medicines, and consumables.',
      'Deduct any advance deposits previously paid by the patient.',
      'Generate Draft Invoice -> Record Final Payment (Cash, UPI, Card, TPA/Insurance).',
      'Click "Discharge Patient". The assigned bed status automatically reverts to VACANT.',
    ],
  },
  {
    topic: 'IPD Overview & Complete Workflow',
    keywords: [
      'ipd overview', 'ipd features', 'ipd module', 'ipd workflow', 'inpatient overview',
      'how ipd works', 'ipd process', 'complete ipd',
    ],
    route: '/ipd/admissions',
    requiredRole: 'DOCTOR, NURSE, ACCOUNTANT, or HOSPITAL_ADMIN',
    summary: 'The IPD module handles all inpatient operations: ward/bed configuration, patient admissions, bed tracking, bill generation, and patient discharge.',
    steps: [
      '**Locations & Beds** (/ipd/locations): Configure wards, rooms, and beds with unique codes and daily pricing.',
      '**Pricing** (/ipd/pricing): Set base rates per day for each ward category (General, ICU, Deluxe, etc.).',
      '**Admissions** (/ipd/admissions): Admit patients by selecting a bed, doctor, and diagnosis.',
      '**Bed Tracking**: Monitor bed occupancy in real-time — VACANT, OCCUPIED, and RESERVED statuses.',
      '**Bill Builder**: Generate consolidated discharge bills covering bed charges, doctor visits, nursing, medicines, and procedures.',
      '**Discharge**: Finalize payment and discharge the patient, automatically freeing the bed.',
      'Navigate to [IPD Admissions](/ipd/admissions) or [IPD Locations](/ipd/locations) to get started.',
    ],
  },

  // ─────────────────────────────────────────────────────────────
  // 5. PHARMACY & INVENTORY
  // ─────────────────────────────────────────────────────────────
  {
    topic: 'Pharmacy Stock Adjustment & Editing',
    keywords: [
      'stock', 'edit stock', 'adjust stock', 'pharmacy stock', 'batch stock', 'inventory',
      'quantity', 'reduce stock', 'add stock', 'stock correction', 'stock edit',
      'change stock', 'modify stock', 'update stock',
    ],
    route: '/pharmacy/stock',
    requiredRole: 'PHARMACIST or HOSPITAL_ADMIN',
    summary: 'Adjust physical batch quantities (corrections, breakages, expired write-offs) with an immutable audit ledger.',
    steps: [
      'Navigate to Pharmacy > "Stock" (/pharmacy/stock). (You can also click the "Stock" button next to any medicine in /pharmacy/medicines).',
      'Search for the medicine or batch number in the search bar.',
      'Locate the target batch in the Batches table and click "Edit Stock".',
      'Enter the "New Stock Quantity" or use quick adjustment buttons (+1, +5, +10, -1, -5).',
      'The modal displays real-time Net Adjustment (e.g. +15 Stock Increase or -5 Stock Reduction).',
      'Select a Reason for Adjustment (e.g. Physical inventory count correction, Damaged container, Expired stock removal).',
      'Click "Save Adjustment". The inventory updates immediately and creates an immutable audit transaction.',
      'Safety Guard: The system strictly prevents negative stock. Quantities cannot be reduced below zero.',
    ],
  },
  {
    topic: 'Add New Medicine & New Batch',
    keywords: [
      'medicine', 'add medicine', 'new medicine', 'batch', 'new batch', 'barcode',
      'print barcode', 'create medicine', 'medicine catalog', 'drug master',
      'medicine master', 'add drug',
    ],
    route: '/pharmacy/medicines',
    requiredRole: 'PHARMACIST or HOSPITAL_ADMIN',
    summary: 'Maintain the medicine master catalog, print barcode labels, and add new batches with initial stock.',
    steps: [
      'Go to Pharmacy > "Medicines" (/pharmacy/medicines).',
      'Click "+ New medicine".',
      'Enter Medicine Name, Generic Name, Category (Tablet, Syrup, Injection), Unit, GST Rate (%), and Reorder Level.',
      'Optional Barcode: Enter a barcode or leave blank to auto-generate (e.g. MED-000123).',
      'To add physical stock / batch: Go to Pharmacy > "Stock" and click "+ Add Batch / Stock".',
      'Select the medicine, enter Batch Number, Expiry Date, Initial Stock Quantity, and MRP / Selling Price.',
      'Click "Create Batch". The stock becomes instantly available for dispensing.',
      'Barcode Printing: In Medicines page, click "Print barcodes" to print barcode sheets for your inventory.',
    ],
  },
  {
    topic: 'Dispense Medicines (Pharmacy Queue)',
    keywords: [
      'dispense', 'pharmacy queue', 'prescription dispense', 'rx', 'sell medicine',
      'dispense medicine', 'give medicine', 'pharmacy bill', 'medicine bill',
    ],
    route: '/pharmacy/queue',
    requiredRole: 'PHARMACIST or HOSPITAL_ADMIN',
    summary: 'Dispense doctor-prescribed medications to patients and generate pharmacy bills.',
    steps: [
      'Go to Pharmacy > "Queue" (/pharmacy/queue).',
      'Select a patient with status "PENDING" in the Rx queue.',
      'Review prescribed items, dosage, and required quantities.',
      'The system suggests in-stock batches (prioritizing FEFO: First Expiry First Out).',
      'Click "Dispense & Bill". Batches are deducted automatically and a pharmacy invoice is generated.',
    ],
  },
  {
    topic: 'Pharmacy Suppliers & Purchase Orders',
    keywords: [
      'supplier', 'vendor', 'purchase', 'receive purchase', 'stock in', 'grn',
      'goods received', 'purchase order', 'buy medicine', 'receive stock',
    ],
    route: '/pharmacy/purchases',
    requiredRole: 'PHARMACIST or HOSPITAL_ADMIN',
    summary: 'Record bulk medicine purchases from drug suppliers and automatically update batch inventory.',
    steps: [
      'Add Supplier: Go to Pharmacy > "Suppliers" (/pharmacy/suppliers) and click "+ New Supplier" to save distributor contact and GSTIN.',
      'Receive Purchase: Go to Pharmacy > "Purchases" (/pharmacy/purchases) and click "+ Receive Purchase".',
      'Select Supplier, Invoice Number, and Purchase Date.',
      'Add items: Select Medicine, Batch Number, Expiry Date, Received Quantity, Purchase Price, MRP, and Selling Price.',
      'Click "Receive Purchase". Batches and stock transactions are automatically created in the inventory ledger.',
    ],
  },
  {
    topic: 'Pharmacy Overview & Complete Workflow',
    keywords: [
      'pharmacy', 'pharmacy overview', 'pharmacy module', 'pharmacy features',
      'pharmacy workflow', 'how pharmacy works', 'pharmacy management',
    ],
    route: '/pharmacy/medicines',
    requiredRole: 'PHARMACIST or HOSPITAL_ADMIN',
    summary: 'The Pharmacy module manages the full medicine lifecycle: catalog, stock/batch management, dispensing from doctor prescriptions, purchase orders, and supplier management.',
    steps: [
      '**Medicines Catalog** (/pharmacy/medicines): Add, edit, and manage medicines with barcodes, categories, and reorder levels.',
      '**Stock & Batches** (/pharmacy/stock): View all batch inventory, adjust stock quantities, and track expiry dates.',
      '**Pharmacy Queue** (/pharmacy/queue): Dispense medicines from doctor prescriptions and generate pharmacy invoices.',
      '**Purchases** (/pharmacy/purchases): Record bulk purchases from suppliers to automatically add stock batches.',
      '**Suppliers** (/pharmacy/suppliers): Manage drug distributors, their contact details, and GSTIN.',
      'Navigate to [Medicines](/pharmacy/medicines), [Stock](/pharmacy/stock), or [Pharmacy Queue](/pharmacy/queue) to get started.',
    ],
  },

  // ─────────────────────────────────────────────────────────────
  // 6. BILLING & INVOICES
  // ─────────────────────────────────────────────────────────────
  {
    topic: 'Billing, Invoices & Collecting Payment',
    keywords: [
      'billing', 'invoice', 'payment', 'bill', 'receipt', 'refund', 'gst',
      'collect payment', 'create invoice', 'new invoice', 'generate bill',
      'billing overview', 'billing module',
    ],
    route: '/billing/invoices',
    requiredRole: 'ACCOUNTANT, RECEPTIONIST, or HOSPITAL_ADMIN',
    summary: 'Generate OPD/IPD invoices, record multi-mode payments (Cash, UPI, Card), and print receipts.',
    steps: [
      'Navigate to Billing > "Invoices" (/billing/invoices).',
      'Click "+ New Invoice" to create a bill, or open an existing unpaid/partially paid invoice.',
      'Add billable line items (Consultation fee, Lab test, IPD bed charges, Procedures).',
      'Record Payment: Click "Record Payment", select Mode (CASH, UPI, CARD, CHEQUE), enter amount, and confirm.',
      'Click "Print Receipt" to generate a standardized print or thermal slip with hospital header.',
      'Auto-sync with Finance: Recorded cash/UPI payments automatically appear in the Finance Accounts ledger as INCOME.',
    ],
  },

  // ─────────────────────────────────────────────────────────────
  // 7. FINANCE & CASH CLOSING
  // ─────────────────────────────────────────────────────────────
  {
    topic: 'Finance Accounts Ledger & Operational Expenses',
    keywords: [
      'finance', 'accounts', 'ledger', 'expense', 'income', 'operational expense',
      'voucher', 'add expense', 'record expense', 'finance module', 'accounting',
    ],
    route: '/finance/accounts',
    requiredRole: 'ACCOUNTANT or HOSPITAL_ADMIN',
    summary: 'Track all hospital income and operational expenses with automated integration and manual vouchers.',
    steps: [
      'Navigate to Finance > "Accounts" (/finance/accounts).',
      'Automated entries: Every invoice payment received automatically generates an "INCOME" ledger entry. Every patient refund automatically generates a "REFUND" entry.',
      'To add manual expenses: Click "+ New Entry" button.',
      'Select Entry Type: EXPENSE (or INCOME).',
      'Choose Category: Operational, Salaries, Equipment, Pharmacy Purchase, Utilities, Maintenance, etc.',
      'Enter Amount, Payment Method (CASH, BANK, UPI), and reference details.',
      'Click "Save Entry". The entry updates hospital cash and bank ledger balances immediately.',
    ],
  },
  {
    topic: 'Daily Cash Register Closing',
    keywords: [
      'cash closing', 'cash register', 'day close', 'closing balance', 'cash variance',
      'daily cash', 'close day', 'end of day', 'cash count', 'cash reconciliation',
    ],
    route: '/finance/cash-closing',
    requiredRole: 'ACCOUNTANT or HOSPITAL_ADMIN (Close requires HOSPITAL_ADMIN)',
    summary: 'Reconcile daily physical cash in hand with calculated receipts, expenses, and refunds.',
    steps: [
      'Navigate to Finance > "Cash Closing" (/finance/cash-closing).',
      'The register automatically displays today\'s Opening Balance, Total Cash Receipts, Cash Expenses, and Cash Refunds.',
      'Review "Expected Cash": The exact formula is `Opening Balance + Cash Receipts - Cash Expenses - Cash Refunds`.',
      'Physical Cash Count: Count the actual currency in the cash drawer and enter the amount in "Actual Cash".',
      'Check Variance: If Actual equals Expected, Variance is Rs. 0.00 (Balanced). Any discrepancy is flagged.',
      'Add Closing Notes explaining any difference (if applicable).',
      'Click "Close Day" (Admin only). The register status locks to "CLOSED".',
      'Next morning: Tomorrow\'s Opening Balance is automatically carried forward from today\'s Actual Cash.',
    ],
  },

  // ─────────────────────────────────────────────────────────────
  // 8. SETTINGS, USERS & BRANCHES
  // ─────────────────────────────────────────────────────────────
  {
    topic: 'User Management & Role Permissions',
    keywords: [
      'users', 'roles', 'permissions', 'staff', 'doctor role', 'nurse role', 'admin',
      'invite user', 'add user', 'create user', 'manage users', 'user management',
      'staff management', 'team', 'employee',
    ],
    route: '/users',
    requiredRole: 'HOSPITAL_ADMIN',
    summary: 'Invite staff members, assign clinical/administrative roles, and inspect permission matrices.',
    steps: [
      'Go to "Users" (/users) from the sidebar menu.',
      'Click "+ Invite User" or "+ New User".',
      'Enter Staff Full Name, Email, and Phone.',
      'Assign Roles: SUPER_ADMIN, HOSPITAL_ADMIN, DOCTOR, NURSE, RECEPTIONIST, PHARMACIST, LAB_TECHNICIAN, ACCOUNTANT.',
      'Assign Department and Primary Branch.',
      'To view or audit permissions granted to each role, navigate to Settings > "Roles" (/roles).',
    ],
  },
  {
    topic: 'Branches, Departments & Organization Profile',
    keywords: [
      'branch', 'department', 'organization', 'hospital details', 'add branch',
      'add department', 'hospital profile', 'hospital name', 'hospital logo',
      'organisation', 'org', 'org profile', 'company profile', 'hospital settings',
      'hospital info', 'hospital information', 'gst', 'tax number', 'address',
      'tagline', 'branding', 'configure hospital',
    ],
    route: '/organization',
    requiredRole: 'HOSPITAL_ADMIN',
    summary: 'Manage hospital branding, multiple branch locations, and clinical departments/specialties.',
    steps: [
      'Organization Profile: Go to /organization to configure Hospital Name, Tagline, Logo, Tax/GST number, and Official Address.',
      'Branches: Go to /branches to add satellite clinics or multi-building branches with unique branch codes.',
      'Departments: Go to /departments to create specialties (Cardiology, Pediatrics, General Medicine, Orthopedics, Radiology) and assign department heads.',
      'The organization profile is used in printed invoices, lab reports, and discharge summaries as the official hospital header.',
    ],
  },

  // ─────────────────────────────────────────────────────────────
  // 9. DASHBOARD & OVERVIEW
  // ─────────────────────────────────────────────────────────────
  {
    topic: 'Dashboard & System Overview',
    keywords: [
      'dashboard', 'home', 'overview', 'summary', 'statistics', 'analytics',
      'today', 'daily summary', 'main page', 'home page',
    ],
    route: '/dashboard',
    summary: 'The Dashboard provides a real-time overview of hospital operations: today\'s appointments, bed occupancy, pending lab orders, and financial summaries.',
    steps: [
      'The Dashboard (/dashboard) is the default landing page after login.',
      'It displays key metrics: Total Patients, Today\'s Appointments, Pending Lab Orders, Occupied Beds, and Revenue Summary.',
      'Use the dashboard cards to quickly navigate to any module.',
      'The sidebar menu on the left provides access to all features: Patients, Appointments, Laboratory, IPD, Pharmacy, Billing, Finance, Users, and Organization.',
    ],
  },

  // ─────────────────────────────────────────────────────────────
  // 10. OFFLINE & SYNC
  // ─────────────────────────────────────────────────────────────
  {
    topic: 'Offline Mode & Automatic Data Sync',
    keywords: [
      'offline', 'sync', 'dexie', 'internet down', 'offline mode', 'network disconnected',
      'no internet', 'data sync', 'auto sync', 'connection lost',
    ],
    route: '/dashboard',
    summary: 'The application features an offline-first architecture powered by Dexie IndexedDB.',
    steps: [
      'If internet connection drops, an "Offline" banner appears in the top navigation bar.',
      'Staff can continue creating patients, viewing master data, and queuing operations locally.',
      'When connection restores, the Sync Engine automatically syncs queued actions to the server in the background.',
      'Offline indicator turns green ("Online / Synced") once all changes are uploaded.',
    ],
  },

  // ─────────────────────────────────────────────────────────────
  // 11. GENERAL / SOFTWARE HELP
  // ─────────────────────────────────────────────────────────────
  {
    topic: 'Getting Started & Navigation Guide',
    keywords: [
      'getting started', 'navigation', 'sidebar', 'menu', 'how to use', 'guide',
      'help', 'tutorial', 'beginner', 'first time', 'new user', 'learn',
      'features', 'what can', 'capabilities',
    ],
    route: '/dashboard',
    summary: 'A quick start guide to navigating and using the Hospital ERP software.',
    steps: [
      'After logging in, you land on the **Dashboard** (/dashboard) which shows a summary of hospital operations.',
      'Use the **left sidebar menu** to navigate between modules: Patients, Appointments, Laboratory, IPD, Pharmacy, Billing, Finance, Users, Organization.',
      'Key workflows: Register Patients → Book Appointments → Doctor Consultation → Lab Orders → Pharmacy Dispensing → Billing → Cash Closing.',
      'Each module has list pages and detail pages. Click "+ New" buttons to create new records.',
      'The **AI Assistant** (this chatbot) is available on every page — ask me how to use any feature!',
      'For admin tasks (users, roles, branches, departments), navigate to Settings sections in the sidebar.',
    ],
  },
];

export const SYSTEM_OVERVIEW = `
You are the AI ERP Assistant for this Hospital Management & Healthcare SaaS application.
Your mission is to guide hospital staff (Doctors, Nurses, Pharmacists, Lab Technicians, Receptionists, Accountants, and Administrators) on how to use every feature of this software accurately, politely, and step-by-step.

Rules for your answers:
1. Always be specific to THIS software. Mention exact button names (e.g. "+ New patient", "Collect Sample", "Enter Results", "Verify Order", "Edit Stock", "Record Payment", "+ New Admission"), page names, and routes.
2. Structure your answers clearly with bullet points or numbered steps.
3. Include clickable markdown links to relevant routes using format [Page Name](/route), for example:
   - [Lab Orders](/laboratory/orders)
   - [Lab Tests Catalog](/laboratory/tests)
   - [Patients page](/patients)
   - [Stock page](/pharmacy/stock)
   - [Appointments](/appointments)
   - [Invoices](/billing/invoices)
   - [IPD Admissions](/ipd/admissions)
   - [IPD Locations](/ipd/locations)
   - [Cash Closing](/finance/cash-closing)
   - [Finance Accounts](/finance/accounts)
   - [Organization](/organization)
   - [Branches](/branches)
   - [Departments](/departments)
   - [Users](/users)
   - [Pharmacy Medicines](/pharmacy/medicines)
   - [Pharmacy Queue](/pharmacy/queue)
   - [Pharmacy Purchases](/pharmacy/purchases)
   - [Pharmacy Suppliers](/pharmacy/suppliers)
4. When relevant, mention role requirements (e.g. "Laboratory actions require LAB_TECHNICIAN or HOSPITAL_ADMIN role", "Only Hospital Admins and Pharmacists can adjust medicine stock").
5. Keep explanations professional, concise, and easy to understand for busy clinical and front-desk staff.
6. If the user asks a vague or single-word query (e.g. "organization", "lab", "pharmacy"), provide a comprehensive overview of that entire module/section with all available features and navigation links.
7. NEVER say you don't know something about this software. All features are documented in the knowledge base provided to you. Always find the most relevant feature and explain it.
8. If the user asks about multiple topics, address each one clearly with separate sections.
`;

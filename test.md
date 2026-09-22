# Hospital SaaS - QA Test Guide
**Date:** 2026-09-22 | **Testers:** 4

| Tester | Modules |
|--------|---------|
| **T1** | Auth, Dashboard, Patients, Org Settings |
| **T2** | Appointments, Consultation, Prescriptions, Users & Roles |
| **T3** | Pharmacy (Medicines, Suppliers, Purchases, Stock, Queue, Invoices) |
| **T4** | Laboratory, IPD (Locations, Beds, Admissions), Billing, Subscription |


## TESTER 1 - Auth, Dashboard, Patients, Org Settings

### M1 - Authentication
| # | Steps | Expected |
|---|-------|----------|
| T1-01 | Enter wrong email + password, click Sign In | Error alert shown |
| T1-02 | Leave email empty, click Sign In | Validation error shown |
| T1-03 | Login with valid credentials | Redirects to /dashboard |
| T1-04 | While logged in, open /login manually | Redirects back to dashboard |
| T1-05 | Click eye icon on password field | Password toggles visible/hidden |
| T1-06 | Open /pricing without logging in | Pricing page loads |
| T1-07 | DevTools > Network > Offline > try login | Offline warning shown |

---

### M2 - Dashboard
| # | Steps | Expected |
|---|-------|----------|
| T1-08 | Login as Hospital Admin, open /dashboard | Stats tiles load (Appointments, Patients, Revenue, Beds) |
| T1-09 | Check all 4 charts | Charts render with data |
| T1-10 | Click Sync (refresh icon) | Data refreshes, spinner appears then stops |
| T1-11 | Check low stock alert badge | Shows medicines below reorder level |
| T1-12 | Login as DOCTOR role | Only doctor-relevant sections visible |
| T1-13 | DevTools > Offline > reload page | Yellow offline banner shown at top |

---

### M3 - Patients
| # | Steps | Expected |
|---|-------|----------|
| T1-14 | Click Register patient | Modal opens |
| T1-15 | Fill only Full Name, click Register | Patient created |
| T1-16 | Register patient with same mobile as existing | Duplicate warning shown |
| T1-17 | In duplicate warning, click Register anyway | Patient created |
| T1-18 | Search by name | List filters in real time |
| T1-19 | Search by UHID | Correct patient shown |
| T1-20 | Click Next page / Previous page | Correct page loads |
| T1-21 | Click View on a patient | Opens patient detail page |
| T1-22 | As Admin, Edit patient, clear Full Name, Save | Validation error shown |
| T1-23 | Open /patients/invalid-id in address bar | Error page or 404 shown |

---

### M4 - Org Settings
| # | Steps | Expected |
|---|-------|----------|
| T1-24 | /organization > update org name > Save | Success confirmation shown |
| T1-25 | /branches > Add branch with empty name > Save | Validation error shown |
| T1-26 | Add branch with same name as existing | Error shown |
| T1-27 | /departments > add department | Department appears in list |

---

## TESTER 2 - Appointments, Consultation, Prescriptions, Users & Roles

### M5 - Appointments
| # | Steps | Expected |
|---|-------|----------|
| T2-01 | Open /appointments (today default) | Today appointments listed |
| T2-02 | Click New appointment | Modal opens |
| T2-03 | Book without selecting patient | Validation error shown |
| T2-04 | Book without selecting doctor | Validation error shown |
| T2-05 | Book with patient + doctor + today date | Appointment created |
| T2-06 | Filter by Status = Scheduled | Only SCHEDULED shown |
| T2-07 | Filter by Date = tomorrow | List updates for that date |
| T2-08 | Click Check-in on SCHEDULED appointment | Status changes to CHECKED_IN |
| T2-09 | Click Start on CHECKED_IN appointment | Opens /consultation/:id |
| T2-10 | On COMPLETED appointment, check invoice badge | Invoice number visible |

---

### M6 - Consultation
| # | Steps | Expected |
|---|-------|----------|
| T2-11 | Open consultation from appointment | Patient name and chief complaint pre-filled |
| T2-12 | Fill Vitals (BP, Pulse, Temp, SpO2), Save | Vitals saved |
| T2-13 | Enter BP Systolic = 999, Save | Warning shown |
| T2-14 | Add diagnosis text, Save | Diagnosis saved |
| T2-15 | Add prescription, select medicine | Picker works correctly |
| T2-16 | Add prescription without selecting medicine, Save | Error shown |
| T2-17 | Click Print prescription | Print modal opens |
| T2-18 | Navigate away without saving | Warning prompt appears |
| T2-19 | Click Complete consultation | Status COMPLETED, invoice generated |

---

### M7 - Prescriptions
| # | Steps | Expected |
|---|-------|----------|
| T2-20 | Open /admin/prescriptions/:id/edit | Page loads with existing data |
| T2-21 | Edit medicine name + dosage, Submit | Changes saved |
| T2-22 | Remove all medicine rows, Submit | Error or warning shown |

---

### M8 - Users & Roles
| # | Steps | Expected |
|---|-------|----------|
| T2-23 | /users > Invite user | Modal opens |
| T2-24 | Invite with existing email | Email already exists error |
| T2-25 | Invite without selecting a role | Validation error |
| T2-26 | Filter users by role | List filters correctly |
| T2-27 | /roles > click DOCTOR role | Permission list expands |
| T2-28 | Uncheck a permission, Save | Permission removed (with confirmation) |
| T2-29 | /settings/sessions | Active sessions listed |

---

## TESTER 3 - Pharmacy

### M9 - Medicines
| # | Steps | Expected |
|---|-------|----------|
| T3-01 | Add medicine > Name only > Create | Medicine created |
| T3-02 | Add medicine with same name as existing | Error or duplicate warning |
| T3-03 | Add medicine with Reorder Level = -1 | Validation error |
| T3-04 | Add medicine with GST Rate = 200 | Validation error |
| T3-05 | Edit medicine, change name, Save | Name updated |
| T3-06 | Search medicine by name | Filtered results shown |
| T3-07 | Click Print barcode | Print modal opens |

---

### M10 - Suppliers
| # | Steps | Expected |
|---|-------|----------|
| T3-08 | Add supplier with name only | Created |
| T3-09 | Add supplier with letters in phone field | Validation error |
| T3-10 | Add supplier with invalid email | Validation error |
| T3-11 | Edit supplier, Save | Changes saved |

---

### M11 - Purchases
| # | Steps | Expected |
|---|-------|----------|
| T3-12 | Create purchase: supplier + medicine + qty=5 + price | Purchase created |
| T3-13 | Create purchase with qty = 0 | Validation error |
| T3-14 | Create purchase with negative price | Validation error |
| T3-15 | Check /pharmacy/stock after purchase | Stock quantity increased |

---

### M12 - Stock
| # | Steps | Expected |
|---|-------|----------|
| T3-16 | Open /pharmacy/stock | All medicines with quantities listed |
| T3-17 | Find medicine below reorder level | Highlighted in red/yellow |

---

### M13 - Pharmacy Queue
| # | Steps | Expected |
|---|-------|----------|
| T3-18 | Open queue > Pending tab | Prescriptions listed |
| T3-19 | Expand a queue item | Medicine list with dose/frequency |
| T3-20 | Click Dispense | Modal opens |
| T3-21 | Set qty = 0, confirm | Validation error |
| T3-22 | Dispense correctly, confirm | Status DISPENSED, invoice created |
| T3-23 | Click Print invoice after dispense | Print modal opens |
| T3-24 | Filter by Dispensed | Only dispensed items shown |

---

### M14 - Pharmacy Invoices
| # | Steps | Expected |
|---|-------|----------|
| T3-25 | Open /pharmacy/invoices | Invoice list loads |
| T3-26 | Filter by status | Correct invoices shown |
| T3-27 | Click any invoice | Detail opens |

---

## TESTER 4 - Laboratory, IPD, Billing, Subscription

### M15 - Lab Tests
| # | Steps | Expected |
|---|-------|----------|
| T4-01 | Add test with Name + Price | Test created |
| T4-02 | Add test with negative price | Validation error |
| T4-03 | Edit test > update price > Save | Price updated |
| T4-04 | Search by name | Filtered results shown |

---

### M16 - Lab Orders
| # | Steps | Expected |
|---|-------|----------|
| T4-05 | New lab order > patient + doctor + 1 test > Create | Order created (ORDERED status) |
| T4-06 | Create order without selecting test | Error shown |
| T4-07 | Open order detail | Tests, status, patient info shown |
| T4-08 | Mark as COLLECTED | Status updates to yellow |
| T4-09 | Enter result, mark RESULTED | Result stored |
| T4-10 | Mark as VERIFIED | Status updates to green/purple |
| T4-11 | Filter orders by status | Matching orders only shown |
| T4-12 | Open /laboratory/invoices | Invoice list loads |

---

### M17 - IPD Locations & Beds
| # | Steps | Expected |
|---|-------|----------|
| T4-13 | /ipd/locations > add Ward | Ward created |
| T4-14 | Add Room under ward | Room nested under ward |
| T4-15 | /ipd/beds > add bed under room | Bed created (AVAILABLE) |
| T4-16 | Check bed count per ward | Count correct |

---

### M18 - IPD Admissions
| # | Steps | Expected |
|---|-------|----------|
| T4-17 | Click Admit patient | Modal opens |
| T4-18 | Admit without selecting bed | Validation error |
| T4-19 | Select patient + doctor + bed > Admit | Admitted, bed OCCUPIED |
| T4-20 | Try admitting same active patient again | Error or block shown |
| T4-21 | Overview tab | Patient, bed, doctor info shown |
| T4-22 | Notes tab > add nursing note | Note appears in list |
| T4-23 | MAR tab > add medication + schedule | MAR entry added |
| T4-24 | Mark MAR as ADMINISTERED | Status green |
| T4-25 | Transfers tab > transfer to another bed | New bed OCCUPIED, old bed AVAILABLE |
| T4-26 | Discharge > fill summary > confirm | Status DISCHARGED, bed freed |
| T4-27 | After discharge > try to add nursing note | Blocked or warning shown |
| T4-28 | Billing tab > open Bill Builder > add service | Total calculated correctly |

---

### M19 - Billing
| # | Steps | Expected |
|---|-------|----------|
| T4-29 | New invoice > patient + item (qty=1, price=500) > Create | Invoice created (UNPAID) |
| T4-30 | Create invoice without patient | Select a patient error |
| T4-31 | Create invoice with no line items | Add at least one item error |
| T4-32 | Add line item with qty = 0 > Create | Warning or block shown |
| T4-33 | Add global discount, check total | Total = subtotal minus discount |
| T4-34 | Filter by UNPAID | Only unpaid invoices shown |
| T4-35 | Open invoice detail > record payment | Status PAID or PARTIAL |
| T4-36 | On PAID invoice > try another payment | Blocked or warning |
| T4-37 | Click Print on invoice | Print modal opens |

---

### M20 - Settings
| # | Steps | Expected |
|---|-------|----------|
| T4-38 | /settings/pricing > update price > Save | Price updated |
| T4-39 | /settings/subscription | Plan shown with correct status badge |
| T4-40 | Click Renew/Upgrade | Razorpay modal opens |
| T4-41 | Check plan expiry date | Correct date shown |

---

## Pre-Submit Checklist

- [ ] All assigned test cases completed
- [ ] Bugs logged: Module, Steps, Expected, Actual, Screenshot
- [ ] Tested on desktop AND mobile view
- [ ] Tested in offline mode (DevTools > Network > Offline)
- [ ] Tested with correct role (not always Admin)

---

## Bug Report Format

    Bug ID   : BUG-XXX
    Module   : [Name]
    Test ID  : [T#-XX]
    Title    : One-line description
    Severity : High / Medium / Low
    Steps    :
      1. ...
      2. ...
    Expected : ...
    Actual   : ...
    Screenshot: [attach]

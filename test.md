# Hospital SaaS - New Features QA Test Guide
**Status:** Pre-Production Release Testing

| Module | Features to Test |
|--------|------------------|
| **M1 - Attachments** | Patient Documents, Consultation Uploads |
| **M2 - Finance Ledger** | Manual Entries, Auto-sync (Payments & Refunds), Role Access |
| **M3 - Cash Closing** | Daily Cash Register, Actual Cash Count, Day Close |
| **M4 - IPD Enhancements** | Ward/Bed Pricing, Admission Consent Forms |
| **M5 - Pharmacy Stock** | Medicine Stock Editing, Batch Creation, Role Access |
| **M6 - AI Assistant** | Software Guides, Step-by-Step Help, Navigation Links |

---

## M1 - Attachments (Patient & Consultation)

| # | Steps | Expected |
|---|-------|----------|
| ATT-01 | Go to a Patient's detail page > Attachments tab | Empty state shown if no files |
| ATT-02 | Upload a PDF or Image (e.g., ID proof or past records) | File uploads successfully, appears in the list |
| ATT-03 | Click on the uploaded file | File opens/downloads correctly |
| ATT-04 | Delete the uploaded file | File is removed from the list |
| ATT-05 | Start a Consultation > Upload a lab report attachment | File attaches to the consultation |
| ATT-06 | View the completed consultation | The uploaded attachment is visible and accessible |

---

## M2 - Finance Ledger (Accounts & Auto-Sync)

| # | Steps | Expected |
|---|-------|----------|
| FIN-01 | Login as DOCTOR or RECEPTIONIST | Finance module should be hidden/inaccessible |
| FIN-02 | Login as HOSPITAL ADMIN or ACCOUNTANT | Finance module is accessible |
| FIN-03 | Go to Finance > Accounts > Add manual EXPENSE | Expense is saved and listed in the ledger |
| FIN-04 | Go to Billing > Invoices > Create an invoice & Record a Cash Payment | Payment succeeds |
| FIN-05 | Go to Finance > Accounts | The recorded payment automatically appears as an `INCOME` entry |
| FIN-06 | Go to Billing > Invoices > Refund the previous payment | Refund succeeds |
| FIN-07 | Go to Finance > Accounts | The refund automatically appears as a `REFUND` entry |

---

## M3 - Cash Closing (Daily Register)

| # | Steps | Expected |
|---|-------|----------|
| CSH-01 | Go to Finance > Cash Closing (for today) | Shows today's register (Opening Balance, Receipts, Expenses, Refunds) |
| CSH-02 | Verify 'Expected Cash' | Should exactly match: `Opening + Receipts - Expenses - Refunds` |
| CSH-03 | Enter 'Actual Cash' amount and add a note > Save | Actual cash and variance (difference) are updated |
| CSH-04 | Click 'Close Day' (Admin only) | Status changes to CLOSED, page becomes read-only |
| CSH-05 | Change the date picker to 'Tomorrow' | Shows 'OPEN' status, Opening Balance equals yesterday's Actual Cash |

---

## M4 - IPD Enhancements (Pricing & Consents)

| # | Steps | Expected |
|---|-------|----------|
| IPD-01 | Go to Settings > IPD Locations | Ward/Bed list loads |
| IPD-02 | Edit a Ward or Room | Pricing fields (Base Price) are available and can be saved |
| IPD-03 | Admit a patient to a priced bed | Bed pricing is linked to the admission |
| IPD-04 | Generate an IPD Draft Invoice for the patient | Bed charges are automatically calculated and added |
| IPD-05 | Go to Admission details > Consent Forms | Consent form section is visible |
| IPD-06 | Upload/Generate a signed consent form | Consent form is attached to the admission |

---

## M5 - Pharmacy Stock Management

| # | Steps | Expected |
|---|-------|----------|
| PHM-01 | Login as PHARMACIST or HOSPITAL ADMIN | 'Stock' page is accessible and 'Edit Stock' & 'Add Batch' buttons appear |
| PHM-02 | Login as DOCTOR or RECEPTIONIST | 'Stock' page only shows read-only view without edit/add buttons |
| PHM-03 | Go to Pharmacy > Stock > Click 'Edit Stock' on any batch | Modal opens showing current stock, batch number, and expiry date |
| PHM-04 | Change New Stock Quantity (e.g. increase or decrease) | Net Adjustment recalculates in real-time with clear increase/decrease indicator |
| PHM-05 | Select Reason for adjustment and save | Stock updates immediately in table and alert cards; audit entry is logged |
| PHM-06 | Test setting quantity below 0 | Blocked by UI and database trigger (negative stock prevention) |
| PHM-07 | Click 'Add Batch / Stock' > fill medicine, batch no, expiry & initial qty | New batch is added and appears immediately in inventory |
| PHM-08 | Go to Pharmacy > Medicines > Click 'Stock' on any medicine row | Navigates to Stock page filtered automatically to that medicine's batches |

---

## M6 - AI Assistant & Knowledge Chatbot

| # | Steps | Expected |
|---|-------|----------|
| AI-01 | Click the floating 'AI Assistant' button in the bottom right corner | Chat drawer opens smoothly with welcome greeting and quick questions |
| AI-02 | Click common question: "How do I add a new patient?" | Assistant provides exact numbered steps and clickable link to `/patients` |
| AI-03 | Ask: "How do I edit medicine stock?" | Assistant explains `/pharmacy/stock` steps, reason codes, and role permissions |
| AI-04 | Ask: "How does daily cash closing work?" | Explains Expected Cash formula and Admin Close Day requirement |
| AI-05 | Click any suggested navigation link in the chat response (e.g. `[Patients](/patients)`) | Navigates directly to the target page |
| AI-06 | Click 'Reset' icon in chat header | Conversation resets cleanly |

---

## Pre-Production Checklist
- [ ] Test uploading files of different sizes (e.g., > 5MB to test limits).
- [ ] Test the exact math on Cash Closing after adding manual expenses.
- [ ] Verify that refund triggers don't crash if payment method is missing.
- [ ] Ensure non-admin roles cannot Close the Cash Day.
- [ ] Verify stock adjustment creates immutable stock transactions without negative inventory.
- [ ] Verify AI Assistant answers ERP questions with accurate step-by-step guidance.

import { supabaseForUser } from '../../config/supabase.js';
import { patientsRepository } from './patients.repository.js';
import { BadRequest, Conflict, NotFound } from '../../utils/errors.js';
import { assertNoConflict } from '../../utils/conflict.js';
import { audit } from '../../middleware/audit.js';
import type { AuthContext } from '@medical/shared';
import type {
  CreatePatientInput,
  UpdatePatientInput,
  ListPatientsQuery,
  CheckDuplicateInput,
} from './patients.validators.js';

export const patientsService = {
  async list(auth: AuthContext, token: string, query: ListPatientsQuery) {
    if (!auth.tenantId) throw NotFound('No tenant context');
    const client = supabaseForUser(token);
    return patientsRepository.list(client, auth.tenantId, query);
  },

  async getById(auth: AuthContext, token: string, id: string) {
    if (!auth.tenantId) throw NotFound('No tenant context');
    const client = supabaseForUser(token);
    const patient = await patientsRepository.findById(client, auth.tenantId, id);
    if (!patient) throw NotFound('Patient not found');
    return patient;
  },

  async checkDuplicate(auth: AuthContext, token: string, input: CheckDuplicateInput) {
    if (!auth.tenantId) throw NotFound('No tenant context');
    if (!input.mobile && !(input.fullName && input.dateOfBirth)) {
      throw BadRequest('Provide mobile, or (fullName + dateOfBirth) to check duplicates');
    }
    const client = supabaseForUser(token);
    const matches = await patientsRepository.findDuplicates(client, auth.tenantId, input);
    return { hasDuplicates: matches.length > 0, matches };
  },

  async create(auth: AuthContext, token: string, input: CreatePatientInput, skipDuplicateCheck = false) {
    if (!auth.tenantId) throw NotFound('No tenant context');
    const client = supabaseForUser(token);

    // Resolve branch (from input, or default to oldest active branch)
    let branchId = input.branchId;
    if (!branchId) {
      const def = await patientsRepository.findDefaultBranch(client, auth.tenantId);
      if (!def) throw BadRequest('No active branch found. Create a branch first.');
      branchId = def.id;
    }

    // Duplicate check (unless explicitly skipped)
    if (!skipDuplicateCheck) {
      const dups = await patientsRepository.findDuplicates(client, auth.tenantId, {
        mobile: input.mobile ?? undefined,
        fullName: input.fullName,
        dateOfBirth: input.dateOfBirth ?? undefined,
      });
      if (dups.length > 0) {
        throw Conflict('Possible duplicate patient found', { matches: dups });
      }
    }

    // Generate UHID atomically (per tenant)
    const uhid = await patientsRepository.nextUHID(client, auth.tenantId);

    const patient = await patientsRepository.create(client, {
      tenant_id: auth.tenantId,
      branch_id: branchId,
      uhid,
      full_name: input.fullName,
      date_of_birth: input.dateOfBirth ?? null,
      gender: input.gender ?? null,
      mobile: input.mobile ?? null,
      address: input.address ?? null,
      blood_group: input.bloodGroup ?? null,
      allergies: input.allergies ?? null,
      medical_history: input.medicalHistory ?? null,
      emergency_contact: input.emergencyContact ?? null,
      created_by: auth.userId,
      registration_amount: input.registrationAmount ?? null,
      reg_payment_mode: input.regPaymentMode ?? null,
      reg_payment_date: input.regPaymentDate ?? null,
      reg_receipt_no: input.regReceiptNo ?? null,
      coverage_type: input.coverageType ?? 'NONE',
      coverage_provider: input.coverageProvider ?? null,
      policy_number: input.policyNumber ?? null,
      coverage_validity: input.coverageValidity ?? null,
      coverage_notes: input.coverageNotes ?? null,
      first_visit_reason: input.firstVisitReason ?? null,
      first_doctor_id: input.firstDoctorId ?? null,
      first_department_id: input.firstDepartmentId ?? null,
      first_visit_at: input.firstVisitAt ?? null,
    });

    await audit({
      actorUserId: auth.userId,
      action: 'PATIENT_CREATED',
      entity: 'patients',
      entityId: patient.id,
      after: patient,
    });

    return patient;
  },

  async softDelete(auth: AuthContext, token: string, id: string) {
    if (!auth.tenantId) throw NotFound('No tenant context');
    const client = supabaseForUser(token);

    const before = await patientsRepository.findById(client, auth.tenantId, id);
    if (!before) throw NotFound('Patient not found');

    await patientsRepository.softDelete(client, auth.tenantId, id);

    await audit({
      actorUserId: auth.userId,
      action: 'PATIENT_SOFT_DELETED',
      entity: 'patients',
      entityId: id,
      before,
    });

    return { success: true };
  },

  async update(auth: AuthContext, token: string, id: string, patch: UpdatePatientInput, req_expectedUpdatedAt?: string) {
    if (!auth.tenantId) throw NotFound('No tenant context');
    const client = supabaseForUser(token);

    const before = await patientsRepository.findById(client, auth.tenantId, id);
    if (!before) throw NotFound('Patient not found');

    // Conflict detection - if the client told us which version it saw, verify it
    const expected = req_expectedUpdatedAt;
    assertNoConflict(expected, before.updated_at, before);

    const dbPatch: Record<string, unknown> = {};
    if (patch.fullName !== undefined)         dbPatch.full_name = patch.fullName;
    if (patch.dateOfBirth !== undefined)      dbPatch.date_of_birth = patch.dateOfBirth;
    if (patch.gender !== undefined)           dbPatch.gender = patch.gender;
    if (patch.mobile !== undefined)           dbPatch.mobile = patch.mobile;
    if (patch.address !== undefined)          dbPatch.address = patch.address;
    if (patch.bloodGroup !== undefined)       dbPatch.blood_group = patch.bloodGroup;
    if (patch.allergies !== undefined)        dbPatch.allergies = patch.allergies;
    if (patch.medicalHistory !== undefined)   dbPatch.medical_history = patch.medicalHistory;
    if (patch.emergencyContact !== undefined) dbPatch.emergency_contact = patch.emergencyContact;
    if (patch.registrationAmount !== undefined) dbPatch.registration_amount = patch.registrationAmount;
    if (patch.regPaymentMode !== undefined)   dbPatch.reg_payment_mode = patch.regPaymentMode;
    if (patch.regPaymentDate !== undefined)   dbPatch.reg_payment_date = patch.regPaymentDate;
    if (patch.regReceiptNo !== undefined)     dbPatch.reg_receipt_no = patch.regReceiptNo;
    if (patch.coverageType !== undefined)     dbPatch.coverage_type = patch.coverageType;
    if (patch.coverageProvider !== undefined) dbPatch.coverage_provider = patch.coverageProvider;
    if (patch.policyNumber !== undefined)     dbPatch.policy_number = patch.policyNumber;
    if (patch.coverageValidity !== undefined) dbPatch.coverage_validity = patch.coverageValidity;
    if (patch.coverageNotes !== undefined)    dbPatch.coverage_notes = patch.coverageNotes;
    if (patch.firstVisitReason !== undefined) dbPatch.first_visit_reason = patch.firstVisitReason;
    if (patch.firstDoctorId !== undefined)    dbPatch.first_doctor_id = patch.firstDoctorId;
    if (patch.firstDepartmentId !== undefined) dbPatch.first_department_id = patch.firstDepartmentId;
    if (patch.firstVisitAt !== undefined)     dbPatch.first_visit_at = patch.firstVisitAt;

    if (Object.keys(dbPatch).length === 0) return before;

    const after = await patientsRepository.update(client, auth.tenantId, id, dbPatch);

    await audit({
      actorUserId: auth.userId,
      action: 'PATIENT_UPDATED',
      entity: 'patients',
      entityId: id,
      before,
      after,
    });

    return after;
  },
};
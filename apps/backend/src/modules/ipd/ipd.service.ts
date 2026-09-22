import { supabaseForUser, supabaseAdmin } from '../../config/supabase.js';
import { ipdRepository as repo } from './ipd.repository.js';
import { BadRequest, Conflict, NotFound } from '../../utils/errors.js';
import { audit } from '../../middleware/audit.js';
import { logger } from '../../config/logger.js';
import type { AuthContext } from '@medical/shared';
import type {
  CreateLocationInput, UpdateLocationInput, ListLocationsQuery,
  AdmitPatientInput, TransferBedInput, DischargeInput, ListAdmissionsQuery,
  CreateNursingNoteInput, CreateDoctorRoundInput, CreateMarInput, MarkMarInput,
} from './ipd.validators.js';

export const ipdService = {
  // ---- Locations ----
  async listLocations(auth: AuthContext, token: string, q: ListLocationsQuery) {
    if (!auth.tenantId) throw NotFound('No tenant context');
    return repo.listLocations(supabaseForUser(token), auth.tenantId, q);
  },
  async createLocation(auth: AuthContext, token: string, input: CreateLocationInput) {
    if (!auth.tenantId) throw NotFound('No tenant context');
    const client = supabaseForUser(token);
    const loc = await repo.createLocation(client, {
      tenant_id: auth.tenantId,
      branch_id: input.branchId,
      parent_id: input.parentId ?? null,
      type: input.type,
      name: input.name,
      code: input.code ?? null,
      capacity: input.capacity ?? null,
    });
    await audit({ actorUserId: auth.userId, action: 'LOCATION_CREATED', entity: 'locations', entityId: loc.id, after: loc });
    return loc;
  },
  async updateLocation(auth: AuthContext, token: string, id: string, patch: UpdateLocationInput) {
    if (!auth.tenantId) throw NotFound('No tenant context');
    const client = supabaseForUser(token);
    const before = await repo.findLocation(client, auth.tenantId, id);
    if (!before) throw NotFound('Location not found');
    const dbPatch: Record<string, unknown> = {};
    if (patch.name !== undefined)     dbPatch.name = patch.name;
    if (patch.code !== undefined)     dbPatch.code = patch.code;
    if (patch.capacity !== undefined) dbPatch.capacity = patch.capacity;
    if (patch.isActive !== undefined) dbPatch.is_active = patch.isActive;
    const after = await repo.updateLocation(client, auth.tenantId, id, dbPatch);
    await audit({ actorUserId: auth.userId, action: 'LOCATION_UPDATED', entity: 'locations', entityId: id, before, after });
    return after;
  },

  async deleteLocation(auth: AuthContext, token: string, id: string) {
    if (!auth.tenantId) throw NotFound('No tenant context');
    const client = supabaseForUser(token);
    const before = await repo.findLocation(client, auth.tenantId, id);
    if (!before) throw NotFound('Location not found');

    const childCount = await repo.countChildren(client, auth.tenantId, id);
    if (childCount > 0) throw Conflict(`Cannot delete - has ${childCount} child location(s). Delete them first.`);

    const admCount = await repo.countAdmissionsForBed(client, auth.tenantId, id);
    if (admCount > 0) throw Conflict(`Cannot delete - bed has ${admCount} admission(s). Discharge the patient or mark the bed inactive instead.`);

    await repo.deleteLocation(client, auth.tenantId, id);
    await audit({ actorUserId: auth.userId, action: 'LOCATION_DELETED', entity: 'locations', entityId: id, before });
    return { success: true };
  },

  // ---- Beds ----
  async listBeds(auth: AuthContext, token: string, branchId?: string) {
    if (!auth.tenantId) throw NotFound('No tenant context');
    return repo.listBeds(supabaseForUser(token), auth.tenantId, branchId);
  },

  // ---- Admissions ----
  async listAdmissions(auth: AuthContext, token: string, q: ListAdmissionsQuery) {
    if (!auth.tenantId) throw NotFound('No tenant context');
    return repo.listAdmissions(supabaseForUser(token), auth.tenantId, q);
  },
  async getAdmission(auth: AuthContext, token: string, id: string) {
    if (!auth.tenantId) throw NotFound('No tenant context');
    const adm = await repo.findAdmissionFull(supabaseForUser(token), auth.tenantId, id);
    if (!adm) throw NotFound('Admission not found');
    return adm;
  },
  async admit(auth: AuthContext, token: string, input: AdmitPatientInput) {
    if (!auth.tenantId) throw NotFound('No tenant context');
    const client = supabaseForUser(token);
    const branchId = input.branchId ?? (await repo.findDefaultBranch(client, auth.tenantId))?.id ?? null;
    if (!branchId) throw BadRequest('No active branch found');

    const result = await repo.admit(client, {
      tenantId: auth.tenantId,
      userId: auth.userId,
      branchId,
      patientId: input.patientId,
      bedId: input.bedId,
      admittingDoctor: input.admittingDoctor,
      reason: input.reason ?? null,
      diagnosis: input.diagnosis ?? null,
      expectedDischarge: input.expectedDischarge ?? null,
    });

    await audit({ actorUserId: auth.userId, action: 'PATIENT_ADMITTED', entity: 'admissions', entityId: result.admissionId, after: { bedId: input.bedId } });
    return result;
  },
  async transfer(auth: AuthContext, token: string, admissionId: string, input: TransferBedInput) {
    if (!auth.tenantId) throw NotFound('No tenant context');
    const client = supabaseForUser(token);
    const adm = await repo.findAdmissionFull(client, auth.tenantId, admissionId);
    if (!adm) throw NotFound('Admission not found');
    if (adm.status !== 'ADMITTED') throw Conflict(`Cannot transfer in status ${adm.status}`);

    await repo.transfer(client, {
      tenantId: auth.tenantId,
      userId: auth.userId,
      admissionId,
      toBedId: input.toBedId,
      reason: input.reason,
    });

    await audit({ actorUserId: auth.userId, action: 'BED_TRANSFERRED', entity: 'admissions', entityId: admissionId, after: { toBedId: input.toBedId, reason: input.reason } });
    return { success: true };
  },
  async discharge(auth: AuthContext, token: string, admissionId: string, input: DischargeInput) {
    if (!auth.tenantId) throw NotFound('No tenant context');
    const client = supabaseForUser(token);
    const adm = await repo.findAdmissionFull(client, auth.tenantId, admissionId);
    if (!adm) throw NotFound('Admission not found');
    if (adm.status !== 'ADMITTED') throw Conflict(`Cannot discharge in status ${adm.status}`);

    await repo.discharge(client, {
      tenantId: auth.tenantId,
      userId: auth.userId,
      admissionId,
      dischargeType: input.dischargeType,
      dischargeSummary: input.dischargeSummary ?? null,
    });

    try {
      await supabaseAdmin
        .from('invoices')
        .update({ finalized_at: new Date().toISOString() })
        .eq('tenant_id', auth.tenantId)
        .eq('ipd_admission_id', admissionId)
        .eq('invoice_type', 'IPD')
        .is('finalized_at', null);
    } catch (e: any) {
      logger.warn({ admissionId, err: e }, 'Failed to finalize IPD invoice after discharge');
    }

    await audit({ actorUserId: auth.userId, action: 'PATIENT_DISCHARGED', entity: 'admissions', entityId: admissionId, after: { type: input.dischargeType } });
    return { success: true };
  },

  // ---- Nursing notes ----
  async createNursingNote(auth: AuthContext, token: string, admissionId: string, input: CreateNursingNoteInput) {
    if (!auth.tenantId) throw NotFound('No tenant context');
    const client = supabaseForUser(token);
    const adm = await repo.findAdmissionFull(client, auth.tenantId, admissionId);
    if (!adm) throw NotFound('Admission not found');

    const note = await repo.createNursingNote(client, {
      tenant_id: auth.tenantId,
      admission_id: admissionId,
      note_type: input.noteType,
      note: input.note,
      recorded_by: auth.userId,
    });

    await audit({ actorUserId: auth.userId, action: 'NURSING_NOTE_ADDED', entity: 'nursing_notes', entityId: note.id });
    return note;
  },

  // ---- Doctor rounds ----
  async createDoctorRound(auth: AuthContext, token: string, admissionId: string, input: CreateDoctorRoundInput) {
    if (!auth.tenantId) throw NotFound('No tenant context');
    const client = supabaseForUser(token);
    const adm = await repo.findAdmissionFull(client, auth.tenantId, admissionId);
    if (!adm) throw NotFound('Admission not found');

    const round = await repo.createDoctorRound(client, {
      tenant_id: auth.tenantId,
      admission_id: admissionId,
      doctor_id: auth.userId,
      clinical_notes: input.clinicalNotes ?? null,
      assessment: input.assessment ?? null,
      plan: input.plan ?? null,
    });

    await audit({ actorUserId: auth.userId, action: 'DOCTOR_ROUND_ADDED', entity: 'doctor_rounds', entityId: round.id });
    return round;
  },

  // ---- MAR ----
  async createMar(auth: AuthContext, token: string, admissionId: string, input: CreateMarInput) {
    if (!auth.tenantId) throw NotFound('No tenant context');
    const client = supabaseForUser(token);
    const adm = await repo.findAdmissionFull(client, auth.tenantId, admissionId);
    if (!adm) throw NotFound('Admission not found');

    const mar = await repo.createMar(client, {
      tenant_id: auth.tenantId,
      admission_id: admissionId,
      medication_name: input.medicationName,
      dose: input.dose ?? null,
      route: input.route ?? null,
      scheduled_at: input.scheduledAt,
      notes: input.notes ?? null,
      status: 'SCHEDULED',
    });

    await audit({ actorUserId: auth.userId, action: 'MAR_CREATED', entity: 'mar_records', entityId: mar.id });
    return mar;
  },
  async markMar(auth: AuthContext, token: string, marId: string, input: MarkMarInput) {
    if (!auth.tenantId) throw NotFound('No tenant context');
    const client = supabaseForUser(token);
    const before = await repo.findMar(client, auth.tenantId, marId);
    if (!before) throw NotFound('MAR record not found');

    const patch: Record<string, unknown> = {
      status: input.status,
      notes: input.notes ?? before.notes,
    };
    if (input.status === 'ADMINISTERED') {
      patch.administered_at = new Date().toISOString();
      patch.administered_by = auth.userId;
    }

    const after = await repo.markMar(client, auth.tenantId, marId, patch);
    await audit({ actorUserId: auth.userId, action: 'MAR_UPDATED', entity: 'mar_records', entityId: marId, before: { status: before.status }, after: { status: after.status } });
    return after;
  },
};
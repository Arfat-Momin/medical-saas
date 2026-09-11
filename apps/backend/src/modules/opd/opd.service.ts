import { supabaseForUser } from '../../config/supabase.js';
import { opdRepository } from './opd.repository.js';
import { BadRequest, Conflict, NotFound } from '../../utils/errors.js';
import { audit } from '../../middleware/audit.js';
import type { AuthContext } from '@medical/shared';
import type { SaveEncounterInput, CreateWalkInInput, ListEncountersQuery } from './opd.validators.js';

export const opdService = {
  async list(auth: AuthContext, token: string, q: ListEncountersQuery) {
    if (!auth.tenantId) throw NotFound('No tenant context');
    const client = supabaseForUser(token);
    return opdRepository.list(client, auth.tenantId, q);
  },

  async getById(auth: AuthContext, token: string, id: string) {
    if (!auth.tenantId) throw NotFound('No tenant context');
    const client = supabaseForUser(token);
    const enc = await opdRepository.findById(client, auth.tenantId, id);
    if (!enc) throw NotFound('Encounter not found');
    const [vitals, diagnoses, prescription] = await Promise.all([
      opdRepository.getVitals(client, id),
      opdRepository.getDiagnoses(client, id),
      opdRepository.getPrescription(client, id),
    ]);
    return { ...enc, vitals: vitals ?? null, diagnoses, prescription };
  },

  async createWalkIn(auth: AuthContext, token: string, input: CreateWalkInInput) {
    if (!auth.tenantId) throw NotFound('No tenant context');
    const client = supabaseForUser(token);

    let branchId = input.branchId;
    if (!branchId) {
      const def = await opdRepository.findDefaultBranch(client, auth.tenantId);
      if (!def) throw BadRequest('No active branch');
      branchId = def.id;
    }

    const encounter = await opdRepository.createEncounter(client, {
      tenant_id: auth.tenantId,
      branch_id: branchId,
      patient_id: input.patientId,
      doctor_id: input.doctorId,
      encounter_type: 'OPD',
      encounter_date: new Date().toISOString().slice(0, 10),
      chief_complaint: input.chiefComplaint ?? null,
      status: 'DRAFT',
      created_by: auth.userId,
    });

    await audit({
      actorUserId: auth.userId,
      action: 'ENCOUNTER_CREATED_WALKIN',
      entity: 'encounters',
      entityId: encounter.id,
      after: encounter,
    });

    return encounter;
  },

  async save(auth: AuthContext, token: string, id: string, input: SaveEncounterInput) {
    if (!auth.tenantId) throw NotFound('No tenant context');
    const client = supabaseForUser(token);

    const before = await opdRepository.findById(client, auth.tenantId, id);
    if (!before) throw NotFound('Encounter not found');
    if (before.status === 'COMPLETED') throw Conflict('Encounter already completed');

    // Update header fields on encounters table
    const dbPatch: Record<string, unknown> = {};
    if (input.chiefComplaint !== undefined) dbPatch.chief_complaint = input.chiefComplaint;
    if (input.history        !== undefined) dbPatch.history         = input.history;
    if (input.examination    !== undefined) dbPatch.examination     = input.examination;
    if (input.notes          !== undefined) dbPatch.notes           = input.notes;
    if (input.complete)                     dbPatch.status          = 'COMPLETED';

    if (Object.keys(dbPatch).length > 0) {
      await opdRepository.updateEncounter(client, auth.tenantId, id, dbPatch);
    }

    // Save nested bundle atomically via RPC
    if (input.vitals || input.diagnoses || input.prescription) {
      await opdRepository.saveEncounterBundle(client, {
        encounterId: id,
        tenantId: auth.tenantId,
        vitals: input.vitals ? {
          temperatureC: input.vitals.temperatureC ?? null,
          bpSystolic:   input.vitals.bpSystolic   ?? null,
          bpDiastolic:  input.vitals.bpDiastolic  ?? null,
          pulse:        input.vitals.pulse        ?? null,
          respRate:     input.vitals.respRate     ?? null,
          spo2:         input.vitals.spo2         ?? null,
          weightKg:     input.vitals.weightKg     ?? null,
          heightCm:     input.vitals.heightCm     ?? null,
          bmi:          input.vitals.bmi          ?? null,
        } : null,
        diagnoses: input.diagnoses ?? null,
        prescription: input.prescription ?? null,
      });
    }

    // If completed and linked to appointment  mark appointment completed
    if (input.complete && before.appointment_id) {
      await client
        .from('appointments')
        .update({ status: 'COMPLETED' })
        .eq('tenant_id', auth.tenantId)
        .eq('id', before.appointment_id);
    }

    await audit({
      actorUserId: auth.userId,
      action: input.complete ? 'ENCOUNTER_COMPLETED' : 'ENCOUNTER_UPDATED',
      entity: 'encounters',
      entityId: id,
      before,
      after: { status: input.complete ? 'COMPLETED' : 'DRAFT' },
    });

    return opdService.getById(auth, token, id);
  },
};
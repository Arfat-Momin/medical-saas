import { db, uuid, type LocalEncounter, type VitalsData, type DiagnosisData, type PrescriptionData, type LabTestData } from '@/db';
import { syncQueue } from '@/sync/queue';
import { useAuthStore } from '@/stores/auth.store';

export interface Encounter {
  id: string;
  local_id: string;
  server_id: string | null;
  patient_id: string;                 // patient_local_id
  patient_name?: string;
  patient_uhid?: string;
  doctor_id: string | null;
  appointment_id: string | null;
  appointment_server_id: string | null;
  encounter_date: string;
  status: 'DRAFT' | 'COMPLETED';
  chief_complaint: string | null;
  history: string | null;
  examination: string | null;
  notes: string | null;
  vitals: VitalsData | null;
  diagnoses: DiagnosisData[];
  prescription: PrescriptionData | null;
  lab_tests: LabTestData[];
  sync_status: 'pending' | 'synced' | 'failed' | 'conflict';
  created_at: string;
  updated_at: string;
}

export interface CreateEncounterInput {
  patientLocalId: string;
  doctorId: string;
  appointmentLocalId?: string | null;
  chiefComplaint?: string | null;
}

export interface SaveEncounterInput {
  chiefComplaint?: string | null;
  history?: string | null;
  examination?: string | null;
  notes?: string | null;
  vitals?: VitalsData | null;
  diagnoses?: DiagnosisData[] | null;
  prescription?: PrescriptionData | null;
  labTests?: LabTestData[] | null;
  complete?: boolean;
}

async function hydrate(enc: LocalEncounter): Promise<Encounter> {
  const patient = await db.patients.get(enc.patient_local_id);
  return {
    id: enc.local_id,
    local_id: enc.local_id,
    server_id: enc.server_id,
    patient_id: enc.patient_local_id,
    patient_name: patient?.full_name,
    patient_uhid: patient?.uhid ?? undefined,
    doctor_id: enc.doctor_id,
    appointment_id: enc.appointment_local_id,
    appointment_server_id: enc.appointment_server_id,
    encounter_date: enc.encounter_date,
    status: enc.status,
    chief_complaint: enc.chief_complaint,
    history: enc.history,
    examination: enc.examination,
    notes: enc.notes,
    vitals: enc.vitals,
    diagnoses: enc.diagnoses ?? [],
    prescription: enc.prescription,
    lab_tests: enc.labTests ?? [],
    sync_status: enc.sync_status,
    created_at: enc.created_at,
    updated_at: enc.updated_at,
  };
}

export const encountersRepository = {
  async getById(localId: string): Promise<Encounter> {
    const enc = await db.encounters.get(localId);
    if (!enc) throw new Error('Encounter not found');
    return hydrate(enc);
  },

  async findByAppointment(appointmentLocalId: string): Promise<Encounter | null> {
    const enc = await db.encounters
      .where('appointment_local_id')
      .equals(appointmentLocalId)
      .filter((e) => e.deleted === 0)
      .first();
    return enc ? hydrate(enc) : null;
  },

  async findByPatient(patientLocalId: string): Promise<Encounter[]> {
    const rows = await db.encounters
      .where('patient_local_id')
      .equals(patientLocalId)
      .filter((e) => e.deleted === 0)
      .toArray();
    rows.sort((a, b) => b.created_at.localeCompare(a.created_at));
    return Promise.all(rows.map(hydrate));
  },

  /**
   * Create a new encounter (from an appointment or walk-in).
   * Saves to IndexedDB instantly and enqueues for sync.
   */
  async create(input: CreateEncounterInput): Promise<Encounter> {
    const now = new Date().toISOString();
    const localId = uuid();
    const tenantId = useAuthStore.getState().tenantId;
    const branchId = useAuthStore.getState().primaryBranchId;
    const today = new Date().toISOString().slice(0, 10);

    const patient = await db.patients.get(input.patientLocalId);
    if (!patient) throw new Error('Patient not found');

    let appointmentServerId: string | null = null;
    if (input.appointmentLocalId) {
      const apt = await db.appointments.get(input.appointmentLocalId);
      appointmentServerId = apt?.server_id ?? null;
    }

    const enc: LocalEncounter = {
      local_id: localId,
      server_id: null,
      tenant_id: tenantId,
      branch_id: branchId ?? null,
      patient_local_id: input.patientLocalId,
      patient_server_id: patient.server_id,
      doctor_id: input.doctorId,
      appointment_local_id: input.appointmentLocalId ?? null,
      appointment_server_id: appointmentServerId,
      encounter_date: today,
      status: 'DRAFT',
      chief_complaint: input.chiefComplaint ?? null,
      history: null,
      examination: null,
      notes: null,
      vitals: null,
      diagnoses: [],
      prescription: null,
      labTests: [],
      sync_status: 'pending',
      sync_error: null,
      server_updated_at: null,
      created_at: now,
      updated_at: now,
      deleted: 0,
    };

    await db.encounters.add(enc);

    // If linked to an appointment, mark it IN_PROGRESS locally
    if (input.appointmentLocalId) {
      await db.appointments.update(input.appointmentLocalId, {
        status: 'IN_PROGRESS',
        sync_status: 'pending',
        updated_at: now,
      });
    }

    // Queue for sync
    await syncQueue.enqueue({
      entity: 'encounters',
      operation: 'create',
      localId,
      payload: {
        patientLocalId: input.patientLocalId,
        appointmentLocalId: input.appointmentLocalId ?? null,
        doctorId: input.doctorId,
        chiefComplaint: input.chiefComplaint ?? null,
      },
    });

    return hydrate(enc);
  },

  /**
   * Save draft or complete consultation.
   * All writes go to IndexedDB first, then queue for sync.
   */
  async save(localId: string, input: SaveEncounterInput): Promise<Encounter> {
    const existing = await db.encounters.get(localId);
    if (!existing) throw new Error('Encounter not found');
    if (existing.status === 'COMPLETED') throw new Error('Cannot edit a completed encounter');

    const now = new Date().toISOString();
    const patch: Partial<LocalEncounter> = {
      updated_at: now,
      sync_status: 'pending',
      sync_error: null,
    };

    if (input.chiefComplaint !== undefined) patch.chief_complaint = input.chiefComplaint;
    if (input.history        !== undefined) patch.history = input.history;
    if (input.examination    !== undefined) patch.examination = input.examination;
    if (input.notes          !== undefined) patch.notes = input.notes;
    if (input.vitals         !== undefined) patch.vitals = input.vitals;
    if (input.diagnoses      !== undefined) patch.diagnoses = input.diagnoses ?? [];
    if (input.prescription   !== undefined) patch.prescription = input.prescription;
    if (input.labTests       !== undefined) patch.labTests = input.labTests ?? [];
    if (input.complete)                     patch.status = 'COMPLETED';

    await db.encounters.update(localId, patch);

    // If completing, also mark the linked appointment COMPLETED
    if (input.complete && existing.appointment_local_id) {
      await db.appointments.update(existing.appointment_local_id, {
        status: 'COMPLETED',
        sync_status: 'pending',
        updated_at: now,
      });

      await syncQueue.enqueue({
        entity: 'appointments',
        operation: 'update',
        localId: existing.appointment_local_id,
        payload: {
          serverId: existing.appointment_server_id,
          patch: { status: 'COMPLETED' },
        },
      });
    }

    // Queue the encounter update
    await syncQueue.enqueue({
      entity: 'encounters',
      operation: 'update',
      localId,
      payload: {
        serverId: existing.server_id,
        expectedUpdatedAt: existing.server_updated_at,
        complete: input.complete ?? false,
      },
    });

    const fresh = await db.encounters.get(localId);
    return hydrate(fresh!);
  },

  async setServerId(localId: string, serverId: string) {
    await db.encounters.update(localId, { server_id: serverId });
  },

  async markSynced(localId: string, serverUpdatedAt?: string) {
    const patch: Partial<LocalEncounter> = {
      sync_status: 'synced',
      sync_error: null,
      updated_at: new Date().toISOString(),
    };
    if (serverUpdatedAt) patch.server_updated_at = serverUpdatedAt;
    await db.encounters.update(localId, patch);
  },

  async applySyncError(localId: string, error: string) {
    const isConflict = error.startsWith('CONFLICT:');
    await db.encounters.update(localId, {
      sync_status: isConflict ? 'conflict' : 'failed',
      sync_error: error.slice(0, 500),
    });
  },

  async countAll(): Promise<number> {
    return db.encounters.where('deleted').equals(0).count();
  },

  async countToday(): Promise<number> {
    const today = new Date().toISOString().slice(0, 10);
    const all = await db.encounters.where('deleted').equals(0).toArray();
    return all.filter((e) => e.encounter_date === today).length;
  },
};

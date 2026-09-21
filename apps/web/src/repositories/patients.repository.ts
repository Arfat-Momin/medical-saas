import { db, uuid, meta, type LocalPatient } from '@/db';
import { syncQueue } from '@/sync/queue';
import { useAuthStore } from '@/stores/auth.store';

/** What the UI expects (kept for compatibility with existing components). */
export interface Patient {
  id: string;                 // = local_id
  local_id: string;
  server_id: string | null;
  tenant_id: string;
  branch_id: string;
  uhid: string;
  full_name: string;
  date_of_birth: string | null;
  gender: 'MALE' | 'FEMALE' | 'OTHER' | null;
  mobile: string | null;
  address: string | null;
  blood_group: string | null;
  allergies: string | null;
  medical_history: string | null;
  emergency_contact: string | null;
  sync_status: 'pending' | 'synced' | 'failed' | 'conflict' | 'blocked';
  created_at: string;
  updated_at: string;
}

export interface ListPatientsResponse {
  rows: Patient[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CreatePatientInput {
  fullName: string;
  dateOfBirth?: string | null;
  gender?: 'MALE' | 'FEMALE' | 'OTHER' | null;
  mobile?: string | null;
  address?: string | null;
  bloodGroup?: string | null;
  allergies?: string | null;
  medicalHistory?: string | null;
  emergencyContact?: string | null;
  branchId?: string;
  skipDuplicateCheck?: boolean;
}

export interface DuplicateMatch {
  id: string;
  uhid: string;
  full_name: string;
  mobile: string | null;
  date_of_birth: string | null;
  reason: 'same_mobile' | 'same_name_dob';
}

// ---------- Mapping helpers ----------
function toPatient(p: LocalPatient): Patient {
  return {
    id: p.local_id,
    local_id: p.local_id,
    server_id: p.server_id,
    tenant_id: p.tenant_id ?? '',
    branch_id: p.branch_id ?? '',
    uhid: p.uhid ?? 'PENDING',
    full_name: p.full_name,
    date_of_birth: p.date_of_birth,
    gender: p.gender,
    mobile: p.mobile,
    address: p.address,
    blood_group: p.blood_group,
    allergies: p.allergies,
    medical_history: p.medical_history,
    emergency_contact: p.emergency_contact,
    sync_status: p.sync_status,
    created_at: p.created_at,
    updated_at: p.updated_at,
  };
}

export const patientsRepository = {
  /**
   * List patients from the LOCAL IndexedDB.
   * Instant. Works offline. Uses the local mirror that the sync engine keeps fresh.
   */
  async list(params: {
    page?: number;
    pageSize?: number;
    search?: string;
    branchId?: string;
  }): Promise<ListPatientsResponse> {
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 10;
    const search = params.search?.trim().toLowerCase() ?? '';

    let all = await db.patients
      .where('deleted')
      .equals(0)
      .toArray();

    if (search) {
      all = all.filter((p) =>
        p.full_name.toLowerCase().includes(search) ||
        (p.mobile ?? '').includes(search) ||
        (p.uhid ?? '').toLowerCase().includes(search)
      );
    }

    // Newest first
    all.sort((a, b) => b.created_at.localeCompare(a.created_at));

    const total = all.length;
    const start = (page - 1) * pageSize;
    const rows = all.slice(start, start + pageSize).map(toPatient);

    return { rows, total, page, pageSize };
  },

  async getById(id: string): Promise<Patient> {
    const p = await db.patients.get(id);
    if (!p) throw new Error('Patient not found');
    return toPatient(p);
  },

  /**
   * Register a patient - writes to IndexedDB immediately, enqueues a sync.
   * Returns in milliseconds. No network call required.
   */
  async create(input: CreatePatientInput): Promise<Patient> {
    const now = new Date().toISOString();
    const localId = uuid();
    const tenantId = useAuthStore.getState().tenantId;
    const branchId = input.branchId ?? useAuthStore.getState().primaryBranchId;

    const patient: LocalPatient = {
      local_id: localId,
      server_id: null,
      tenant_id: tenantId,
      branch_id: branchId ?? null,
      uhid: null,
      full_name: input.fullName.trim(),
      date_of_birth: input.dateOfBirth ?? null,
      gender: input.gender ?? null,
      mobile: input.mobile ?? null,
      address: input.address ?? null,
      blood_group: input.bloodGroup ?? null,
      allergies: input.allergies ?? null,
      medical_history: input.medicalHistory ?? null,
      emergency_contact: input.emergencyContact ?? null,
      sync_status: 'pending',
      sync_error: null,
      server_updated_at: null,
      created_at: now,
      updated_at: now,
      deleted: 0,
    };

    await db.patients.add(patient);

    // Enqueue for background push.
    //
    // INTEGRITY:
    //   `skipDuplicateCheck: true` is sent ONLY when the caller
    //   explicitly asked for it (after the UI showed the user a local
    //   duplicate warning and they clicked "Register anyway"). In every
    //   other case the backend performs its own authoritative duplicate
    //   check against the server data, which the local cache cannot
    //   see.
    await syncQueue.enqueue({
      entity: 'patients',
      operation: 'create',
      localId,
      payload: {
        fullName: patient.full_name,
        dateOfBirth: patient.date_of_birth,
        gender: patient.gender,
        mobile: patient.mobile,
        address: patient.address,
        bloodGroup: patient.blood_group,
        allergies: patient.allergies,
        medicalHistory: patient.medical_history,
        emergencyContact: patient.emergency_contact,
        ...(input.skipDuplicateCheck === true ? { skipDuplicateCheck: true } : {}),
      },
    });

    return toPatient(patient);
  },

  async update(id: string, patch: Partial<CreatePatientInput>): Promise<Patient> {
    const existing = await db.patients.get(id);
    if (!existing) throw new Error('Patient not found');

    const now = new Date().toISOString();
    const fieldMap: Record<keyof CreatePatientInput, keyof LocalPatient> = {
      fullName: 'full_name',
      dateOfBirth: 'date_of_birth',
      gender: 'gender',
      mobile: 'mobile',
      address: 'address',
      bloodGroup: 'blood_group',
      allergies: 'allergies',
      medicalHistory: 'medical_history',
      emergencyContact: 'emergency_contact',
      branchId: 'branch_id',
      skipDuplicateCheck: 'local_id', // no-op
    };

    const updated: Partial<LocalPatient> = {
      updated_at: now,
      sync_status: 'pending',
      sync_error: null,
    };

    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined) continue;
      const col = fieldMap[k as keyof CreatePatientInput];
      if (col && col !== 'local_id') {
        (updated as any)[col] = v;
      }
    }

    await db.patients.update(id, updated);

    await syncQueue.enqueue({
      entity: 'patients',
      operation: 'update',
      localId: id,
      payload: {
        serverId: existing.server_id,
        patch,
        expectedUpdatedAt: existing.server_updated_at,
      },
    });

    const fresh = await db.patients.get(id);
    return toPatient(fresh!);
  },

  async remove(id: string): Promise<void> {
    const existing = await db.patients.get(id);
    if (!existing) return;

    await db.patients.update(id, {
      deleted: 1,
      sync_status: 'pending',
      updated_at: new Date().toISOString(),
    });

    await syncQueue.enqueue({
      entity: 'patients',
      operation: 'delete',
      localId: id,
      payload: { serverId: existing.server_id },
    });
  },

  async checkDuplicate(input: {
    mobile?: string;
    fullName?: string;
    dateOfBirth?: string;
  }): Promise<{ hasDuplicates: boolean; matches: DuplicateMatch[] }> {
    const all = await db.patients.where('deleted').equals(0).toArray();
    const matches: DuplicateMatch[] = [];

    if (input.mobile) {
      for (const p of all) {
        if (p.mobile === input.mobile) {
          matches.push({
            id: p.local_id,
            uhid: p.uhid ?? 'PENDING',
            full_name: p.full_name,
            mobile: p.mobile,
            date_of_birth: p.date_of_birth,
            reason: 'same_mobile',
          });
        }
      }
    }

    if (input.fullName && input.dateOfBirth) {
      for (const p of all) {
        if (
          p.full_name.toLowerCase() === input.fullName.toLowerCase() &&
          p.date_of_birth === input.dateOfBirth
        ) {
          if (!matches.some((m) => m.id === p.local_id)) {
            matches.push({
              id: p.local_id,
              uhid: p.uhid ?? 'PENDING',
              full_name: p.full_name,
              mobile: p.mobile,
              date_of_birth: p.date_of_birth,
              reason: 'same_name_dob',
            });
          }
        }
      }
    }

    return { hasDuplicates: matches.length > 0, matches };
  },

  /** Used by the sync engine after a successful create. */
  async applyCreateSuccess(localId: string, server: { id: string; uhid: string; updated_at?: string }) {
    const now = new Date().toISOString();
    await db.patients.update(localId, {
      server_id: server.id,
      uhid: server.uhid,
      server_updated_at: server.updated_at ?? now,
      sync_status: 'synced',
      sync_error: null,
      updated_at: now,
    });
  },

  async applySyncError(localId: string, error: string) {
    const isConflict = error.startsWith('CONFLICT:');
    await db.patients.update(localId, {
      sync_status: isConflict ? 'conflict' : 'failed',
      sync_error: error.slice(0, 500),
    });
  },

  async markSynced(localId: string, serverUpdatedAt?: string) {
    const patch: Record<string, unknown> = {
      sync_status: 'synced',
      sync_error: null,
      updated_at: new Date().toISOString(),
    };
    if (serverUpdatedAt) patch.server_updated_at = serverUpdatedAt;
    await db.patients.update(localId, patch);
  },

  /** Upsert from server (used by the pull phase). */
  async upsertFromServer(server: any): Promise<void> {
    // Batch 6: server says this patient was soft-deleted. Mark the local
    // Dexie row as deleted so it disappears from every list. We keep the
    // row as a tombstone (deleted: 1) so a later pull doesn't resurrect
    // it, and so the sync engine's queue logic still finds the local id.
    if (server.deleted_at) {
      let existingDeleted = await db.patients.where('server_id').equals(server.id).first();
      if (!existingDeleted && server.mobile) {
        const candidates = await db.patients
          .where('mobile')
          .equals(server.mobile)
          .filter(
            (p) =>
              p.server_id === null &&
              p.full_name.toLowerCase() === (server.full_name ?? '').toLowerCase(),
          )
          .toArray();
        existingDeleted = candidates[0];
      }
      if (existingDeleted) {
        await db.patients.update(existingDeleted.local_id, {
          deleted: 1,
          sync_status: 'synced',
          sync_error: null,
          server_updated_at: server.updated_at,
          updated_at: server.updated_at,
        });
      }
      return;
    }

    // 1. Try by server_id (normal path)
    let existing = await db.patients.where('server_id').equals(server.id).first();

    // 2. If not found, check for a local-pending row with the same mobile + full_name
    //    This handles the race condition where:
    //      - The local row was created but its server_id wasn't written yet
    //      - A pull fires and finds the new server-side row
    if (!existing) {
      const candidates = await db.patients
        .where('mobile')
        .equals(server.mobile ?? '__none__')
        .filter((p) =>
          p.deleted === 0 &&
          p.server_id === null &&
          p.full_name.toLowerCase() === (server.full_name ?? '').toLowerCase()
        )
        .toArray();

      if (candidates.length > 0) {
        existing = candidates[0];
        console.log(`[upsert] Matched local pending row for ${server.uhid} via mobile+name`);
      }
    }

    if (existing) {
      if (existing.sync_status === 'pending') return; // don't clobber local edits
      await db.patients.update(existing.local_id, {
        uhid: server.uhid,
        full_name: server.full_name,
        date_of_birth: server.date_of_birth,
        gender: server.gender,
        mobile: server.mobile,
        address: server.address,
        blood_group: server.blood_group,
        allergies: server.allergies,
        medical_history: server.medical_history,
        emergency_contact: server.emergency_contact,
        sync_status: 'synced',
        sync_error: null,
        server_updated_at: server.updated_at,
        updated_at: server.updated_at,
      });
      return;
    }

    await db.patients.add({
      local_id: uuid(),
      server_id: server.id,
      tenant_id: server.tenant_id ?? null,
      branch_id: server.branch_id ?? null,
      uhid: server.uhid,
      full_name: server.full_name,
      date_of_birth: server.date_of_birth,
      gender: server.gender,
      mobile: server.mobile,
      address: server.address,
      blood_group: server.blood_group,
      allergies: server.allergies,
      medical_history: server.medical_history,
      emergency_contact: server.emergency_contact,
      sync_status: 'synced',
      sync_error: null,
      server_updated_at: server.updated_at,
      created_at: server.created_at,
      updated_at: server.updated_at,
      deleted: 0,
    });
  },

  /** Count helpers for the dashboard. */
  async countTotal(): Promise<number> {
    const tenantId = useAuthStore.getState().tenantId;
    if (!tenantId) return 0;
    const rows = await db.patients.where('deleted').equals(0).toArray();
    return rows.filter((p) => p.tenant_id === tenantId).length;
  },
  async countPending(): Promise<number> {
    const tenantId = useAuthStore.getState().tenantId;
    if (!tenantId) return 0;
    const rows = await db.patients.where('sync_status').equals('pending').toArray();
    return rows.filter((p) => p.tenant_id === tenantId).length;
  },
};

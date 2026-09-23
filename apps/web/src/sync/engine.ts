import { db, meta } from '@/db';
import { api, ApiError } from '@/lib/api';
import { syncQueue as queue } from './queue';
import { patientsRepository } from '@/repositories/patients.repository';
import { appointmentsRepository } from '@/repositories/appointments.repository';
import { encountersRepository } from '@/repositories/encounters.repository';
import { doctorsRepository } from '@/repositories/doctors.repository';
import {
  medicinesLocalRepository,
  labTestsLocalRepository,
  organizationLocalRepository,
  branchesLocalRepository,
  encounterHeadersLocalRepository,
} from '@/repositories/offline.repositories';
import { useAuthStore } from '@/stores/auth.store';
import type { QueueItem } from '@/db/schema';

const PAGE_SIZE = 500;

interface PushResult {
  pushed: number;
  failed: number;
  pulled: number;
  skipped: number;
}

type Handler = (item: QueueItem, payload: any) => Promise<void>;

const handlers: Record<string, Handler> = {
  async patients(item, payload) {
    if (item.operation === 'create') {
      // INTEGRITY:
      //   Do NOT force skipDuplicateCheck here. The payload already
      //   carries the caller's intent: `true` only when the UI showed
      //   the user a local duplicate warning and they clicked
      //   "Register anyway". Otherwise the backend performs its own
      //   authoritative duplicate check.
      const res = await api.post<{ id: string; uhid: string; updated_at: string }>(
        '/patients',
        payload,
        { idempotencyKey: item.idempotency_key, deviceId: item.device_id },
      );
      await patientsRepository.applyCreateSuccess(item.local_id, res);
      await queue.unblockDependencies(item.local_id);
      return;
    }
    if (item.operation === 'update') {
      const local = await db.patients.get(item.local_id);
      const serverId = local?.server_id ?? payload.serverId;
      if (!serverId) throw new Error('Patient not yet synced');
      try {
        const res = await api.patch<{ updated_at?: string }>(
          `/patients/${serverId}`,
          payload.patch,
          { expectedUpdatedAt: payload.expectedUpdatedAt, idempotencyKey: item.idempotency_key, deviceId: item.device_id },
        );
        await patientsRepository.markSynced(item.local_id, res?.updated_at);
      } catch (e: any) {
        if (e instanceof ApiError && e.status === 409 && (e.details as any)?.conflict) {
          await queue.markConflict(item.id, `CONFLICT: ${e.message}`);
          await patientsRepository.applySyncError(item.local_id, `CONFLICT: ${e.message}`);
          return;
        }
        throw e;
      }
      return;
    }
    if (item.operation === 'delete' && payload?.serverId) {
      await api.delete(`/patients/${payload.serverId}`, { idempotencyKey: item.idempotency_key, deviceId: item.device_id });
    }
  },

  async appointments(item, payload) {
    if (item.operation === 'create') {
      let patientId = payload.patientId;
      if (!patientId && payload.patientLocalId) {
        const localPatient = await db.patients.get(payload.patientLocalId);
        patientId = localPatient?.server_id ?? null;
      }
      if (!patientId) throw new Error('Waiting for patient to sync first');
      const res = await api.post<{ id: string; queue_token: number | null; updated_at: string }>(
        '/appointments',
        {
          patientId,
          doctorId: payload.doctorId,
          appointmentDate: payload.appointmentDate,
          slotTime: payload.slotTime ?? undefined,
          chiefComplaint: payload.chiefComplaint ?? null,
          notes: payload.notes ?? null,
        },
        { idempotencyKey: item.idempotency_key, deviceId: item.device_id },
      );
      await appointmentsRepository.applyCreateSuccess(item.local_id, res);
      return;
    }
    if (item.operation === 'update') {
      const local = await db.appointments.get(item.local_id);
      const serverId = local?.server_id ?? payload.serverId;
      if (!serverId) throw new Error('Appointment not yet synced');
      if (payload.patch?.status === 'CHECKED_IN') {
        try {
          const res = await api.post<{ queue_token: number | null; updated_at: string }>(
            `/appointments/${serverId}/check-in`,
            undefined,
            { idempotencyKey: item.idempotency_key, deviceId: item.device_id },
          );
          await appointmentsRepository.applyCreateSuccess(item.local_id, {
            id: serverId,
            queue_token: res.queue_token,
            updated_at: res.updated_at,
          });
        } catch (e: any) {
          if (e instanceof ApiError && e.status === 409) { await appointmentsRepository.markSynced(item.local_id); return; }
          throw e;
        }
        return;
      }
      if (payload.patch?.status) {
        try {
          const res = await api.patch<{ updated_at?: string }>(
            `/appointments/${serverId}/status`,
            { status: payload.patch.status },
            { expectedUpdatedAt: payload.expectedUpdatedAt, idempotencyKey: item.idempotency_key, deviceId: item.device_id },
          );
          await appointmentsRepository.markSynced(item.local_id, res?.updated_at);
        } catch (e: any) {
          if (e instanceof ApiError && e.status === 409) { await appointmentsRepository.markSynced(item.local_id); return; }
          throw e;
        }
        return;
      }
      await appointmentsRepository.markSynced(item.local_id);
      return;
    }
    if (item.operation === 'delete') {
      const local = await db.appointments.get(item.local_id);
      const serverId = local?.server_id ?? payload.serverId;
      if (serverId) await api.delete(`/appointments/${serverId}`, { idempotencyKey: item.idempotency_key, deviceId: item.device_id });
    }
  },

  async encounters(item, _payload) {
    const local = await db.encounters.get(item.local_id);
    if (!local) throw new Error('Encounter missing locally');
    let serverId: string | null = local.server_id;
    if (!serverId) {
      if (local.appointment_local_id) {
        const appt = await db.appointments.get(local.appointment_local_id);
        if (!appt?.server_id) throw new Error('Waiting for appointment to sync first');
        const startRes = await api.post<{ id: string }>(
          `/appointments/${appt.server_id}/start`, undefined,
          { idempotencyKey: item.idempotency_key, deviceId: item.device_id },
        );
        serverId = startRes.id;
      } else {
        let patientServerId = local.patient_server_id;
        if (!patientServerId && local.patient_local_id) {
          const patient = await db.patients.get(local.patient_local_id);
          patientServerId = patient?.server_id ?? null;
        }
        if (!patientServerId) throw new Error('Waiting for patient to sync first');
        const startRes = await api.post<{ id: string }>(
          '/opd/encounters',
          { patientId: patientServerId, doctorId: local.doctor_id, chiefComplaint: local.chief_complaint ?? null },
          { idempotencyKey: item.idempotency_key, deviceId: item.device_id },
        );
        serverId = startRes.id;
      }
      await encountersRepository.setServerId(item.local_id, serverId);
    }
    try {
      const res = await api.patch<{ updated_at?: string }>(
        `/opd/encounters/${serverId}`,
        {
          chiefComplaint: local.chief_complaint,
          history: local.history,
          examination: local.examination,
          notes: local.notes,
          vitals: local.vitals ?? undefined,
          diagnoses: (local.diagnoses ?? []).map((x) => ({ diagnosisText: x.diagnosisText, icdCode: x.icdCode, notes: x.notes, isPrimary: x.isPrimary })),
          prescription: local.prescription ?? undefined,
          labTests: (local.labTests ?? []).map((x) => ({
            testId: x.testId, testCode: x.testCode ?? null, testName: x.testName,
            sampleType: x.sampleType ?? null, price: Number(x.price ?? 0), referenceText: x.referenceText ?? null,
          })),
          complete: local.status === 'COMPLETED',
        },
        { expectedUpdatedAt: local.server_updated_at ?? undefined, idempotencyKey: item.idempotency_key, deviceId: item.device_id },
      );
      await encountersRepository.markSynced(item.local_id, res?.updated_at);
    } catch (e: any) {
      if (e instanceof ApiError && e.status === 409 && /already completed/i.test(e.message)) {
        await encountersRepository.markSynced(item.local_id);
        return;
      }
      if (e instanceof ApiError && e.status === 409 && (e.details as any)?.conflict) {
        await queue.markConflict(item.id, `CONFLICT: ${e.message}`);
        await encountersRepository.applySyncError(item.local_id, `CONFLICT: ${e.message}`);
        return;
      }
      throw e;
    }
  },
};

// ============================================================
// PULL ENGINE
// ============================================================

export type PullableEntity =
  | 'patients'
  | 'appointments'
  | 'encounters'
  | 'medicines'
  | 'lab_tests'
  | 'doctors'
  | 'branches'
  | 'organization';

interface EntityConfig {
  kind: 'incremental' | 'full';
  /** Number of rows already cached for the current tenant. */
  localCount?: () => Promise<number>;
  /** Write one server row into Dexie. */
  upsert: (row: any) => Promise<unknown>;
}

const ENTITY_CONFIG: Record<PullableEntity, EntityConfig> = {
  patients: {
    kind: 'incremental',
    localCount: () => db.patients.count(),
    upsert: (row) => patientsRepository.upsertFromServer(row),
  },
  appointments: {
    kind: 'incremental',
    localCount: () => db.appointments.count(),
    upsert: (row) => appointmentsRepository.upsertFromServer(row),
  },
  encounters: {
    kind: 'incremental',
    localCount: async () => {
      const t = useAuthStore.getState().tenantId;
      if (!t) return 0;
      return db.encounterHeaders.where('tenant_id').equals(t).count();
    },
    upsert: (row) => encounterHeadersLocalRepository.upsertFromServer(row),
  },
  medicines: {
    kind: 'incremental',
    localCount: async () => {
      const t = useAuthStore.getState().tenantId;
      if (!t) return 0;
      return db.medicines.where('tenant_id').equals(t).count();
    },
    upsert: (row) => medicinesLocalRepository.upsertFromServer(row),
  },
  lab_tests: {
    kind: 'incremental',
    localCount: async () => {
      const t = useAuthStore.getState().tenantId;
      if (!t) return 0;
      return db.labTests.where('tenant_id').equals(t).count();
    },
    upsert: (row) => labTestsLocalRepository.upsertFromServer(row),
  },
  doctors: {
    kind: 'full',
    upsert: (row) => doctorsRepository.upsertFromServer(row),
  },
  branches: {
    kind: 'full',
    upsert: (row) => branchesLocalRepository.upsertFromServer(row),
  },
  organization: {
    kind: 'full',
    upsert: (row) => organizationLocalRepository.upsertFromServer(row),
  },
};

interface PullResponse {
  rows: any[];
  serverTime: string;
  hasMore?: boolean;
}

const INFLIGHT: Partial<Record<PullableEntity, Promise<number>>> = {};

async function pullIncremental(
  entity: PullableEntity,
  config: EntityConfig,
  tenantId: string,
): Promise<number> {
  const cursorKey = `last_pull_at:${tenantId}:${entity}`;

  // Self-heal: zero cached rows for this tenant means any stored cursor
  // is meaningless - ignore it and take the full set.
  const count = config.localCount ? await config.localCount() : 0;
  const since = count === 0 ? null : await meta.get(cursorKey);

  let pulled = 0;
  let offset = 0;
  let hasMore = true;
  let finalServerTime: string | null = null;

  // IMPORTANT: `since` is captured ONCE before the loop. Re-reading it
  // on every iteration would use page-1's serverTime on page 2 and
  // silently skip rows that landed in between.
  while (hasMore) {
    const url =
      `/sync/pull?entity=${entity}&limit=${PAGE_SIZE}&offset=${offset}` +
      (since ? `&since=${encodeURIComponent(since)}` : '');
    const res = await api.get<PullResponse>(url);

    for (const row of res.rows) {
      try {
        await config.upsert(row);
        pulled++;
      } catch (err) {
        console.warn(`[sync] ${entity} upsert failed for ${row?.id}`, err);
      }
    }

    finalServerTime = res.serverTime;
    hasMore = res.hasMore === true;
    offset += PAGE_SIZE;

    // Safety net against a backend misreporting hasMore.
    if (offset > 100_000) break;
  }

  if (finalServerTime) await meta.set(cursorKey, finalServerTime);
  return pulled;
}

async function pullFull(
  entity: PullableEntity,
  config: EntityConfig,
): Promise<number> {
  const res = await api.get<PullResponse>(`/sync/pull?entity=${entity}`);
  let pulled = 0;
  for (const row of res.rows) {
    try {
      await config.upsert(row);
      pulled++;
    } catch (err) {
      console.warn(`[sync] ${entity} upsert failed for ${row?.id}`, err);
    }
  }
  return pulled;
}

async function pullOne(entity: PullableEntity): Promise<number> {
  const existing = INFLIGHT[entity];
  if (existing) return existing;

  const run = (async () => {
    const token = useAuthStore.getState().accessToken;
    const tenantId = useAuthStore.getState().tenantId;
    if (!token || !tenantId) return 0;

    const config = ENTITY_CONFIG[entity];
    if (!config) return 0;

    try {
      if (config.kind === 'incremental') {
        return await pullIncremental(entity, config, tenantId);
      }
      return await pullFull(entity, config);
    } catch (err) {
      // A 403 on one entity must never abort the rest of the sync.
      console.warn(`[sync] pull(${entity}) failed`, err);
      return 0;
    }
  })();

  INFLIGHT[entity] = run;
  try {
    return await run;
  } finally {
    delete INFLIGHT[entity];
  }
}

// ============================================================
// SYNC ENGINE
// ============================================================

export const syncEngine = {
  running: false,
  stopRequested: false,

  stop(): void {
    this.stopRequested = true;
  },

  async run(): Promise<PushResult> {
    if (this.running) return { pushed: 0, failed: 0, pulled: 0, skipped: 0 };
    if (!useAuthStore.getState().accessToken) return { pushed: 0, failed: 0, pulled: 0, skipped: 0 };
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      return { pushed: 0, failed: 0, pulled: 0, skipped: 0 };
    }
    this.running = true;
    this.stopRequested = false;
    const result: PushResult = { pushed: 0, failed: 0, pulled: 0, skipped: 0 };
    try {
      await queue.resetInflight();
      const items = await queue.pending(20);
      for (const item of items) {
        if (this.stopRequested) break;
        const handler = handlers[item.entity];
        if (!handler) { await queue.markFailed(item.id, `No handler for entity ${item.entity}`); result.skipped++; continue; }
        await queue.markInflight(item.id);
        try {
          const raw = item.payload;
          const payload: any = typeof raw === 'string' ? JSON.parse(raw) : raw;
          await handler(item, payload);
          await queue.markDone(item.id);
          result.pushed++;
        } catch (e: any) {
          const errMsg = e instanceof ApiError ? `${e.status} ${e.code}: ${e.message}` : e?.message ?? 'unknown';
          if (errMsg.includes('Waiting for')) {
            await queue.markBlocked(item.id, errMsg);
            result.skipped++;
          } else {
            await queue.markFailed(item.id, errMsg);
            if (item.entity === 'patients') await patientsRepository.applySyncError(item.local_id, errMsg);
            result.failed++;
          }
        }
      }
    } finally { this.running = false; }
    return result;
  },

  /**
   * Pull a single entity on demand. Used by hooks that want fresh data
   * for one table (branches dropdown, medicines list, ...) without
   * triggering a full multi-entity sync.
   */
  pullEntity(entity: PullableEntity): Promise<number> {
    return pullOne(entity);
  },

  /**
   * Pull every entity the current user is allowed to read. Each entity
   * runs in parallel; a 403 on one entity does not abort the others.
   */
  async pull(): Promise<number> {
    const token = useAuthStore.getState().accessToken;
    const tenantId = useAuthStore.getState().tenantId;
    if (!token || !tenantId) return 0;

    const entities: PullableEntity[] = [
      'patients',
      'appointments',
      'doctors',
      'branches',
      'organization',
      'medicines',
      'lab_tests',
      'encounters',
    ];

    const counts = await Promise.all(entities.map((e) => pullOne(e)));
    return counts.reduce((a, b) => a + b, 0);
  },

  async sync(): Promise<PushResult> {
    const push = await this.run();
    const pulled = await this.pull();
    return { ...push, pulled };
  },

  async forceFullResync(): Promise<PushResult> {
    const tenantId = useAuthStore.getState().tenantId;
    if (tenantId) {
      const cursorEntities: PullableEntity[] = [
        'patients', 'appointments', 'encounters', 'medicines', 'lab_tests',
      ];
      await Promise.all(
        cursorEntities.map((k) => meta.set(`last_pull_at:${tenantId}:${k}`, '')),
      );
    }
    // Legacy global cursors from earlier builds.
    await meta.set('last_pull_at', '');
    await meta.set('last_pull_appt_at', '');
    await meta.set('last_pull_doc_at', '');
    await meta.set('last_pull_med_at', '');
    await meta.set('last_pull_labtest_at', '');
    await meta.set('last_pull_org_at', '');
    await meta.set('last_pull_branch_at', '');
    await meta.set('last_pull_enc_at', '');
    return this.sync();
  },
};
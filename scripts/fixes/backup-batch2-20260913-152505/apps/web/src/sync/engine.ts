import { api, ApiError } from '@/lib/api';
import { syncQueue, type QueueItem } from './queue';
import { db } from '@/db';
import { getDeviceId, meta } from '@/db';
import { patientsRepository } from '@/repositories/patients.repository';
import { appointmentsRepository } from '@/repositories/appointments.repository';
import { doctorsRepository } from '@/repositories/doctors.repository';
import { encountersRepository } from '@/repositories/encounters.repository';
import { useAuthStore } from '@/stores/auth.store';

type Handler = (row: QueueItem, payload: any) => Promise<void>;

async function handlePatient(row: QueueItem, payload: any): Promise<void> {
  if (row.operation === 'create') {
    const res = await api.post<{ id: string; uhid: string; updated_at?: string }>(
      '/patients',
      { ...payload, skipDuplicateCheck: true },
      { idempotencyKey: row.idempotency_key, deviceId: row.device_id },
    );
    await patientsRepository.applyCreateSuccess(row.local_id, res);
    return;
  }

  if (row.operation === 'update') {
    if (!payload?.serverId) return;
    try {
      await api.patch(
        `/patients/${payload.serverId}`,
        payload.patch,
        {
          expectedUpdatedAt: payload.expectedUpdatedAt ?? undefined,
          idempotencyKey: row.idempotency_key,
          deviceId: row.device_id,
        },
      );
      await patientsRepository.markSynced(row.local_id);
    } catch (e) {
      if (e instanceof ApiError && e.status === 409 && (e.details as any)?.conflict) {
        await syncQueue.markConflict(row.id, `CONFLICT: ${e.message}`);
        await patientsRepository.applySyncError(row.local_id, `CONFLICT: ${e.message}`);
        return;
      }
      throw e;
    }
    return;
  }

  if (row.operation === 'delete') {
    if (payload?.serverId) {
      await api.delete(`/patients/${payload.serverId}`, {
        idempotencyKey: row.idempotency_key,
        deviceId: row.device_id,
      });
    }
  }
}

async function handleAppointment(row: QueueItem, payload: any): Promise<void> {
  if (row.operation === 'create') {
    if (!payload.patientId) throw new Error('Waiting for patient to sync first');

    const res = await api.post<{ id: string; queue_token: number | null; updated_at?: string }>(
      '/appointments',
      {
        patientId: payload.patientId,
        doctorId: payload.doctorId,
        appointmentDate: payload.appointmentDate,
        slotTime: payload.slotTime ?? undefined,
        chiefComplaint: payload.chiefComplaint ?? null,
        notes: payload.notes ?? null,
      },
      { idempotencyKey: row.idempotency_key, deviceId: row.device_id },
    );
    await appointmentsRepository.applyCreateSuccess(row.local_id, res);
    return;
  }

  if (row.operation === 'update') {
    if (!payload?.serverId) throw new Error('Appointment not yet synced');

    if (payload.patch?.status === 'CHECKED_IN') {
      try {
        const res = await api.post<{ queue_token: number | null }>(
          `/appointments/${payload.serverId}/check-in`,
          undefined,
          { idempotencyKey: row.idempotency_key, deviceId: row.device_id },
        );
        await appointmentsRepository.applyCreateSuccess(row.local_id, {
          id: payload.serverId,
          queue_token: res.queue_token,
        });
        await appointmentsRepository.markSynced(row.local_id);
      } catch (e) {
        if (e instanceof ApiError && e.status === 409) {
          await appointmentsRepository.markSynced(row.local_id);
          return;
        }
        throw e;
      }
      return;
    }

    if (payload.patch?.status) {
      try {
        await api.patch(
          `/appointments/${payload.serverId}/status`,
          { status: payload.patch.status },
          {
            expectedUpdatedAt: payload.expectedUpdatedAt,
            idempotencyKey: row.idempotency_key,
            deviceId: row.device_id,
          },
        );
      } catch (e) {
        if (e instanceof ApiError && e.status === 409) {
          await appointmentsRepository.markSynced(row.local_id);
          return;
        }
        throw e;
      }
    }
    await appointmentsRepository.markSynced(row.local_id);
    return;
  }

  if (row.operation === 'delete') {
    if (payload?.serverId) {
      await api.delete(`/appointments/${payload.serverId}`, {
        idempotencyKey: row.idempotency_key,
        deviceId: row.device_id,
      });
    }
  }
}

async function handleEncounter(row: QueueItem, payload: any): Promise<void> {
  const enc = await db.encounters.get(row.local_id);
  if (!enc) throw new Error('Encounter missing locally');

  let serverId = enc.server_id;

  // 1. Create the encounter if it doesn't exist yet
  if (!serverId) {
    if (enc.appointment_local_id) {
      // Start from an appointment
      const apt = await db.appointments.get(enc.appointment_local_id);
      if (!apt?.server_id) throw new Error('Waiting for appointment to sync first');
      const res = await api.post<{ id: string }>(
        `/appointments/${apt.server_id}/start`,
        undefined,
        { idempotencyKey: row.idempotency_key, deviceId: row.device_id },
      );
      serverId = res.id;
    } else {
      // Walk-in
      if (!enc.patient_server_id) throw new Error('Waiting for patient to sync first');
      const res = await api.post<{ id: string }>(
        '/opd/encounters',
        {
          patientId: enc.patient_server_id,
          doctorId: enc.doctor_id,
          chiefComplaint: enc.chief_complaint ?? null,
        },
        { idempotencyKey: row.idempotency_key, deviceId: row.device_id },
      );
      serverId = res.id;
    }
    await encountersRepository.setServerId(row.local_id, serverId);
  }

  // 2. Save the full bundle (vitals + diagnoses + prescriptions + notes)
  try {
    await api.patch(
      `/opd/encounters/${serverId}`,
      {
        chiefComplaint: enc.chief_complaint,
        history: enc.history,
        examination: enc.examination,
        notes: enc.notes,
        vitals: enc.vitals ?? undefined,
        diagnoses: (enc.diagnoses ?? []).map((d: any) => ({
          diagnosisText: d.diagnosisText,
          icdCode: d.icdCode,
          notes: d.notes,
          isPrimary: d.isPrimary,
        })),
        prescription: enc.prescription ?? undefined,
        labTests: (enc.labTests ?? []).map((t) => ({           testId:        t.testId,           testCode:      t.testCode ?? null,           testName:      t.testName,           sampleType:    t.sampleType ?? null,           price:         Number(t.price ?? 0),           referenceText: t.referenceText ?? null,         })),
        complete: enc.status === 'COMPLETED',
      },
      {
        expectedUpdatedAt: enc.server_updated_at ?? undefined,
        idempotencyKey: row.idempotency_key,
        deviceId: row.device_id,
      },
    );
  } catch (e: any) {
    // Backend says "already completed" - that's actually success
    if (e instanceof ApiError && e.status === 409 && /already completed/i.test(e.message)) {
      console.log('[sync] encounter already completed - treating as success');
    } else if (e instanceof ApiError && e.status === 409 && (e.details as any)?.conflict) {
      await syncQueue.markConflict(row.id, `CONFLICT: ${e.message}`);
      await encountersRepository.applySyncError(row.local_id, `CONFLICT: ${e.message}`);
      return;
    } else {
      throw e;
    }
  }

  await encountersRepository.markSynced(row.local_id);

  // 3. If completed + linked to appointment, ensure local appointment also synced
  if (enc.status === 'COMPLETED' && enc.appointment_local_id) {
    await db.appointments.update(enc.appointment_local_id, {
      status: 'COMPLETED',
      sync_status: 'synced',
      updated_at: new Date().toISOString(),
    }).catch(() => {});
  }
}

const HANDLERS: Record<string, Handler> = {
  patients: handlePatient,
  appointments: handleAppointment,
  encounters: handleEncounter,
};

export interface SyncResult {
  pushed: number;
  failed: number;
  pulled: number;
  skipped: number;
}

export const syncEngine = {
  running: false,

  async run(): Promise<SyncResult> {
    if (this.running) return { pushed: 0, failed: 0, pulled: 0, skipped: 0 };

    const token = useAuthStore.getState().accessToken;
    if (!token) return { pushed: 0, failed: 0, pulled: 0, skipped: 0 };

    // If offline, don't even attempt - the queue keeps items pending
    if (navigator.onLine === false) {
      return { pushed: 0, failed: 0, pulled: 0, skipped: 0 };
    }

    this.running = true;
    const result: SyncResult = { pushed: 0, failed: 0, pulled: 0, skipped: 0 };

    try {
      const batch = await syncQueue.pending(20);
      for (const row of batch) {
        const handler = HANDLERS[row.entity];
        if (!handler) {
          await syncQueue.markFailed(row.id, `No handler for entity ${row.entity}`);
          result.skipped++;
          continue;
        }

        await syncQueue.markInflight(row.id);
        try {
          const payload = typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload;
          await handler(row, payload);
          await syncQueue.markDone(row.id);
          result.pushed++;
        } catch (e: any) {
          const msg = e instanceof ApiError
            ? `${e.status} ${e.code}: ${e.message}`
            : (e?.message ?? 'unknown');
          await syncQueue.markFailed(row.id, msg);
          if (row.entity === 'patients') {
            await patientsRepository.applySyncError(row.local_id, msg);
          }
          result.failed++;
        }
      }
    } finally {
      this.running = false;
    }

    return result;
  },

  async pull(): Promise<number> {
    const token = useAuthStore.getState().accessToken;
    if (!token) {
      console.log('[sync] pull skipped  no token');
      return 0;
    }
    let count = 0;

    try {
      const since = await meta.get('last_pull_at');
      console.log('[sync] pulling patients since:', since ?? '(full)');
      const res = await api.get<{ rows: any[]; serverTime: string }>(
        `/sync/pull?entity=patients${since ? `&since=${encodeURIComponent(since)}` : ''}`
      );
      console.log('[sync] patients response rows:', res.rows.length);
      for (const row of res.rows) {
        try {
          await patientsRepository.upsertFromServer(row);
          count++;
        } catch (e: any) {
          console.log('[sync] patient upsert failed:', row?.id, e?.message);
        }
      }
      await meta.set('last_pull_at', res.serverTime);
      console.log('[sync] patients pull OK  new/updated:', count);
    } catch (e: any) {
      console.log('[sync] PATIENTS PULL FAILED:', e?.message ?? e);
    }

    // Pull appointments
    try {
      const sinceAppt = await meta.get('last_pull_appt_at');
      const resAppt = await api.get<{ rows: any[]; serverTime: string }>(
        `/sync/pull?entity=appointments${sinceAppt ? `&since=${encodeURIComponent(sinceAppt)}` : ''}`
      );
      for (const row of resAppt.rows) {
        try { await appointmentsRepository.upsertFromServer(row); count++; } catch { /* skip */ }
      }
      await meta.set('last_pull_appt_at', resAppt.serverTime);
    } catch { /* skip */ }

    // Pull doctors (full set each time)
    try {
      const resDocs = await api.get<{ rows: any[] }>(
        `/sync/pull?entity=doctors`
      );
      for (const row of resDocs.rows) {
        try { await doctorsRepository.upsertFromServer(row); } catch { /* skip */ }
      }
    } catch { /* skip */ }

    return count;
  },

  async sync(): Promise<SyncResult> {
    const pushResult = await this.run();
    const pulled = await this.pull();
    return { ...pushResult, pulled };
  },

  async forceFullResync(): Promise<SyncResult> {
    await meta.set('last_pull_at', '');
    return this.sync();
  },
};

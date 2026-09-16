import { db, uuid, type LocalAppointment } from '@/db';
import { api } from '@/lib/api';
import { syncQueue } from '@/sync/queue';
import { useAuthStore } from '@/stores/auth.store';

export interface Appointment {
  id: string;
  local_id: string;
  server_id: string | null;
  tenant_id: string;
  branch_id: string;
  patient_id: string;              // = patient_local_id
  patient_server_id: string | null;
  patient_name?: string;
  patient_uhid?: string;
  doctor_id: string | null;
  appointment_date: string;
  slot_time: string | null;
  queue_token: number | null;
  status: 'SCHEDULED' | 'CHECKED_IN' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';
  chief_complaint: string | null;
  notes: string | null;
  sync_status: 'pending' | 'synced' | 'failed' | 'conflict' | 'blocked';
  created_at: string;
  updated_at: string;
  doctor_invoice?: { id: string; invoice_no: string; total_amount: number; status: string } | null;
}

export interface ListAppointmentsResponse {
  rows: Appointment[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CreateAppointmentInput {
  patientId: string;                // local_id
  doctorId: string;
  branchId?: string;
  appointmentDate: string;          // YYYY-MM-DD
  slotTime?: string;                // HH:MM
  chiefComplaint?: string | null;
  notes?: string | null;
}

async function hydrate(apt: LocalAppointment): Promise<Appointment> {
  const patient = await db.patients.get(apt.patient_local_id);
  return {
    id: apt.local_id,
    local_id: apt.local_id,
    server_id: apt.server_id,
    tenant_id: apt.tenant_id ?? '',
    branch_id: apt.branch_id ?? '',
    patient_id: apt.patient_local_id,
    patient_server_id: apt.patient_server_id,
    patient_name: patient?.full_name,
    patient_uhid: patient?.uhid ?? undefined,
    doctor_id: apt.doctor_id,
    appointment_date: apt.appointment_date,
    slot_time: apt.slot_time,
    queue_token: apt.queue_token,
    status: apt.status,
    chief_complaint: apt.chief_complaint,
    notes: apt.notes,
    sync_status: apt.sync_status,
    created_at: apt.created_at,
    updated_at: apt.updated_at,
  };
}

export interface DoctorInvoiceLite {
  id: string;
  invoice_no: string;
  total_amount: number;
  status: string;
}

/**
 * Bulk-fetch DOCTOR invoices for a list of appointment server-ids.
 * Backend endpoint: GET /api/v1/appointments/invoices?ids=uuid1,uuid2,...
 * Returns: { [appointmentServerId]: DoctorInvoiceLite | null }
 *
 * On failure (offline, 5xx) resolves to an empty map so the page still
 * renders from Dexie data.
 */
export async function fetchDoctorInvoicesForAppointments(
  serverIds: string[],
): Promise<Record<string, DoctorInvoiceLite | null>> {
  const ids = Array.from(new Set(serverIds.filter(Boolean)));
  if (ids.length === 0) return {};
  try {
    const res = await api.get<Record<string, DoctorInvoiceLite | null>>(
      `/appointments/invoices?ids=${encodeURIComponent(ids.join(','))}`,
    );
    return res ?? {};
  } catch {
    return {};
  }
}

export const appointmentsRepository = {
  async list(params: {
    date?: string;
    status?: string;
    patientId?: string;
    page?: number;
    pageSize?: number;
  } = {}): Promise<ListAppointmentsResponse> {
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 200;

    const tenantId = useAuthStore.getState().tenantId;
    if (!tenantId) return { rows: [], total: 0, page: params.page ?? 1, pageSize: params.pageSize ?? 200 };
    let rows = await db.appointments.where('deleted').equals(0).toArray()
      .then((r) => r.filter((a) => a.tenant_id === tenantId));

    if (params.date)     rows = rows.filter((a) => a.appointment_date === params.date);
    if (params.status)   rows = rows.filter((a) => a.status === params.status);
    if (params.patientId) rows = rows.filter((a) => a.patient_local_id === params.patientId);

    rows.sort((a, b) => {
      const da = `${a.appointment_date}T${a.slot_time ?? '00:00'}`;
      const dbb = `${b.appointment_date}T${b.slot_time ?? '00:00'}`;
      return dbb.localeCompare(da);
    });

    const total = rows.length;
    const start = (page - 1) * pageSize;
    const pageRows = rows.slice(start, start + pageSize);

    const hydrated = await Promise.all(pageRows.map(hydrate));
    return { rows: hydrated, total, page, pageSize };
  },

  async listToday(): Promise<Appointment[]> {
    const today = new Date().toISOString().slice(0, 10);
    const res = await this.list({ date: today, pageSize: 500 });
    return res.rows;
  },

  async getById(id: string): Promise<Appointment> {
    const a = await db.appointments.get(id);
    if (!a) throw new Error('Appointment not found');
    return hydrate(a);
  },

  async create(input: CreateAppointmentInput): Promise<Appointment> {
    const now = new Date().toISOString();
    const localId = uuid();
    const tenantId = useAuthStore.getState().tenantId;
    const branchId = input.branchId ?? useAuthStore.getState().primaryBranchId;

    const patient = await db.patients.get(input.patientId);
    if (!patient) throw new Error('Patient not found');

    const apt: LocalAppointment = {
      local_id: localId,
      server_id: null,
      tenant_id: tenantId,
      branch_id: branchId ?? null,
      patient_local_id: input.patientId,
      patient_server_id: patient.server_id,
      doctor_id: input.doctorId,
      appointment_date: input.appointmentDate,
      slot_time: input.slotTime ?? null,
      queue_token: null,
      status: 'SCHEDULED',
      chief_complaint: input.chiefComplaint ?? null,
      notes: input.notes ?? null,
      sync_status: 'pending',
      sync_error: null,
      server_updated_at: null,
      created_at: now,
      updated_at: now,
      deleted: 0,
    };

    await db.appointments.add(apt);

    await syncQueue.enqueue({
      entity: 'appointments',
      operation: 'create',
      localId,
      payload: {
        patientLocalId: input.patientId,
        patientId: patient.server_id,
        doctorId: input.doctorId,
        appointmentDate: input.appointmentDate,
        slotTime: input.slotTime ?? null,
        chiefComplaint: input.chiefComplaint ?? null,
        notes: input.notes ?? null,
      },
    });

    return hydrate(apt);
  },

  async updateStatus(id: string, status: LocalAppointment['status']): Promise<Appointment> {
    const existing = await db.appointments.get(id);
    if (!existing) throw new Error('Appointment not found');

    await db.appointments.update(id, {
      status,
      sync_status: 'pending',
      updated_at: new Date().toISOString(),
    });

    await syncQueue.enqueue({
      entity: 'appointments',
      operation: 'update',
      localId: id,
      payload: {
        serverId: existing.server_id,
        patch: { status },
        expectedUpdatedAt: existing.server_updated_at,
      },
    });

    const fresh = await db.appointments.get(id);
    return hydrate(fresh!);
  },

  async checkIn(id: string): Promise<Appointment> {
    return this.updateStatus(id, 'CHECKED_IN');
  },

  async remove(id: string): Promise<void> {
    const existing = await db.appointments.get(id);
    if (!existing) return;
    await db.appointments.update(id, { deleted: 1, sync_status: 'pending' });
    await syncQueue.enqueue({
      entity: 'appointments',
      operation: 'delete',
      localId: id,
      payload: { serverId: existing.server_id },
    });
  },

  async applyCreateSuccess(localId: string, server: { id: string; queue_token?: number | null; updated_at?: string }) {
    const now = new Date().toISOString();
    await db.appointments.update(localId, {
      server_id: server.id,
      queue_token: server.queue_token ?? null,
      server_updated_at: server.updated_at ?? now,
      sync_status: 'synced',
      updated_at: now,
    });
  },

  async applySyncError(localId: string, error: string) {
    const isConflict = error.startsWith('CONFLICT:');
    await db.appointments.update(localId, {
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
    await db.appointments.update(localId, patch);
  },

  async upsertFromServer(server: any): Promise<void> {
    // Find local patient to link
    const patient = await db.patients.where('server_id').equals(server.patient_id).first();
    if (!patient) return; // patient not yet pulled

    const existing = await db.appointments.where('server_id').equals(server.id).first();

    if (existing) {
      if (existing.sync_status === 'pending') return;
      await db.appointments.update(existing.local_id, {
        appointment_date: server.appointment_date,
        slot_time: server.slot_time,
        queue_token: server.queue_token,
        status: server.status,
        chief_complaint: server.chief_complaint,
        notes: server.notes,
        sync_status: 'synced',
        sync_error: null,
        server_updated_at: server.updated_at,
        updated_at: server.updated_at,
      });
      return;
    }

    await db.appointments.add({
      local_id: uuid(),
      server_id: server.id,
      tenant_id: server.tenant_id ?? null,
      branch_id: server.branch_id ?? null,
      patient_local_id: patient.local_id,
      patient_server_id: server.patient_id,
      doctor_id: server.doctor_id,
      appointment_date: server.appointment_date,
      slot_time: server.slot_time,
      queue_token: server.queue_token,
      status: server.status,
      chief_complaint: server.chief_complaint,
      notes: server.notes,
      sync_status: 'synced',
      sync_error: null,
      server_updated_at: server.updated_at,
      created_at: server.created_at,
      updated_at: server.updated_at,
      deleted: 0,
    });
  },

  async countAll(): Promise<number> {
    const tenantId = useAuthStore.getState().tenantId;
    if (!tenantId) return 0;
    const rows = await db.appointments.where('deleted').equals(0).toArray();
    return rows.filter((a) => a.tenant_id === tenantId).length;
  },

  async countToday(): Promise<number> {
    const today = new Date().toISOString().slice(0, 10);
    const all = await db.appointments.where('deleted').equals(0).toArray();
    return all.filter((a) => a.appointment_date === today).length;
  },
};

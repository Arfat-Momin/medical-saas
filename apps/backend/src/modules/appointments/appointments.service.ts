import { supabaseForUser } from '../../config/supabase.js';
import { appointmentsRepository } from './appointments.repository.js';
import { BadRequest, Conflict, NotFound } from '../../utils/errors.js';
import { audit } from '../../middleware/audit.js';
import type { AuthContext } from '@medical/shared';
import type { CreateAppointmentInput, ListAppointmentsQuery } from './appointments.validators.js';

export const appointmentsService = {
  async list(auth: AuthContext, token: string, query: ListAppointmentsQuery) {
    if (!auth.tenantId) throw NotFound('No tenant context');
    const client = supabaseForUser(token);
    return appointmentsRepository.list(client, auth.tenantId, query);
  },

  async today(auth: AuthContext, token: string, date: string) {
    if (!auth.tenantId) throw NotFound('No tenant context');
    const client = supabaseForUser(token);
    // For doctors: default to their own queue
    const doctorId = auth.roles.includes('DOCTOR') ? auth.userId : undefined;
    return appointmentsRepository.list(client, auth.tenantId, {
      date, doctorId, page: 1, pageSize: 200,
    });
  },

  async getById(auth: AuthContext, token: string, id: string) {
    if (!auth.tenantId) throw NotFound('No tenant context');
    const client = supabaseForUser(token);
    const appt = await appointmentsRepository.findById(client, auth.tenantId, id);
    if (!appt) throw NotFound('Appointment not found');
    return appt;
  },

  async create(auth: AuthContext, token: string, input: CreateAppointmentInput) {
    if (!auth.tenantId) throw NotFound('No tenant context');
    const client = supabaseForUser(token);

    let branchId = input.branchId;
    if (!branchId) {
      const def = await appointmentsRepository.findDefaultBranch(client, auth.tenantId);
      if (!def) throw BadRequest('No active branch found');
      branchId = def.id;
    }

    const appt = await appointmentsRepository.create(client, {
      tenant_id: auth.tenantId,
      branch_id: branchId,
      patient_id: input.patientId,
      doctor_id: input.doctorId,
      appointment_date: input.appointmentDate,
      slot_time: input.slotTime ?? null,
      chief_complaint: input.chiefComplaint ?? null,
      notes: input.notes ?? null,
      created_by: auth.userId,
      status: 'SCHEDULED',
    });

    await audit({
      actorUserId: auth.userId,
      action: 'APPOINTMENT_CREATED',
      entity: 'appointments',
      entityId: appt.id,
      after: appt,
    });

    return appt;
  },

  async checkIn(auth: AuthContext, token: string, id: string) {
    if (!auth.tenantId) throw NotFound('No tenant context');
    const client = supabaseForUser(token);

    const appt = await appointmentsRepository.findById(client, auth.tenantId, id);
    if (!appt) throw NotFound('Appointment not found');
    if (appt.status !== 'SCHEDULED') throw Conflict(`Cannot check in - status is ${appt.status}`);
    if (appt.queue_token) throw Conflict('Already checked in');

    const token_num = await appointmentsRepository.nextQueueToken(
      client, auth.tenantId, appt.branch_id, appt.doctor_id, appt.appointment_date,
    );

    const updated = await appointmentsRepository.update(client, auth.tenantId, id, {
      status: 'CHECKED_IN',
      queue_token: token_num,
    });

    await audit({
      actorUserId: auth.userId,
      action: 'APPOINTMENT_CHECKED_IN',
      entity: 'appointments',
      entityId: id,
      before: appt,
      after: updated,
    });

    return updated;
  },

  async startEncounter(auth: AuthContext, token: string, id: string) {
    if (!auth.tenantId) throw NotFound('No tenant context');
    const client = supabaseForUser(token);

    const appt = await appointmentsRepository.findById(client, auth.tenantId, id);
    if (!appt) throw NotFound('Appointment not found');
    if (appt.status === 'CANCELLED') throw Conflict('Appointment is cancelled');
    if (appt.status === 'COMPLETED') throw Conflict('Appointment already completed');

    // Find or create encounter
    const { data: existing } = await client
      .from('encounters').select('*').eq('tenant_id', auth.tenantId).eq('appointment_id', id).maybeSingle();

    let encounter = existing;
    if (!encounter) {
      const { data, error } = await client.from('encounters').insert({
        tenant_id: auth.tenantId,
        branch_id: appt.branch_id,
        patient_id: appt.patient_id,
        doctor_id: appt.doctor_id,
        appointment_id: id,
        encounter_type: 'OPD',
        encounter_date: appt.appointment_date,
        chief_complaint: appt.chief_complaint,
        status: 'DRAFT',
        created_by: auth.userId,
      }).select('*').single();
      if (error) throw error;
      encounter = data;
    }

    // Mark appointment IN_PROGRESS
    if (appt.status !== 'IN_PROGRESS') {
      await appointmentsRepository.update(client, auth.tenantId, id, { status: 'IN_PROGRESS' });
    }

    return encounter;
  },

  async updateStatus(auth: AuthContext, token: string, id: string, status: string) {
    if (!auth.tenantId) throw NotFound('No tenant context');
    const client = supabaseForUser(token);

    const before = await appointmentsRepository.findById(client, auth.tenantId, id);
    if (!before) throw NotFound('Appointment not found');

    const after = await appointmentsRepository.update(client, auth.tenantId, id, { status });

    await audit({
      actorUserId: auth.userId,
      action: 'APPOINTMENT_STATUS_CHANGED',
      entity: 'appointments',
      entityId: id,
      before: { status: before.status },
      after: { status: after.status },
    });

    return after;
  },
};
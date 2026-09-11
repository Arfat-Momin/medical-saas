import { z } from 'zod';

export const createAppointmentSchema = z.object({
  patientId:       z.string().uuid(),
  doctorId:        z.string().uuid(),
  branchId:        z.string().uuid().optional(),
  appointmentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  slotTime:        z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).optional(),
  chiefComplaint:  z.string().max(500).nullable().optional(),
  notes:           z.string().max(1000).nullable().optional(),
});

export const updateAppointmentStatusSchema = z.object({
  status: z.enum(['SCHEDULED','CHECKED_IN','IN_PROGRESS','COMPLETED','CANCELLED','NO_SHOW']),
});

export const listAppointmentsQuerySchema = z.object({
  date:      z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  doctorId:  z.string().uuid().optional(),
  patientId: z.string().uuid().optional(),
  status:    z.enum(['SCHEDULED','CHECKED_IN','IN_PROGRESS','COMPLETED','CANCELLED','NO_SHOW']).optional(),
  page:      z.coerce.number().int().min(1).default(1),
  pageSize:  z.coerce.number().int().min(1).max(100).default(50),
});

export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>;
export type UpdateAppointmentStatusInput = z.infer<typeof updateAppointmentStatusSchema>;
export type ListAppointmentsQuery = z.infer<typeof listAppointmentsQuerySchema>;
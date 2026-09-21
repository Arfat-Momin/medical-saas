import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { requirePermission, requireRole } from '../../middleware/permissions.js';
import { getAccessToken } from '../../middleware/auth.js';
import { PERMISSIONS } from '@medical/shared';
import {
  createAppointmentSchema, updateAppointmentStatusSchema, listAppointmentsQuerySchema,
} from './appointments.validators.js';
import { appointmentsService } from './appointments.service.js';

export const appointmentsRouter = Router();

appointmentsRouter.get(
  '/',
  requirePermission(PERMISSIONS.APPOINTMENT_READ),
  asyncHandler(async (req, res) => {
    const q = listAppointmentsQuerySchema.parse(req.query);
    res.json(await appointmentsService.list(req.auth!, getAccessToken(req), q));
  }),
);

appointmentsRouter.get(
  '/today',
  requirePermission(PERMISSIONS.APPOINTMENT_READ),
  asyncHandler(async (req, res) => {
    const date = (req.query.date as string) ?? new Date().toISOString().slice(0, 10);
    res.json(await appointmentsService.today(req.auth!, getAccessToken(req), date));
  }),
);

appointmentsRouter.get(
  '/invoices',
  requirePermission(PERMISSIONS.APPOINTMENT_READ),
  asyncHandler(async (req, res) => {
    const raw = String(req.query.ids ?? '');
    const ids = raw.split(',').map((s) => s.trim()).filter(Boolean);
    res.json(await appointmentsService.doctorInvoicesByAppointments(req.auth!, getAccessToken(req), ids));
  }),
);

appointmentsRouter.get(
  '/:id',
  requirePermission(PERMISSIONS.APPOINTMENT_READ),
  asyncHandler(async (req, res) => {
    res.json(await appointmentsService.getById(req.auth!, getAccessToken(req), req.params.id!));
  }),
);

appointmentsRouter.post(
  '/',
  requirePermission(PERMISSIONS.APPOINTMENT_MANAGE),
  asyncHandler(async (req, res) => {
    const input = createAppointmentSchema.parse(req.body);
    res.status(201).json(await appointmentsService.create(req.auth!, getAccessToken(req), input));
  }),
);

appointmentsRouter.post(
  '/:id/check-in',
  requirePermission(PERMISSIONS.APPOINTMENT_MANAGE),
  asyncHandler(async (req, res) => {
    res.json(await appointmentsService.checkIn(req.auth!, getAccessToken(req), req.params.id!));
  }),
);

appointmentsRouter.post(
  '/:id/start',
  requirePermission(PERMISSIONS.CONSULTATION_WRITE),
  asyncHandler(async (req, res) => {
    res.json(await appointmentsService.startEncounter(req.auth!, getAccessToken(req), req.params.id!));
  }),
);

appointmentsRouter.patch(
  '/:id/status',
  requirePermission(PERMISSIONS.APPOINTMENT_MANAGE),
  asyncHandler(async (req, res) => {
    const { status } = updateAppointmentStatusSchema.parse(req.body);
    const expected = (req.headers['x-expected-updated-at'] as string | undefined) || undefined;
    res.json(await appointmentsService.updateStatus(req.auth!, getAccessToken(req), req.params.id!, status, expected));
  }),
);

// Hard delete is forbidden for medical data. This soft-deletes the appointment
// and is intentionally restricted to HOSPITAL_ADMIN.
appointmentsRouter.delete(
  '/:id',
  requireRole('HOSPITAL_ADMIN'),
  requirePermission(PERMISSIONS.APPOINTMENT_MANAGE),
  asyncHandler(async (req, res) => {
    res.json(await appointmentsService.softDelete(req.auth!, getAccessToken(req), req.params.id!));
  }),
);
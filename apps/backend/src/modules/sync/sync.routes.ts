import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { getAccessToken } from '../../middleware/auth.js';
import { registerDeviceSchema, pullQuerySchema } from './sync.validators.js';
import { syncService } from './sync.service.js';
import { PERMISSIONS, type Permission } from '@medical/shared';
import { Forbidden } from '../../utils/errors.js';
import { syncPullLimiter, syncDeviceLimiter } from '../../middleware/rateLimit.js';

export const syncRouter = Router();

type Entity = 'patients' | 'appointments' | 'doctors' | 'medicines' | 'lab_tests' | 'organization' | 'branches' | 'encounters';

/**
 * SECURITY: /sync/pull exposes sensitive rows in bulk. Each entity
 * requires the same permission a user would need to read it through
 * the normal module routes.
 */
const ENTITY_PERMISSION: Record<Entity, Permission> = {
  patients:     PERMISSIONS.PATIENT_READ,
  appointments: PERMISSIONS.APPOINTMENT_READ,
  doctors:      PERMISSIONS.APPOINTMENT_READ,
  medicines:    PERMISSIONS.PHARMACY_READ,
  lab_tests:    PERMISSIONS.LAB_READ,
  organization: PERMISSIONS.PATIENT_READ,   // any active member can see their org profile
  branches:     PERMISSIONS.PATIENT_READ,   // dropdown data, needed by all clinical roles
  encounters:   PERMISSIONS.CONSULTATION_READ,
};

syncRouter.post(
  '/devices',
  syncDeviceLimiter,
  asyncHandler(async (req, res) => {
    const input = registerDeviceSchema.parse(req.body);
    res.json(await syncService.registerDevice(req.auth!, getAccessToken(req), input));
  }),
);

syncRouter.get(
  '/pull',
  syncPullLimiter,
  asyncHandler(async (req, res) => {
    const { entity, since, limit, offset } = pullQuerySchema.parse(req.query);

    const required = ENTITY_PERMISSION[entity as Entity];
    if (!required) throw Forbidden(`Unknown sync entity: ${entity}`);

    const perms = req.auth?.permissions ?? [];
    if (!perms.includes(required)) throw Forbidden(`Missing permission: ${required}`);

    res.json(
      await syncService.pull(req.auth!, getAccessToken(req), {
        entity,
        since: since ?? null,
        limit,
        offset,
      }),
    );
  }),
);
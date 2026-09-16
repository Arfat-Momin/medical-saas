import { z } from 'zod';

export const registerDeviceSchema = z.object({
  deviceId:   z.string().min(1).max(200),
  platform:   z.enum(['ios','android','web']),
  appVersion: z.string().max(50).nullable().optional(),
  osVersion:  z.string().max(200).nullable().optional(),
});

export const pullQuerySchema = z.object({
  entity: z.enum([
    'patients',
    'appointments',
    'doctors',
    'medicines',
    'lab_tests',
    'organization',
    'branches',
    'encounters',
  ]),
  // Strictly validate ISO 8601 format. Allows empty string for initial pull.
  since: z.union([
    z.string().datetime({ offset: true }),
    z.literal(''),
  ]).optional(),
  limit:  z.coerce.number().int().min(1).max(1000).optional().default(500),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

export type RegisterDeviceInput = z.infer<typeof registerDeviceSchema>;
export type PullQuery = z.infer<typeof pullQuerySchema>;
import { z } from 'zod';

export const registerDeviceSchema = z.object({
  deviceId:   z.string().min(1).max(200),
  platform:   z.enum(['ios','android','web']),
  appVersion: z.string().max(50).nullable().optional(),
  osVersion:  z.string().max(50).nullable().optional(),
});

export const pullQuerySchema = z.object({
  entity: z.enum(['patients','appointments','doctors']),
  since:  z.string().optional(),
});

export type RegisterDeviceInput = z.infer<typeof registerDeviceSchema>;
export type PullQuery = z.infer<typeof pullQuerySchema>;
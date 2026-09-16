import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

export const registerDeviceSchema = z.object({
  deviceId: z.string().min(1),
  platform: z.enum(['web', 'ios', 'android']),
  pushToken: z.string().optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;

import { z } from 'zod';

export const signupSchema = z
  .object({
    email:             z.string().email(),
    password:          z.string().min(8).max(100).optional(),
    contactName:       z.string().min(1).max(200),
    contactPhone:      z.string().max(20).nullable().optional(),
    hospitalName:      z.string().min(1).max(200),
    hospitalSlug:      z.string().regex(/^[a-z0-9-]{3,50}$/).optional(),
    tenantType:        z.enum(['CLINIC', 'HOSPITAL']),
    planCode:          z.string().min(1).max(50),
    googleAccessToken: z.string().min(1).optional(),
  })
  .refine(
    (data) => Boolean(data.password) !== Boolean(data.googleAccessToken),
    { message: 'Provide either password or googleAccessToken (not both)' },
  );

export const verifySignatureSchema = z.object({
  orderId:   z.string().min(1),
  paymentId: z.string().min(1),
  signature: z.string().min(1),
});

export const renewSchema = z.object({
  planId: z.string().uuid(),
});

export const verifyRenewalSchema = z.object({
  renewalId: z.string().uuid(),
  paymentId: z.string().min(1),
  signature: z.string().min(1),
});

export type SignupInput = z.infer<typeof signupSchema>;
export type VerifySignatureInput = z.infer<typeof verifySignatureSchema>;
export type RenewInput = z.infer<typeof renewSchema>;
export type VerifyRenewalInput = z.infer<typeof verifyRenewalSchema>;

import { z } from 'zod';

export const chatMessageSchema = z.object({
  message: z.string().min(1).max(2000),
  history: z.array(z.object({
    role: z.enum(['user', 'assistant', 'model']),
    content: z.string().max(4000),
  })).optional().default([]),
});

export type ChatMessageInput = z.infer<typeof chatMessageSchema>;

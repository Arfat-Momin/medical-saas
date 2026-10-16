import { api } from '@/lib/api';

export interface AIMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AIResponse {
  reply: string;
  suggestedRoutes: { label: string; route: string }[];
  provider: 'gemini' | 'local_knowledge';
}

export const aiRepository = {
  askAssistant: (input: { message: string; history?: AIMessage[] }) =>
    api.post<AIResponse>('/ai/chat', input),
};

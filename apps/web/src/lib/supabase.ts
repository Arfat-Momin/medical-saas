import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { useAuthStore } from '@/stores/auth.store';

let cached: { token: string; client: SupabaseClient } | null = null;

export function getSupabase(): SupabaseClient {
  const token = useAuthStore.getState().accessToken;
  if (!token) throw new Error('Not authenticated');

  if (cached && cached.token === token) return cached.client;

  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (!url || !key) throw new Error('Supabase environment variables are missing');

  const client = createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  });

  cached = { token, client };
  return client;
}
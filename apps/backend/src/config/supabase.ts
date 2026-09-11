import { createClient } from '@supabase/supabase-js';
import { env } from './env.js';

/** Admin client - bypasses RLS. Use ONLY for auth admin + webhooks + provisioning. */
export const supabaseAdmin = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

/** Client bound to the caller's JWT - respects RLS. Use for all user-scoped queries. */
export function supabaseForUser(accessToken: string) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

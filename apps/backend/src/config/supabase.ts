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

/**
 * Fresh anonymous client. Use this for any auth flow that mutates the
 * client's session (signInWithPassword, refreshSession, ...).
 *
 * NEVER call those methods on the shared `supabaseAdmin` client. Doing so
 * stores the user's JWT on the singleton client, and every subsequent REST
 * call will carry that JWT instead of the service-role key. Any table with
 * row-level security (e.g. `subscriptions`) will then silently return 0
 * rows with no error.
 */
export function freshAnonClient() {
  return createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
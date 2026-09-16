import { supabaseAdmin } from '../config/supabase.js';
import { Forbidden, Internal } from './errors.js';
import { logger } from '../config/logger.js';

interface PlanLimits { max_branches: number; max_users: number; }
const DEFAULT_LIMITS: PlanLimits = { max_branches: 10, max_users: 100 };

export async function assertWithinPlanLimits(tenantId: string, check: 'branches' | 'users') {
  let limits = DEFAULT_LIMITS;
  
  try {
    const { data: sub } = await supabaseAdmin
      .from('subscriptions')
      .select('id, status, plan_id')
      .eq('tenant_id', tenantId)
      .in('status', ['ACTIVE', 'TRIAL', 'GRACE'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (sub && sub.plan_id) {
      const { data: plan } = await supabaseAdmin
        .from('plans')
        .select('max_branches, max_users')
        .eq('id', sub.plan_id)
        .maybeSingle();

      if (plan) {
        limits = {
          max_branches: plan.max_branches ?? DEFAULT_LIMITS.max_branches,
          max_users: plan.max_users ?? DEFAULT_LIMITS.max_users,
        };
      }
    }
  } catch (err) {
    logger.warn({ tenantId, err }, 'Plan check failed, using safe defaults');
  }

  if (check === 'branches') {
    const { count } = await supabaseAdmin
      .from('branches')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('is_active', true);
    if ((count ?? 0) >= limits.max_branches) {
      throw Forbidden(`Plan limit reached (max ${limits.max_branches} branches). Upgrade to add more.`);
    }
  }

  if (check === 'users') {
    const { count } = await supabaseAdmin
      .from('memberships')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('is_active', true);
    if ((count ?? 0) >= limits.max_users) {
      throw Forbidden(`Plan limit reached (max ${limits.max_users} users). Upgrade to add more.`);
    }
  }
}
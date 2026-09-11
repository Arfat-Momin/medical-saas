import { supabaseAdmin } from '../../config/supabase.js';
import { platformAdminRepository as repo } from './platform-admin.repository.js';
import { BadRequest, NotFound } from '../../utils/errors.js';
import { audit } from '../../middleware/audit.js';
import type { AuthContext } from '@medical/shared';
import type {
  ListTenantsQuery, UpdateTenantInput, ExtendSubscriptionInput,
  CreatePlanInput, UpdatePlanInput,
} from './platform-admin.validators.js';

/**
 * The platform-admin module uses the service-role client on purpose:
 * Super Admin needs to read/write the platform tables regardless of RLS.
 * The middleware `requirePlatformAdmin` gates every route — nobody else
 * can call this module.
 *
 * Deliberately: this service NEVER touches hospital tables.
 */
export const platformAdminService = {
  // ---- Tenants ----
  async listTenants(auth: AuthContext, q: ListTenantsQuery) {
    if (!auth.isPlatformAdmin) throw NotFound('Platform admin only');
    return repo.listTenants(supabaseAdmin, q);
  },

  async getTenant(auth: AuthContext, id: string) {
    if (!auth.isPlatformAdmin) throw NotFound('Platform admin only');
    const t = await repo.findTenantFull(supabaseAdmin, id);
    if (!t) throw NotFound('Tenant not found');
    return t;
  },

  async updateTenant(auth: AuthContext, id: string, input: UpdateTenantInput) {
    if (!auth.isPlatformAdmin) throw NotFound('Platform admin only');
    const before = await repo.findTenantById(supabaseAdmin, id);
    if (!before) throw NotFound('Tenant not found');

    const patch: Record<string, unknown> = {};
    if (input.name !== undefined)         patch.name = input.name;
    if (input.contactEmail !== undefined) patch.contact_email = input.contactEmail;
    if (input.contactPhone !== undefined) patch.contact_phone = input.contactPhone;
    if (input.status !== undefined)       patch.status = input.status;

    if (Object.keys(patch).length === 0) return before;

    const after = await repo.updateTenant(supabaseAdmin, id, patch);
    await audit({
      actorUserId: auth.userId,
      action: 'TENANT_UPDATED',
      entity: 'tenants',
      entityId: id,
      before: { name: before.name, status: before.status },
      after:  { name: after.name,  status: after.status },
    });
    return after;
  },

  async extendSubscription(auth: AuthContext, tenantId: string, input: ExtendSubscriptionInput) {
    if (!auth.isPlatformAdmin) throw NotFound('Platform admin only');
    const sub = await repo.findLatestSubscription(supabaseAdmin, tenantId);
    if (!sub) throw NotFound('No subscription found for this tenant');

    const base = new Date(sub.ends_at).getTime() > Date.now() ? new Date(sub.ends_at) : new Date();
    const newEndsAt = new Date(base.getTime() + input.days * 24 * 60 * 60 * 1000).toISOString();

    const after = await repo.extendSubscription(supabaseAdmin, sub.id, newEndsAt);

    await audit({
      actorUserId: auth.userId,
      action: 'SUBSCRIPTION_EXTENDED',
      entity: 'subscriptions',
      entityId: sub.id,
      before: { ends_at: sub.ends_at, status: sub.status },
      after:  { ends_at: after.ends_at, status: after.status, days: input.days, notes: input.notes ?? null },
    });

    return after;
  },

  // ---- Plans ----
  async listPlans(auth: AuthContext) {
    if (!auth.isPlatformAdmin) throw NotFound('Platform admin only');
    return repo.listPlans(supabaseAdmin);
  },

  async createPlan(auth: AuthContext, input: CreatePlanInput) {
    if (!auth.isPlatformAdmin) throw NotFound('Platform admin only');
    const plan = await repo.createPlan(supabaseAdmin, {
      code: input.code,
      name: input.name,
      price_paise: input.pricePaise,
      billing_cycle: input.billingCycle,
      max_branches: input.maxBranches,
      max_users: input.maxUsers,
      features: input.features ?? {},
    });
    await audit({ actorUserId: auth.userId, action: 'PLAN_CREATED', entity: 'plans', entityId: plan.id, after: plan });
    return plan;
  },

  async updatePlan(auth: AuthContext, id: string, patch: UpdatePlanInput) {
    if (!auth.isPlatformAdmin) throw NotFound('Platform admin only');
    const before = await repo.findPlan(supabaseAdmin, id);
    if (!before) throw NotFound('Plan not found');

    const dbPatch: Record<string, unknown> = {};
    if (patch.name !== undefined)         dbPatch.name = patch.name;
    if (patch.pricePaise !== undefined)   dbPatch.price_paise = patch.pricePaise;
    if (patch.billingCycle !== undefined) dbPatch.billing_cycle = patch.billingCycle;
    if (patch.maxBranches !== undefined)  dbPatch.max_branches = patch.maxBranches;
    if (patch.maxUsers !== undefined)     dbPatch.max_users = patch.maxUsers;
    if (patch.features !== undefined)     dbPatch.features = patch.features;
    if (patch.isActive !== undefined)     dbPatch.is_active = patch.isActive;

    const after = await repo.updatePlan(supabaseAdmin, id, dbPatch);
    await audit({ actorUserId: auth.userId, action: 'PLAN_UPDATED', entity: 'plans', entityId: id, before, after });
    return after;
  },

  // ---- Dashboard ----
  async dashboard(auth: AuthContext) {
    if (!auth.isPlatformAdmin) throw NotFound('Platform admin only');
    const stats = await repo.dashboardStats(supabaseAdmin);
    const expiring = await repo.expiringSoon(supabaseAdmin, 30);
    return { stats, expiringSoon: expiring };
  },
};
import { supabaseAdmin } from '../../config/supabase.js';
import { platformAdminRepository as repo } from './platform-admin.repository.js';
import { BadRequest, NotFound } from '../../utils/errors.js';
import { audit } from '../../middleware/audit.js';
import { invalidateTenantStatus } from '../../middleware/tenantContext.js';
import type { AuthContext } from '@medical/shared';
import type {
  ListTenantsQuery, UpdateTenantInput, ExtendSubscriptionInput,
  CreatePlanInput, UpdatePlanInput, CreateCustomTenantInput
} from './platform-admin.validators.js';

export const platformAdminService = {
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
    if (input.status !== undefined) invalidateTenantStatus(id);

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
    invalidateTenantStatus(tenantId);

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

  async dashboard(auth: AuthContext) {
    if (!auth.isPlatformAdmin) throw NotFound('Platform admin only');
    const stats = await repo.dashboardStats(supabaseAdmin);
    const expiring = await repo.expiringSoon(supabaseAdmin, 30);
    return { stats, expiringSoon: expiring };
  },

  async createCustomTenant(auth: AuthContext, input: CreateCustomTenantInput) {
    if (!auth.isPlatformAdmin) throw NotFound('Platform admin only');
    
    // 1. Create auth user
    const { data: authUser, error: authErr } = await supabaseAdmin.auth.admin.createUser({
      email: input.adminEmail,
      password: input.adminPassword,
      email_confirm: true,
      user_metadata: { full_name: input.adminFullName }
    });
    if (authErr) throw BadRequest('Failed to create admin user: ' + authErr.message);
    const userId = authUser.user.id;

    // 2. Wait a tick for the trigger to insert into public.users, then update it
    await new Promise(r => setTimeout(r, 500));
    await supabaseAdmin.from('users').update({
      full_name: input.adminFullName,
    }).eq('id', userId);

    // 3. Create Tenant
    const { data: tenant, error: tErr } = await supabaseAdmin.from('tenants').insert({
      name: input.tenantName,
      slug: input.tenantSlug,
      contact_email: input.tenantEmail || null,
      contact_phone: input.tenantPhone || null,
      status: 'ACTIVE'
    }).select('*').single();
    if (tErr) throw BadRequest('Failed to create tenant: ' + tErr.message);

    // 4. Link user to tenant as ADMIN
    const { error: tuErr } = await supabaseAdmin.from('tenant_users').insert({
      tenant_id: tenant.id,
      user_id: userId,
      role_code: 'ADMIN'
    });
    if (tuErr) throw BadRequest('Failed to link admin to tenant: ' + tuErr.message);

    // 5. Create Custom Plan
    const { data: plan, error: pErr } = await supabaseAdmin.from('plans').insert({
      code: 'CUSTOM_' + tenant.tenant_code,
      name: input.planName,
      price_paise: input.planPricePaise,
      billing_cycle: input.billingCycle,
      max_branches: input.maxBranches,
      max_users: input.maxUsers,
      is_custom: true,
      custom_tenant_id: tenant.id,
      custom_tenure_days: input.customTenureDays || null
    }).select('*').single();
    if (pErr) throw BadRequest('Failed to create custom plan: ' + pErr.message);

    // 6. Create Active Subscription
    let days = 30;
    if (input.billingCycle === 'YEARLY') days = 365;
    if (input.billingCycle === 'CUSTOM' && input.customTenureDays) days = input.customTenureDays;
    
    const endsAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
    const { data: sub, error: subErr } = await supabaseAdmin.from('subscriptions').insert({
      tenant_id: tenant.id,
      plan_id: plan.id,
      status: 'ACTIVE',
      starts_at: new Date().toISOString(),
      ends_at: endsAt
    }).select('*').single();
    if (subErr) throw BadRequest('Failed to create subscription: ' + subErr.message);

    await audit({
      actorUserId: auth.userId,
      action: 'CUSTOM_TENANT_CREATED',
      entity: 'tenants',
      entityId: tenant.id,
      after: { tenant, plan, sub }
    });

    return { tenant, adminUserId: userId, plan, subscription: sub };
  }
};
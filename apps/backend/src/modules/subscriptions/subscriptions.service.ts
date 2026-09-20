import crypto from 'node:crypto';
import { supabaseAdmin } from '../../config/supabase.js';
import { env } from '../../config/env.js';
import { subscriptionsRepository as repo } from './subscriptions.repository.js';
import { requireRazorpay } from './razorpay.client.js';
import { BadRequest, Conflict, NotFound, Unauthorized } from '../../utils/errors.js';
import { logger } from '../../config/logger.js';
import { invalidateTenantStatus } from '../../middleware/tenantContext.js';
import type { AuthContext } from '@medical/shared';
import type {
  SignupInput,
  VerifySignatureInput,
  VerifyRenewalInput,
} from './subscriptions.validators.js';

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50);
}

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 6);
}

async function generateUniqueSlug(base: string): Promise<string> {
  let slug = base;
  let attempts = 0;
  while (attempts < 5) {
    const existing = await repo.findBySlug(supabaseAdmin, slug);
    if (!existing) return slug;
    slug = base + '-' + randomSuffix();
    attempts++;
  }
  throw Conflict('Could not generate a unique hospital slug - try a different name');
}

async function resolveAuthUserId(input: SignupInput): Promise<{ userId: string; created: boolean }> {
  if (input.googleAccessToken) {
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(input.googleAccessToken);
    if (error || !user) throw Unauthorized('Invalid Google session');
    if ((user.email ?? '').toLowerCase() !== input.email.toLowerCase()) {
      throw BadRequest('Google email does not match the signup email');
    }
    return { userId: user.id, created: false };
  }

  const { data: existingProfile } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('email', input.email)
    .maybeSingle();
  if (existingProfile) return { userId: existingProfile.id, created: false };

  const { data: authUser, error: authErr } = await supabaseAdmin.auth.admin.createUser({
    email: input.email,
    password: input.password!,
    email_confirm: true,
    user_metadata: { full_name: input.contactName, phone: input.contactPhone ?? null },
  });
  if (authErr || !authUser.user) {
    throw BadRequest(authErr?.message ?? 'Failed to create user account');
  }
  return { userId: authUser.user.id, created: true };
}

export const subscriptionsService = {
  async listPublicPlans() {
    return repo.listActivePlans(supabaseAdmin);
  },

  async createSignup(input: SignupInput) {
    const plan = await repo.findPlanByCode(supabaseAdmin, input.planCode);
    if (!plan || !plan.is_active) {
      throw NotFound('Plan "' + input.planCode + '" not found or inactive');
    }
    if (plan.is_free) return this.createFreeSignup(input, plan);
    return this.createPaidSignup(input, plan);
  },

  async createPaidSignup(input: SignupInput, plan: any) {
    const rzp = requireRazorpay();

    const baseSlug = input.hospitalSlug ?? slugify(input.hospitalName);
    const slug = await generateUniqueSlug(baseSlug);

    const existing = await repo.findByEmailPending(supabaseAdmin, input.email);
    if (existing) {
      throw Conflict('You already have a pending signup. Complete the payment or wait 24h before retrying.');
    }

    const { userId: authUserId, created } = await resolveAuthUserId(input);

    try {
      const order = await rzp.orders.create({
        amount: plan.price_paise,
        currency: 'INR',
        receipt: 'signup_' + authUserId.slice(0, 8),
        notes: { email: input.email, hospitalName: input.hospitalName, planCode: plan.code },
      }) as any;

      const signup = await repo.createSignup(supabaseAdmin, {
        auth_user_id: authUserId,
        email: input.email,
        contact_name: input.contactName,
        contact_phone: input.contactPhone ?? null,
        hospital_name: input.hospitalName,
        hospital_slug: slug,
        tenant_type: input.tenantType,
        plan_id: plan.id,
        razorpay_order_id: order.id,
        status: 'PENDING',
        subscription_type: 'PAID',
      });

      logger.info({ signupId: signup.id, orderId: order.id, plan: plan.code }, 'Signup created');

      return {
        signupId: signup.id,
        orderId: order.id,
        amount: plan.price_paise,
        currency: 'INR',
        plan: { code: plan.code, name: plan.name },
        razorpayKeyId: env.RAZORPAY_KEY_ID,
        isFree: false,
      };
    } catch (e) {
      if (created) {
        await supabaseAdmin.auth.admin.deleteUser(authUserId).catch(() => {});
      }
      throw e;
    }
  },

  async createFreeSignup(input: SignupInput, plan: any) {
    if (!plan.trial_days || plan.trial_days <= 0) {
      throw BadRequest('Free plan is misconfigured (trial_days missing or invalid)');
    }

    const existingFree = await repo.findAnyProvisionedByEmail(supabaseAdmin, input.email);
    if (existingFree) {
      throw Conflict('A free trial already exists for this email. Please sign in or choose a paid plan.');
    }

    const baseSlug = input.hospitalSlug ?? slugify(input.hospitalName);
    const slug = await generateUniqueSlug(baseSlug);

    const pending = await repo.findByEmailPending(supabaseAdmin, input.email);
    if (pending) {
      throw Conflict('You already have a pending signup. Complete it first.');
    }

    const { userId: authUserId, created } = await resolveAuthUserId(input);

    // Synthetic order id so any RLS/policy that requires a non-null razorpay_order_id
    // still passes for free-tier signups.
    const syntheticOrderId =
      'free_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);

    try {
      const signup = await repo.createSignup(supabaseAdmin, {
        auth_user_id: authUserId,
        email: input.email,
        contact_name: input.contactName,
        contact_phone: input.contactPhone ?? null,
        hospital_name: input.hospitalName,
        hospital_slug: slug,
        tenant_type: input.tenantType,
        plan_id: plan.id,
        razorpay_order_id: syntheticOrderId,
        status: 'PENDING',
        subscription_type: 'FREE',
      });

      const dummyPaymentId = 'free_' + signup.id.replace(/-/g, '').slice(0, 12);

      const result = await repo.provisionSignup(supabaseAdmin, {
        signupId: signup.id,
        paymentId: dummyPaymentId,
        signature: 'free_tier_no_razorpay',
        webhook: { source: 'free_tier', planCode: plan.code, trialDays: plan.trial_days },
      });

      const endsAt = new Date(Date.now() + plan.trial_days * 24 * 60 * 60 * 1000).toISOString();
      await repo.updateSubscriptionToFreeTrial(supabaseAdmin, result.tenantId, endsAt);
      await repo.deleteDummyPayment(supabaseAdmin, result.tenantId, dummyPaymentId);
      invalidateTenantStatus(result.tenantId);

      logger.info(
        { signupId: signup.id, tenantId: result.tenantId, trialDays: plan.trial_days },
        'Free trial provisioned',
      );

      return {
        signupId: signup.id,
        isFree: true,
        alreadyProvisioned: result.alreadyProvisioned,
        tenantId: result.tenantId,
      };
    } catch (e) {
      if (created) {
        await supabaseAdmin.auth.admin.deleteUser(authUserId).catch(() => {});
      }
      throw e;
    }
  },

  async getSignupStatus(signupId: string) {
    const s = await repo.findById(supabaseAdmin, signupId);
    if (!s) throw NotFound('Signup not found');
    return {
      id: s.id,
      status: s.status,
      email: s.email,
      hospitalName: s.hospital_name,
      tenantId: s.provisioned_tenant_id,
      createdAt: s.created_at,
      subscriptionType: s.subscription_type ?? 'PAID',
    };
  },

  async verifySignature(input: VerifySignatureInput) {
    if (!env.RAZORPAY_KEY_SECRET) throw BadRequest('Razorpay not configured');

    const body = input.orderId + '|' + input.paymentId;
    const expected = crypto.createHmac('sha256', env.RAZORPAY_KEY_SECRET).update(body).digest('hex');

    if (expected !== input.signature) {
      throw Unauthorized('Payment signature verification failed');
    }

    const signup = await repo.findByOrderId(supabaseAdmin, input.orderId);
    if (!signup) throw NotFound('Signup not found for this order');

    if (signup.status === 'PROVISIONED') {
      return { alreadyProvisioned: true, tenantId: signup.provisioned_tenant_id };
    }

    let result;
    try {
      result = await repo.provisionSignup(supabaseAdmin, {
        signupId: signup.id,
        paymentId: input.paymentId,
        signature: input.signature,
        webhook: { source: 'frontend', orderId: input.orderId, paymentId: input.paymentId },
      });
    } catch (e: any) {
      const dup = e?.code === '23505' || String(e?.message ?? '').toLowerCase().includes('duplicate key');
      if (dup) {
        const refreshed = await repo.findById(supabaseAdmin, signup.id);
        if (refreshed?.status === 'PROVISIONED' && refreshed.provisioned_tenant_id) {
          logger.info({ signupId: signup.id }, 'verify-signature lost race; using winner result');
          return { alreadyProvisioned: true, tenantId: refreshed.provisioned_tenant_id };
        }
      }
      throw e;
    }

    invalidateTenantStatus(result.tenantId);
    logger.info({ signupId: signup.id, tenantId: result.tenantId }, 'Provisioned via frontend verification');
    return result;
  },

  async getCurrentSubscription(auth: AuthContext) {
    if (!auth.tenantId) throw NotFound('No tenant context');

    let sub: any = await repo.findLatestSubscriptionForTenant(supabaseAdmin, auth.tenantId);

    // Retry the direct query if the repo returned null.
    // Supabase is occasionally returning {data:null,error:null} on the
    // .maybeSingle() path under load - without this, the endpoint
    // silently degrades to the "no subscription" empty state.
    if (!sub) {
      for (let attempt = 1; attempt <= 3 && !sub; attempt += 1) {
        const { data: rows, error: err } = await supabaseAdmin
          .from('subscriptions')
          .select('*')
          .eq('tenant_id', auth.tenantId)
          .order('created_at', { ascending: false })
          .limit(1);

        logger.warn(
          {
            tenantId: auth.tenantId,
            attempt,
            errorCode: (err as any)?.code,
            errorMessage: (err as any)?.message,
            rowCount: Array.isArray(rows) ? rows.length : 'n/a',
          },
          'getCurrentSubscription: direct retry',
        );

        if (!err && Array.isArray(rows) && rows.length > 0) {
          sub = rows[0];
          if (sub.plan_id) {
            const { data: planRow } = await supabaseAdmin
              .from('plans')
              .select('*')
              .eq('id', sub.plan_id)
              .maybeSingle();
            sub.plans = planRow ?? null;
          }
          break;
        }
        await new Promise((r) => setTimeout(r, 300 * attempt));
      }
    }

    if (!sub) {
      logger.warn(
        { tenantId: auth.tenantId },
        'getCurrentSubscription: no subscription row for tenant',
      );
      return {
        subscription: null,
        plan: null,
        daysRemaining: 0,
        isExpired: true,
        payments: [],
      };
    }

    const now = Date.now();
    const endsAtMs = sub.ends_at ? new Date(sub.ends_at).getTime() : NaN;
    const hasValidEnd = Number.isFinite(endsAtMs);
    const daysRemaining = hasValidEnd
      ? Math.max(0, Math.ceil((endsAtMs - now) / 86400000))
      : 0;

    const statusUpper = String(sub.status ?? '').trim().toUpperCase();
    // A subscription is expired ONLY when:
    //   1. its status is explicitly terminal (CANCELLED/SUSPENDED/EXPIRED/FAILED), OR
    //   2. it has a *valid* end date in the past.
    // A null/invalid ends_at on a non-terminal status is treated as
    // "perpetual / still active" so we never show the renewal page by
    // accident for ACTIVE / TRIAL / GRACE / PAID / SUBSCRIBED tenants.
    const TERMINAL_STATUSES = new Set([
      'CANCELLED',
      'CANCELED',
      'SUSPENDED',
      'EXPIRED',
      'FAILED',
      'TERMINATED',
    ]);
    const statusIsTerminal = TERMINAL_STATUSES.has(statusUpper);
    const isExpired = statusIsTerminal || (hasValidEnd && endsAtMs <= now);

    const payments = await repo.listRecentPayments(supabaseAdmin, auth.tenantId, 10);

    logger.info(
      {
        tenantId: auth.tenantId,
        subId: sub.id,
        status: sub.status,
        endsAt: sub.ends_at,
        hasValidEnd,
        isExpired,
        planCode: (sub.plans as any)?.code ?? null,
      },
      'getCurrentSubscription: returning subscription',
    );

    return {
      subscription: {
        id: sub.id,
        status: sub.status,
        startsAt: sub.starts_at,
        endsAt: sub.ends_at,
        isFreeTier: !!(sub.is_free_tier || (sub.plans as any)?.is_free),
        renewalOf: sub.renewal_of_subscription_id ?? null,
      },
      plan: sub.plans,
      daysRemaining,
      isExpired,
      payments,
    };
  },

  async createRenewal(auth: AuthContext, planId: string) {
    if (!auth.tenantId) throw NotFound('No tenant context');

    const plan = await repo.findPlanById(supabaseAdmin, planId);
    if (!plan || !plan.is_active) throw NotFound('Plan not found or inactive');
    if (plan.is_free || !plan.is_renewable) {
      throw BadRequest('Free or non-renewable plans cannot be purchased as a renewal');
    }

    const pending = await repo.findExistingPendingRenewal(supabaseAdmin, auth.tenantId);
    if (pending) {
      const age = Date.now() - new Date(pending.created_at).getTime();
      if (age < 30 * 60 * 1000) {
        throw Conflict('A renewal is already in progress. Please complete the payment or wait 30 minutes.');
      }
    }

    const rzp = requireRazorpay();
    const order = await rzp.orders.create({
      amount: plan.price_paise,
      currency: 'INR',
      receipt: 'renew_' + auth.tenantId.slice(0, 8) + '_' + Date.now(),
      notes: { tenantId: auth.tenantId, planCode: plan.code, kind: 'renewal' },
    }) as any;

    const renewal = await repo.createPendingRenewal(supabaseAdmin, {
      tenant_id: auth.tenantId,
      plan_id: plan.id,
      auth_user_id: auth.userId,
      razorpay_order_id: order.id,
      status: 'PENDING',
      amount_paise: plan.price_paise,
      currency: 'INR',
    });

    logger.info(
      { renewalId: renewal.id, orderId: order.id, tenantId: auth.tenantId, plan: plan.code },
      'Renewal order created',
    );

    return {
      renewalId: renewal.id,
      orderId: order.id,
      amount: plan.price_paise,
      currency: 'INR',
      plan: { code: plan.code, name: plan.name },
      razorpayKeyId: env.RAZORPAY_KEY_ID,
    };
  },

  async verifyRenewal(input: VerifyRenewalInput) {
    if (!env.RAZORPAY_KEY_SECRET) throw BadRequest('Razorpay not configured');

    const renewal = await repo.findPendingRenewalById(supabaseAdmin, input.renewalId);
    if (!renewal) throw NotFound('Renewal not found');

    if (renewal.status === 'ACTIVATED') {
      return { alreadyActivated: true, subscriptionId: renewal.activated_subscription_id };
    }

    const body = renewal.razorpay_order_id + '|' + input.paymentId;
    const expected = crypto.createHmac('sha256', env.RAZORPAY_KEY_SECRET).update(body).digest('hex');
    if (expected !== input.signature) {
      throw Unauthorized('Payment signature verification failed');
    }

    return this.activateRenewal(renewal, input.paymentId);
  },

  async activateRenewal(renewal: any, paymentId: string) {
    const fresh = await repo.findPendingRenewalById(supabaseAdmin, renewal.id);
    if (!fresh) throw NotFound('Renewal disappeared');
    if (fresh.status === 'ACTIVATED') {
      return { alreadyActivated: true, subscriptionId: fresh.activated_subscription_id, tenantId: fresh.tenant_id };
    }

    // Atomic claim: flip PENDING -> ACTIVATING. Only the first caller wins.
    // Losers see 0 rows affected and take the "already activated" path.
    const { data: claimed, error: claimErr } = await supabaseAdmin
      .from('pending_renewals')
      .update({ status: 'ACTIVATING' })
      .eq('id', fresh.id)
      .eq('status', 'PENDING')
      .select('id');

    if (claimErr) throw claimErr;
    if (!Array.isArray(claimed) || claimed.length === 0) {
      const again = await repo.findPendingRenewalById(supabaseAdmin, fresh.id);
      return {
        alreadyActivated: again?.status === 'ACTIVATED',
        subscriptionId: again?.activated_subscription_id ?? null,
        tenantId: again?.tenant_id ?? fresh.tenant_id,
      };
    }

    const plan = await repo.findPlanById(supabaseAdmin, fresh.plan_id);
    if (!plan) throw NotFound('Plan not found');
    if (plan.is_free || !plan.is_renewable) throw BadRequest('Plan cannot be renewed');

    const prev = await repo.findLatestSubscriptionForTenant(supabaseAdmin, fresh.tenant_id);
    const now = Date.now();
    const prevEndsMs = prev?.ends_at ? new Date(prev.ends_at).getTime() : 0;
    const startMs = Math.max(now, prevEndsMs);
    const periodMs = plan.billing_cycle === 'YEARLY' ? 365 * 86400000 : 30 * 86400000;
    const endsAt = new Date(startMs + periodMs).toISOString();
    const startsAt = new Date(startMs).toISOString();

    const newSub = await repo.createSubscription(supabaseAdmin, {
      tenant_id: fresh.tenant_id,
      plan_id: plan.id,
      status: 'ACTIVE',
      starts_at: startsAt,
      ends_at: endsAt,
      is_free_tier: false,
      renewal_of_subscription_id: prev?.id ?? null,
    });

    try {
      await repo.createSubscriptionPayment(supabaseAdmin, {
        tenant_id: fresh.tenant_id,
        amount_paise: fresh.amount_paise,
        currency: fresh.currency || 'INR',
        status: 'CAPTURED',
        razorpay_order_id: fresh.razorpay_order_id,
        razorpay_payment_id: paymentId,
      });
    } catch (e) {
      logger.warn({ err: e, renewalId: fresh.id }, 'Failed to write subscription_payment');
    }

    await repo.updatePendingRenewal(supabaseAdmin, fresh.id, {
      status: 'ACTIVATED',
      razorpay_payment_id: paymentId,
      activated_subscription_id: newSub.id,
      updated_at: new Date().toISOString(),
    });

    await repo.ensureTenantActive(supabaseAdmin, fresh.tenant_id);
    invalidateTenantStatus(fresh.tenant_id);

    logger.info(
      { renewalId: fresh.id, tenantId: fresh.tenant_id, subscriptionId: newSub.id, endsAt },
      'Renewal activated',
    );

    return {
      alreadyActivated: false,
      subscriptionId: newSub.id,
      tenantId: fresh.tenant_id,
      endsAt,
    };
  },

  async handleWebhook(rawBody: string, signature: string) {
    if (!env.RAZORPAY_WEBHOOK_SECRET) {
      logger.error('Webhook received but RAZORPAY_WEBHOOK_SECRET is not set');
      throw BadRequest('Webhook not configured');
    }

    const expected = crypto
      .createHmac('sha256', env.RAZORPAY_WEBHOOK_SECRET)
      .update(rawBody)
      .digest('hex');

    if (expected !== signature) {
      logger.warn({ got: signature.slice(0, 8), expected: expected.slice(0, 8) }, 'Bad webhook signature');
      throw Unauthorized('Invalid webhook signature');
    }

    let payload: any;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      throw BadRequest('Invalid JSON in webhook body');
    }

    const event = payload?.event as string | undefined;
    logger.info({ event }, 'Razorpay webhook received');

    if (event === 'payment.captured' || event === 'order.paid') {
      const paymentEntity = payload?.payload?.payment?.entity ?? {};
      const orderId = paymentEntity?.order_id ?? payload?.payload?.order?.entity?.id;
      const paymentId = paymentEntity?.id;

      if (!orderId || !paymentId) {
        logger.warn({ payload }, 'Webhook missing orderId/paymentId');
        return { ok: true, handled: false, reason: 'missing_ids' };
      }

      const renewal = await repo.findPendingRenewalByOrderId(supabaseAdmin, orderId);
      if (renewal) {
        try {
          const result = await this.activateRenewal(renewal, paymentId);
          return {
            ok: true,
            handled: true,
            kind: 'renewal',
            tenantId: result.tenantId,
            alreadyActivated: result.alreadyActivated,
          };
        } catch (e: any) {
          logger.error({ err: e, orderId, renewalId: renewal.id }, 'Webhook renewal activation failed');
          return { ok: false, handled: false, reason: 'renewal_activation_failed' };
        }
      }

      const signup = await repo.findByOrderId(supabaseAdmin, orderId);
      if (!signup) {
        logger.warn({ orderId }, 'No pending_signup matches order_id - ignoring');
        return { ok: true, handled: false, reason: 'signup_not_found' };
      }

      let result;
      try {
        result = await repo.provisionSignup(supabaseAdmin, {
          signupId: signup.id,
          paymentId,
          signature,
          webhook: payload,
        });
      } catch (e: any) {
        const dup = e?.code === '23505' || String(e?.message ?? '').toLowerCase().includes('duplicate key');
        if (dup) {
          const refreshed = await repo.findById(supabaseAdmin, signup.id);
          if (refreshed?.status === 'PROVISIONED' && refreshed.provisioned_tenant_id) {
            logger.info({ signupId: signup.id }, 'webhook lost race; using winner result');
            return { ok: true, handled: true, tenantId: refreshed.provisioned_tenant_id };
          }
        }
        throw e;
      }

      invalidateTenantStatus(result.tenantId);
    logger.info(
        { signupId: signup.id, tenantId: result.tenantId, already: result.alreadyProvisioned },
        'Webhook provisioned tenant',
      );
      return { ok: true, handled: true, tenantId: result.tenantId };
    }

    if (event === 'payment.failed') {
      const paymentEntity = payload?.payload?.payment?.entity ?? {};
      const orderId = paymentEntity?.order_id;

      if (orderId) {
        const renewal = await repo.findPendingRenewalByOrderId(supabaseAdmin, orderId);
        if (renewal && renewal.status === 'PENDING') {
          await repo.updatePendingRenewal(supabaseAdmin, renewal.id, {
            status: 'FAILED',
            failure_reason: paymentEntity?.error_description ?? 'Payment failed',
            raw_webhook: payload,
            updated_at: new Date().toISOString(),
          });
          logger.info({ renewalId: renewal.id }, 'Marked renewal as FAILED');
        } else {
          const signup = await repo.findByOrderId(supabaseAdmin, orderId);
          if (signup && signup.status === 'PENDING') {
            await repo.updateSignup(supabaseAdmin, signup.id, {
              status: 'FAILED',
              failure_reason: paymentEntity?.error_description ?? 'Payment failed',
              raw_webhook: payload,
            });
            logger.info({ signupId: signup.id }, 'Marked signup as FAILED');
          }
        }
      }
      return { ok: true, handled: true };
    }

    return { ok: true, handled: false, reason: 'unhandled_event:' + event };
  },
};









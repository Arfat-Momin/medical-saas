import { useState } from 'react';
import {
  Calendar,
  AlertTriangle,
  CheckCircle2,
  CreditCard,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { Alert } from '@/components/ui/Alert';
import { Spinner } from '@/components/ui/Spinner';
import { Modal } from '@/components/ui/Modal';
import { PageHeader } from '@/components/ui/PageHeader';
import { usePermissions } from '@/hooks/useAuth';
import {
  useCurrentSubscription,
  usePublicPlans,
  useRenewSubscription,
  useVerifyRenewal,
} from '@/hooks/useSubscriptions';
import { deriveSubscriptionView } from '@/components/subscription/subscriptionView';
import { PERMISSIONS } from '@medical/shared';
import { cn } from '@/lib/cn';

const RZP_SCRIPT = 'https://checkout.razorpay.com/v1/checkout.js';

function loadRazorpay(): Promise<boolean> {
  return new Promise((resolve) => {
    if ((window as any).Razorpay) return resolve(true);
    const existing = document.querySelector(`script[src="${RZP_SCRIPT}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve(true));
      return;
    }
    const s = document.createElement('script');
    s.src = RZP_SCRIPT;
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

const statusTone: Record<string, BadgeTone> = {
  TRIAL: 'blue',
  ACTIVE: 'green',
  GRACE: 'yellow',
  SUSPENDED: 'red',
  CANCELLED: 'gray',
};

function money(paise: number): string {
  return 'Rs.' + (paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export function SubscriptionPage() {
  const { can } = usePermissions();
  const current = useCurrentSubscription();
  const plans = usePublicPlans();
  const renew = useRenewSubscription();
  const verify = useVerifyRenewal();

  const [pickerOpen, setPickerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const canRenew = can(PERMISSIONS.BILLING_MANAGE);

  if (current.isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size={32} />
      </div>
    );
  }

  if (current.isError || !current.data) {
    return (
      <div className="space-y-4">
        <Alert tone="error">Failed to load subscription info.</Alert>
        <Button variant="secondary" onClick={() => current.refetch()}>Retry</Button>
      </div>
    );
  }

  const { subscription, plan, daysRemaining, isExpired, payments } = current.data;
  const view = deriveSubscriptionView(
    subscription,
    plan as any,
    daysRemaining,
    isExpired,
  );
  const isFreeTier = view.isFree;
  const isExpiredReal = view.isExpired;
  const noSubscription = view.noSubscription;

  async function handleRenew(planId: string) {
    setError(null);
    setBusy(true);
    try {
      const order = await renew.mutateAsync(planId);
      const ok = await loadRazorpay();
      if (!ok || !(window as any).Razorpay) {
        setError('Failed to load Razorpay. Check your connection.');
        setBusy(false);
        return;
      }
      const rzp = new (window as any).Razorpay({
        key: order.razorpayKeyId,
        amount: order.amount,
        currency: order.currency,
        name: 'Medical SaaS',
        description: `${order.plan.name} renewal`,
        order_id: order.orderId,
        theme: { color: '#3b5bff' },
        handler: async (response: any) => {
          try {
            await verify.mutateAsync({
              renewalId: order.renewalId,
              paymentId: response.razorpay_payment_id,
              signature: response.razorpay_signature,
            });
            await current.refetch();
            setPickerOpen(false);
            setBusy(false);
          } catch (e: any) {
            setError(e?.message ?? 'Verification failed');
            setBusy(false);
          }
        },
        modal: {
          ondismiss: () => {
            setBusy(false);
          },
        },
      });
      rzp.open();
    } catch (e: any) {
      setError(e?.message ?? 'Failed to start renewal');
      setBusy(false);
    }
  }

  const renewablePlans = (plans.data ?? []).filter((p: any) => !p.is_free && p.is_renewable && p.is_active);

  // ---- No-subscription empty state ---------------------------------------
  // A tenant with no subscription row is a legitimate state (the plan was
  // never provisioned). The backend allows /subscriptions/* on this path,
  // so the user can pick a plan and pay without being locked out.
  if (!subscription) {
    return (
      <div className="space-y-4">
        <Alert tone="warning">
          <div className="flex items-start gap-2">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <div>
              <strong>No active subscription</strong>
              <p className="mt-0.5 text-xs">
                Your organization doesn't have a plan yet. Choose a plan below to activate one.
              </p>
            </div>
          </div>
        </Alert>

        <Card>
          <CardHeader
            title="Choose a plan"
            subtitle="Select a plan to activate your subscription"
          />
          <CardBody className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {renewablePlans.length === 0 && (
              <p className="col-span-full py-6 text-center text-sm text-slate-500">
                No plans are available right now. Please contact support.
              </p>
            )}
            {renewablePlans.map((p: any) => (
              <button
                key={p.id}
                type="button"
                onClick={() => handleRenew(p.id)}
                disabled={busy}
                className="rounded-lg border border-slate-200 p-4 text-left transition hover:border-brand-400 hover:bg-brand-50 disabled:opacity-50"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-900">{p.name}</span>
                  <span className="font-mono text-sm">{money(p.price_paise)}</span>
                </div>
                <p className="mt-1 font-mono text-2xs text-slate-500">{p.code}</p>
              </button>
            ))}
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title="My Plan"
        subtitle="Your subscription, renewal and payment history"
      />

      {/* Free tier banner */}
      {isFreeTier && !isExpiredReal && (
        <div className="mb-4">
          <Alert tone="info">
            <div className="flex items-start gap-2">
              <Sparkles size={16} className="mt-0.5 shrink-0" />
              <div>
                <strong>You are on a free trial.</strong>
                <p className="mt-0.5 text-xs">
                  {daysRemaining} day{daysRemaining === 1 ? '' : 's'} left. Upgrade to keep using the app after the trial.
                </p>
              </div>
            </div>
          </Alert>
        </div>
      )}

      {isExpiredReal && (
        <div className="mb-4">
          <Alert tone="error">
            <div className="flex items-start gap-2">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <div>
                {isFreeTier ? (
                  <>
                    <strong>Your free trial has ended.</strong>
                    <p className="mt-0.5 text-xs">
                      Upgrade to a paid plan to restore full access. You can keep
                      the same organisation and data.
                    </p>
                  </>
                ) : (
                  <>
                    <strong>Your subscription has expired.</strong>
                    <p className="mt-0.5 text-xs">
                      Renew now to restore full access.
                    </p>
                  </>
                )}
              </div>
            </div>
          </Alert>
        </div>
      )}

      {/* Plan overview */}
      <Card className="mb-6">
        <CardBody>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-xs uppercase tracking-wide text-slate-500">Current plan</p>
              <div className="mt-1 flex items-center gap-2">
                <h2 className="text-2xl font-bold text-slate-900">{plan?.name ?? '?'}</h2>
                {isFreeTier && <Badge tone="blue">Free trial</Badge>}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-slate-600">
                <Badge tone={statusTone[subscription.status] ?? 'gray'}>{subscription.status}</Badge>
                <span className="inline-flex items-center gap-1">
                  <Calendar size={14} className="text-slate-400" />
                  Ends {new Date(subscription.endsAt).toLocaleDateString()}
                </span>
                {!isExpired && (
                  <span className={cn(
                    'font-semibold',
                    daysRemaining <= 7 ? 'text-red-600' : daysRemaining <= 30 ? 'text-amber-600' : 'text-green-600'
                  )}>
                    {daysRemaining} day{daysRemaining === 1 ? '' : 's'} remaining
                  </span>
                )}
              </div>
            </div>
            {canRenew && (
              <Button
                onClick={() => setPickerOpen(true)}
                disabled={renewablePlans.length === 0}
                leftIcon={<CreditCard size={14} />}
              >
                {isFreeTier || isExpired ? 'Upgrade' : 'Extend / Upgrade'}
              </Button>
            )}
          </div>
        </CardBody>
      </Card>

      {/* Limits */}
      <Card className="mb-6">
        <CardHeader title="Plan limits" subtitle="What your current plan allows" />
        <CardBody className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Limit label="Branches" value={plan?.max_branches ?? '?'} />
          <Limit label="Users" value={plan?.max_users ?? '?'} />
          <Limit label="Billing cycle" value={plan?.billing_cycle === 'YEARLY' ? 'Yearly' : 'Monthly'} />
        </CardBody>
      </Card>

      {/* Payments */}
      <Card>
        <CardHeader title="Payment history" subtitle={`${payments.length} record(s)`} />
        <CardBody>
          {payments.length === 0 && (
            <p className="text-sm text-slate-500">No payments yet.</p>
          )}
          {payments.length > 0 && (
            <ul className="divide-y divide-slate-100">
              {payments.map((p) => (
                <li key={p.id} className="flex items-center justify-between py-3 text-sm">
                  <div>
                    <span className="font-mono font-medium text-slate-800">
                      {money(p.amount_paise)}
                    </span>
                    <span className="ml-2 text-slate-500">{p.status}</span>
                    {p.razorpay_payment_id && (
                      <span className="ml-2 font-mono text-xs text-slate-400">
                        {p.razorpay_payment_id}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-slate-500">
                    {new Date(p.created_at).toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      {/* Renewal modal */}
      <Modal
        open={pickerOpen}
        onClose={() => { if (!busy) setPickerOpen(false); }}
        title="Extend or upgrade your plan"
        size="lg"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setPickerOpen(false)}
              disabled={busy}
            >
              Cancel
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          {error && <Alert tone="error">{error}</Alert>}
          <p className="text-sm text-slate-600">
            Your current subscription's remaining time will be preserved. The new plan starts the moment your current one ends (or immediately if expired).
          </p>
          {renewablePlans.length === 0 && (
            <p className="text-sm text-slate-500">No renewable plans available.</p>
          )}
          {renewablePlans.map((p: any) => (
            <div
              key={p.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-4"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-900">{p.name}</span>
                  <Badge tone="gray">{p.code}</Badge>
                </div>
                <p className="mt-0.5 text-xs text-slate-500">
                  Up to {p.max_branches} branch(es) ? {p.max_users} users ? {p.billing_cycle === 'YEARLY' ? 'Yearly' : 'Monthly'}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-mono text-base font-semibold text-slate-900">
                  {money(p.price_paise)}
                </span>
                <Button
                  onClick={() => handleRenew(p.id)}
                  disabled={busy}
                  rightIcon={<ArrowRight size={14} />}
                >
                  Choose
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Modal>
    </>
  );
}

function Limit({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/40 px-4 py-3">
      <p className="text-[11px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-slate-900">{value}</p>
    </div>
  );
}






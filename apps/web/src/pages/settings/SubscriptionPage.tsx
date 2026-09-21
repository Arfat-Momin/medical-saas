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
    const existing = document.querySelector('script[src="' + RZP_SCRIPT + '"]');
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

const statusTone: Record<string, any> = {
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
  const [success, setSuccess] = useState<string | null>(null);

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

  const data: any = current.data;
  const subscription = data.subscription;
  const plan = data.plan;
  const daysRemaining = data.daysRemaining;
  const isExpiredFromBackend = data.isExpired;
  const payments = data.payments ?? [];

  const view = deriveSubscriptionView(subscription, plan, daysRemaining, isExpiredFromBackend);

  // Defensive: reject only on EXPLICIT bad flags. Missing fields default to OK.
  const renewablePlans = ((plans.data as any[]) ?? []).filter((p: any) => {
    if (p?.is_active === false) return false;
    if (p?.is_free === true) return false;
    if (p?.is_renewable === false) return false;
    return true;
  });

  async function handleUpgrade(planCode: string) {
    setError(null);
    setBusy(true);
    try {
      const order: any = await renew.mutateAsync(planCode as any);
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
        description: (order.plan?.name ?? 'Plan') + ' subscription',
        order_id: order.orderId,
        theme: { color: '#3b5bff' },
        handler: async (response: any) => {
          try {
            await verify.mutateAsync({
              renewalId: order.renewalId,
              paymentId: response.razorpay_payment_id,
              signature: response.razorpay_signature,
            } as any);
            await current.refetch();
            setPickerOpen(false);
            setBusy(false);
            setSuccess('Renewal successful. Your plan has been extended.');
            setTimeout(() => setSuccess(null), 8000);
          } catch (e: any) {
            setError(e?.message ?? 'Verification failed');
            setBusy(false);
          }
        },
        modal: { ondismiss: () => setBusy(false) },
      });
      rzp.open();
    } catch (e: any) {
      setError(e?.message ?? 'Failed to start upgrade');
      setBusy(false);
    }
  }

  // ============================================================
  // STATE 1: no subscription OR expired -> plan picker
  // ============================================================
  if (view.isExpired || view.noSubscription) {
    return (
      <>
        <PageHeader title="My Plan" subtitle="Your subscription, renewal and payment history" />

        <div className="mb-4">
          <Alert tone={view.noSubscription ? 'warning' : 'error'}>
            <div className="flex items-start gap-2">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <div>
                <strong>
                  {view.noSubscription
                    ? 'No active subscription'
                    : view.isFree
                    ? 'Your free trial has ended.'
                    : 'Your subscription has expired.'}
                </strong>
                <p className="mt-0.5 text-xs">
                  {view.noSubscription
                    ? "Your organization doesn't have a plan yet. Choose one below to activate."
                    : view.isFree
                    ? 'Upgrade to a paid plan to restore full access. Your data stays intact.'
                    : 'Choose a plan below to restore full access.'}
                </p>
              </div>
            </div>
          </Alert>
        </div>

        <Card>
          <CardHeader title="Choose a plan" subtitle="Select a plan to activate your subscription" />
          <CardBody>
            {error && <div className="mb-3"><Alert tone="error">{error}</Alert></div>}
            {renewablePlans.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-500">
                No plans are available right now. Please contact support.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {renewablePlans.map((p: any) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleUpgrade(p.id)}
                    disabled={busy || !canRenew}
                    className="rounded-lg border border-slate-200 p-4 text-left transition hover:border-brand-400 hover:bg-brand-50 disabled:opacity-50"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-base font-semibold text-slate-900">{p.name}</div>
                        <div className="mt-0.5 font-mono text-2xs text-slate-500">{p.code}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono text-lg font-semibold text-slate-900">
                          {money(p.price_paise)}
                        </div>
                        <div className="text-2xs text-slate-500">
                          / {p.billing_cycle === 'YEARLY' ? 'yr' : 'mo'}
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-2xs text-slate-600">
                      <span>{p.max_branches} branch{p.max_branches === 1 ? '' : 'es'}</span>
                      <span>?</span>
                      <span>{p.max_users} users</span>
                    </div>
                    <div className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-brand-600">
                      Continue <ArrowRight size={12} />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </>
    );
  }

  // ============================================================
  // STATE 2: active subscription -> plan card + upgrade option
  // ============================================================
  const statusKey = subscription?.status ?? 'ACTIVE';
  const tone = statusTone[statusKey] ?? 'gray';

  return (
    <>
      <PageHeader title="My Plan" subtitle="Your subscription, renewal and payment history" />

      {view.isFree && (
        <div className="mb-4">
          <Alert tone="info">
            <div className="flex items-start gap-2">
              <Sparkles size={16} className="mt-0.5 shrink-0" />
              <div>
                <strong>You're on a free trial.</strong>
                <p className="mt-0.5 text-xs">
                  {daysRemaining} day{daysRemaining === 1 ? '' : 's'} left. Upgrade any time to keep access after the trial.
                </p>
              </div>
            </div>
          </Alert>
        </div>
      )}

      {success && (
        <div className="mb-4">
          <Alert tone="success">{success}</Alert>
        </div>
      )}

      {error && <div className="mb-4"><Alert tone="error">{error}</Alert></div>}

      <Card className="mb-6">
        <CardBody>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-slate-900">{plan?.name ?? 'Plan'}</h2>
                <Badge tone={tone as any}>{subscription?.status ?? 'ACTIVE'}</Badge>
                {view.isFree && <Badge tone="blue">Free trial</Badge>}
              </div>
              <p className="mt-0.5 font-mono text-2xs text-slate-500">{plan?.code ?? ''}</p>
            </div>
            <div className="text-right">
              <div className="text-2xs uppercase tracking-wide text-slate-500">Days remaining</div>
              <div className="mt-0.5 text-2xl font-semibold tabular-nums text-slate-900">{daysRemaining}</div>
              <div className="text-2xs text-slate-500">
                {view.endsAt ? new Date(view.endsAt).toLocaleDateString() : ''}
              </div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-slate-200 bg-slate-50/40 p-3">
              <div className="text-2xs uppercase tracking-wide text-slate-500">Branches</div>
              <div className="mt-0.5 text-sm font-semibold text-slate-900">Up to {plan?.max_branches ?? '-'}</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50/40 p-3">
              <div className="text-2xs uppercase tracking-wide text-slate-500">Users</div>
              <div className="mt-0.5 text-sm font-semibold text-slate-900">Up to {plan?.max_users ?? '-'}</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50/40 p-3">
              <div className="text-2xs uppercase tracking-wide text-slate-500">Billing</div>
              <div className="mt-0.5 text-sm font-semibold text-slate-900">
                {plan?.billing_cycle === 'YEARLY' ? 'Yearly' : 'Monthly'}
              </div>
            </div>
          </div>

          <div className="mt-4 flex justify-end">
            <Button
              onClick={() => setPickerOpen(true)}
              disabled={!canRenew || busy || renewablePlans.length === 0}
              rightIcon={<ArrowRight size={14} />}
            >
              {view.ctaLabel}
            </Button>
          </div>
        </CardBody>
      </Card>

      {payments.length > 0 && (
        <Card>
          <CardHeader title="Payment history" subtitle={payments.length + ' record(s)'} />
          <CardBody className="p-0">
            <ul className="divide-y divide-slate-100">
              {payments.map((p: any) => (
                <li key={p.id} className="flex items-center justify-between px-4 py-3 text-sm">
                  <div>
                    <div className="font-mono font-medium text-slate-800">{money(p.amount_paise)}</div>
                    <div className="text-xs text-slate-500">
                      {p.razorpay_payment_id ?? '-'} - {p.status}
                    </div>
                  </div>
                  <div className="text-xs text-slate-500">{new Date(p.created_at).toLocaleString()}</div>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}

      <Modal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title="Extend or upgrade your plan"
        footer={<Button variant="secondary" onClick={() => setPickerOpen(false)}>Cancel</Button>}
        size="lg"
      >
        {renewablePlans.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">
            No plans are available right now. Please contact support.
          </p>
        ) : (
          <div className="space-y-3">
            {renewablePlans.map((p: any) => (
              <div
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 p-4"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-900">{p.name}</span>
                    <Badge tone="gray">{p.code}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    Up to {p.max_branches} branch{p.max_branches === 1 ? '' : 'es'} - {p.max_users} users - {p.billing_cycle === 'YEARLY' ? 'Yearly' : 'Monthly'}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-base font-semibold text-slate-900">
                    {money(p.price_paise)}
                  </span>
                  <Button onClick={() => handleUpgrade(p.id)} disabled={busy}>
                    Choose <ArrowRight size={14} />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </>
  );
}

import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Activity, Eye, EyeOff } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Alert } from '@/components/ui/Alert';
import { usePublicPlans, useSignup, useVerifySignature } from '@/hooks/useSubscriptions';
import { ApiError } from '@/lib/api';

const RZP_SCRIPT = 'https://checkout.razorpay.com/v1/checkout.js';

function loadRazorpay(): Promise<boolean> {
  return new Promise((resolve) => {
    if ((window as any).Razorpay) return resolve(true);
    const existing = document.querySelector(`script[src="${RZP_SCRIPT}"]`);
    if (existing) { existing.addEventListener('load', () => resolve(true)); return; }
    const s = document.createElement('script');
    s.src = RZP_SCRIPT;
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

interface FormValues {
  contactName: string; email: string; password: string; contactPhone: string;
  hospitalName: string; tenantType: 'CLINIC' | 'HOSPITAL'; planCode: string;
}

export function SignupPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const plans = usePublicPlans();
  const signup = useSignup();
  const verify = useVerifySignature();
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const { register, handleSubmit, setValue, watch, formState: { isSubmitting } } = useForm<FormValues>({
    defaultValues: { contactName: '', email: '', password: '', contactPhone: '', hospitalName: '', tenantType: 'CLINIC', planCode: '' },
  });

  const selectedPlan = watch('planCode');

  useEffect(() => {
    const q = params.get('plan');
    if (q) setValue('planCode', q);
    else if (plans.data && plans.data.length > 0) setValue('planCode', plans.data[0]!.code);
  }, [params, plans.data, setValue]);

  async function onSubmit(values: FormValues) {
    setError(null); setProcessing(true);
    try {
      const res = await signup.mutateAsync({
        email: values.email,
        password: values.password,
        contactName: values.contactName,
        contactPhone: values.contactPhone || null,
        hospitalName: values.hospitalName,
        tenantType: values.tenantType,
        planCode: values.planCode,
      } as any);

      const ok = await loadRazorpay();
      if (!ok || !(window as any).Razorpay) {
        setError('Failed to load Razorpay. Check your connection and try again.');
        setProcessing(false); return;
      }

      const rzp = new (window as any).Razorpay({
        key: res.razorpayKeyId, amount: res.amount, currency: res.currency,
        name: 'Medical SaaS', description: `${res.plan.name} subscription`,
        order_id: res.orderId,
        prefill: { name: values.contactName, email: values.email, contact: values.contactPhone },
        theme: { color: '#3b5bff' },
        handler: async (response: any) => {
          try {
            await verify.mutateAsync({
              orderId: response.razorpay_order_id,
              paymentId: response.razorpay_payment_id,
              signature: response.razorpay_signature,
            });
            navigate(`/signup/success?signupId=${res.signupId}`, { replace: true });
          } catch (e: any) {
            setError(e instanceof ApiError ? e.message : 'Signature verification failed');
            setProcessing(false);
          }
        },
        modal: { ondismiss: () => { setProcessing(false); setError('Payment was cancelled.'); } },
      });
      rzp.open();
    } catch (e: any) {
      setError(e instanceof ApiError ? e.message : (e?.message ?? 'Signup failed'));
      setProcessing(false);
    }
  }

  const busy = isSubmitting || processing || signup.isPending || verify.isPending;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3.5 md:px-6">
          <Link to="/pricing" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white">
              <Activity size={16} />
            </div>
            <span className="font-semibold text-slate-900">MedSaaS</span>
          </Link>
          <Link to="/login" className="text-sm font-medium text-slate-600 hover:text-slate-900">Sign in</Link>
        </div>
      </header>

      <main className="mx-auto max-w-xl px-4 py-8 md:px-6 md:py-12">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-slate-900">Create your account</h1>
          <p className="mt-1 text-sm text-slate-600">
            Pick a plan, pay securely, and your hospital workspace is created automatically.
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-card md:p-6">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {error && <Alert tone="error">{error}</Alert>}

            {/* Plan picker as cards */}
            <div>
              <label className="mb-2 block text-xs font-medium text-slate-600">Plan</label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {plans.data?.map((p) => {
                  const active = selectedPlan === p.code;
                  return (
                    <button
                      type="button"
                      key={p.id}
                      onClick={() => setValue('planCode', p.code)}
                      className={`rounded-lg border p-3 text-left transition-all ${
                        active ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-500/20' : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-slate-900">{p.name}</span>
                        {active && <span className="h-4 w-4 rounded-full bg-brand-500 ring-4 ring-brand-500/20" />}
                      </div>
                      <p className="mt-1 font-mono text-2xs text-slate-500">
                        ₹{(p.price_paise / 100).toFixed(0)}/{p.billing_cycle === 'MONTHLY' ? 'mo' : 'yr'}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Select label="Organization type" {...register('tenantType', { required: true })}>
                <option value="CLINIC">Clinic</option>
                <option value="HOSPITAL">Hospital</option>
              </Select>
              <Input label="Organization name" placeholder="Demo Hospital" {...register('hospitalName', { required: true })} />
            </div>

            <div className="h-px bg-slate-100" />

            <Input label="Your full name" placeholder="Dr. Anita Rao" {...register('contactName', { required: true })} />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input label="Email" type="email" placeholder="you@example.com" {...register('email', { required: true })} />
              <Input
                label="Password"
                type={showPassword ? 'text' : 'password'}
                placeholder="At least 8 characters"
                autoComplete="new-password"
                rightSlot={
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowPassword((s) => !s)}
                    className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                }
                {...register('password', { required: true, minLength: 8 })}
              />
            </div>
            <Input label="Phone (optional)" placeholder="9876543210" {...register('contactPhone')} />

            <div className="sticky bottom-0 -mx-5 -mb-5 border-t border-slate-100 bg-white px-5 py-3 md:static md:mx-0 md:mb-0 md:border-0 md:bg-transparent md:p-0">
              <Button type="submit" className="w-full" size="lg" loading={busy}>
                Continue to payment
              </Button>
              <p className="mt-2 text-center text-xs text-slate-500">
                You will be charged the plan amount via Razorpay. Cancel anytime.
              </p>
            </div>
          </form>
        </div>

        <p className="mt-6 text-center text-sm text-slate-500">
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-brand-600 hover:text-brand-700">Sign in</Link>
        </p>
      </main>
    </div>
  );
}
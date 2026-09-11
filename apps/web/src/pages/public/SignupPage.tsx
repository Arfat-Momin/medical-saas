import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Activity } from 'lucide-react';
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
    if (window.Razorpay) return resolve(true);
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

interface FormValues {
  contactName: string;
  email: string;
  password: string;
  contactPhone: string;
  hospitalName: string;
  tenantType: 'CLINIC' | 'HOSPITAL';
  planCode: string;
}

export function SignupPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const plans = usePublicPlans();
  const signup = useSignup();
  const verify = useVerifySignature();

  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  const { register, handleSubmit, setValue, formState: { isSubmitting } } = useForm<FormValues>({
    defaultValues: {
      contactName: '', email: '', password: '', contactPhone: '',
      hospitalName: '', tenantType: 'CLINIC', planCode: '',
    },
  });

  // Preselect plan from ?plan=CODE and default to first if empty
  useEffect(() => {
    const q = params.get('plan');
    if (q) setValue('planCode', q);
    else if (plans.data && plans.data.length > 0) setValue('planCode', plans.data[0]!.code);
  }, [params, plans.data, setValue]);

  async function onSubmit(values: FormValues) {
    setError(null);
    setProcessing(true);

    try {
      // 1. Create signup + Razorpay order
      const res = await signup.mutateAsync({
        email: values.email,
        password: values.password,
        contactName: values.contactName,
        contactPhone: values.contactPhone || null,
        hospitalName: values.hospitalName,
        tenantType: values.tenantType,
        planCode: values.planCode,
      });

      // 2. Load Razorpay checkout
      const ok = await loadRazorpay();
      if (!ok || !window.Razorpay) {
        setError('Failed to load Razorpay. Check your internet and try again.');
        setProcessing(false);
        return;
      }

      // 3. Open checkout
      const rzp = new window.Razorpay({
        key: res.razorpayKeyId,
        amount: res.amount,
        currency: res.currency,
        name: 'Medical SaaS',
        description: `${res.plan.name} subscription`,
        order_id: res.orderId,
        prefill: { name: values.contactName, email: values.email, contact: values.contactPhone },
        theme: { color: '#2563eb' },
        handler: async (response) => {
          try {
            await verify.mutateAsync({
              orderId: response.razorpay_order_id,
              paymentId: response.razorpay_payment_id,
              signature: response.razorpay_signature,
            });
            // Redirect to success page — it polls for provisioning
            navigate(`/signup/success?signupId=${res.signupId}`, { replace: true });
          } catch (e: any) {
            const msg = e instanceof ApiError ? e.message : 'Signature verification failed';
            setError(msg);
            setProcessing(false);
          }
        },
        modal: {
          ondismiss: () => {
            setProcessing(false);
            setError('Payment was cancelled. You can try again.');
          },
        },
      });

      rzp.open();
    } catch (e: any) {
      const msg = e instanceof ApiError ? e.message : (e?.message ?? 'Signup failed');
      setError(msg);
      setProcessing(false);
    }
  }

  const busy = isSubmitting || processing || signup.isPending || verify.isPending;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <Link to="/pricing" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white">
              <Activity size={18} />
            </div>
            <span className="font-semibold text-slate-900">Medical SaaS</span>
          </Link>
          <Link to="/login" className="text-sm font-medium text-slate-600 hover:text-slate-900">
            Sign in
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-xl px-6 py-10">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-slate-900">Create your account</h1>
          <p className="mt-1 text-sm text-slate-600">
            Pick a plan, pay securely via Razorpay, and your hospital workspace is created automatically.
          </p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {error && <Alert tone="error">{error}</Alert>}

            <Select label="Plan *" {...register('planCode', { required: true })}>
              <option value="">- select a plan -</option>
              {plans.data?.map((p) => (
                <option key={p.id} value={p.code}>
                  {p.name} - Rs.{(p.price_paise / 100).toFixed(0)}/{p.billing_cycle === 'MONTHLY' ? 'mo' : 'yr'}
                </option>
              ))}
            </Select>

            <Select label="Organization type *" {...register('tenantType', { required: true })}>
              <option value="CLINIC">Clinic</option>
              <option value="HOSPITAL">Hospital</option>
            </Select>

            <Input
              label="Organization name *"
              placeholder="Demo Hospital"
              {...register('hospitalName', { required: true })}
            />

            <hr className="my-2 border-slate-100" />

            <Input
              label="Your full name *"
              placeholder="Dr. Anita Rao"
              {...register('contactName', { required: true })}
            />
            <Input
              label="Email *"
              type="email"
              placeholder="you@example.com"
              {...register('email', { required: true })}
            />
            <Input
              label="Password *"
              type="password"
              placeholder="At least 8 characters"
              {...register('password', { required: true, minLength: 8 })}
            />
            <Input
              label="Phone (optional)"
              placeholder="9876543210"
              {...register('contactPhone')}
            />

            <Button type="submit" className="w-full" loading={busy}>
              Continue to payment
            </Button>

            <p className="text-center text-xs text-slate-500">
              By continuing, you agree to our terms. You will be charged the plan amount via Razorpay.
            </p>
          </form>
        </div>

        <p className="mt-6 text-center text-sm text-slate-500">
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-brand-600 hover:underline">
            Sign in
          </Link>
        </p>
      </main>
    </div>
  );
}

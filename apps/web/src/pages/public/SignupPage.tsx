import { useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import {
  ArrowRight,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
  Activity,
  Building2,
  User,
  Phone,
  CheckCircle2,
} from 'lucide-react';
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

const inputClass = "block w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-[15px] text-slate-900 placeholder-slate-400 shadow-sm transition focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 disabled:bg-stone-50 disabled:text-slate-500";

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-[13px] font-semibold text-slate-700">
        {label}
      </label>
      {children}
    </div>
  );
}

function Brand({ light, compact }: { light?: boolean; compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className={`flex items-center justify-center rounded-xl ${light ? 'bg-white text-teal-900 shadow-[0_0_20px_rgba(255,255,255,0.2)]' : 'bg-teal-700 text-white shadow-md'} ${compact ? 'h-9 w-9' : 'h-10 w-10'}`}>
        <Activity size={compact ? 18 : 22} strokeWidth={2.5} />
      </div>
      <span className={`font-bold tracking-tight ${compact ? 'text-lg' : 'text-xl'} ${light ? 'text-white' : 'text-slate-900'}`}>
        Med SaaS
      </span>
    </div>
  );
}

const stats = [
  { value: "12.4k", label: "Clinicians" },
  { value: "4.8M", label: "Records" },
  { value: "99.99%", label: "Uptime" },
];

function BrandPanel() {
  return (
    <aside className="relative hidden min-h-screen overflow-hidden lg:block">
      <img
        src="https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?q=80&w=2000&auto=format&fit=crop"
        alt="Sunlit atrium of a Med SaaS partner hospital"
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-[#061018] via-[#061018]/62 to-[#061018]/25" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(45,212,191,0.18),transparent_46%)]" />

      <div className="relative flex h-full min-h-screen flex-col justify-between p-10 xl:p-14">
        <div className="flex items-center justify-between">
          <Brand light />
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[11px] font-medium tracking-wide text-teal-50 backdrop-blur-md">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]" />
            Encrypted session
          </span>
        </div>

        <div className="max-w-xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-teal-200/90">
            Care coordination, refined
          </p>
          <h1 className="mt-5 font-serif text-[3.15rem] leading-[1.05] tracking-[-0.03em] text-white xl:text-[3.6rem]">
            Clinical intelligence for teams who refuse to compromise on care.
          </h1>
          <p className="mt-5 max-w-md text-[15px] leading-relaxed text-slate-200/85">
            One calm workspace for rounds, orders, and follow-ups — built for hospitals,
            specialty groups, and modern practices.
          </p>

          <dl className="mt-10 grid max-w-md grid-cols-3 gap-6 border-t border-white/10 pt-8">
            {stats.map((stat) => (
              <div key={stat.label}>
                <dt className="text-[11px] uppercase tracking-[0.18em] text-slate-300/80">
                  {stat.label}
                </dt>
                <dd className="mt-1 font-serif text-[1.85rem] text-white">{stat.value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <figure className="max-w-lg rounded-2xl border border-white/10 bg-white/10 p-5 backdrop-blur-xl">
          <blockquote className="text-[15px] leading-relaxed text-slate-100/95">
            “Med SaaS gave our cardiology group a single source of truth — rounds, orders,
            and follow-ups finally live in one quiet, reliable workspace.”
          </blockquote>
          <figcaption className="mt-4 flex items-center gap-3">
            <img
              src="https://images.unsplash.com/photo-1559839734-2b71ea197ec2?q=80&w=200&auto=format&fit=crop"
              alt="Dr. Amelia Chen"
              className="h-11 w-11 rounded-full object-cover ring-2 ring-white/30"
            />
            <div>
              <p className="text-sm font-semibold text-white">Dr. Amelia Chen</p>
              <p className="text-xs text-slate-300">Chief Medical Officer, Northwell</p>
            </div>
          </figcaption>
        </figure>
      </div>
    </aside>
  );
}

function AuthMobileHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="relative isolate overflow-hidden bg-[#071018] px-6 pb-9 pt-7 lg:hidden">
      <img
        src="https://images.unsplash.com/photo-1551076805-e1869033e561?q=80&w=1000&auto=format&fit=crop"
        alt=""
        className="absolute inset-0 h-full w-full object-cover opacity-55"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[#F3F0EA]" />
      <div className="relative">
        <Brand light compact />
        <h1 className="mt-7 font-serif text-[2.15rem] leading-tight text-white">{title}</h1>
        <p className="mt-2 max-w-sm text-sm text-slate-200/85">{subtitle}</p>
      </div>
    </div>
  );
}

function AuthFooter() {
  return (
    <p className="mt-auto px-6 pb-6 pt-8 text-center text-[11px] leading-relaxed text-slate-500 lg:px-10">
      HIPAA · SOC 2 Type II · HITRUST · AES-256 at rest · TLS 1.3 in transit
      <span className="mt-1 block text-slate-400">© 2026 Med SaaS. All rights reserved.</span>
    </p>
  );
}

function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F3F0EA] lg:grid lg:grid-cols-2">
      <BrandPanel />
      <div className="relative flex min-h-screen flex-col overflow-y-auto">{children}</div>
    </div>
  );
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

      if ((res as any).isFree) {
        navigate(`/signup/success?signupId=${res.signupId}`, { replace: true });
        return;
      }

      const ok = await loadRazorpay();
      if (!ok || !(window as any).Razorpay) {
        setError('Failed to load Razorpay. Check your connection and try again.');
        setProcessing(false); return;
      }

      const rzp = new (window as any).Razorpay({
        key: res.razorpayKeyId, amount: res.amount, currency: res.currency,
        name: 'Med SaaS', description: `${res.plan.name} subscription`,
        order_id: res.orderId,
        prefill: { name: values.contactName, email: values.email, contact: values.contactPhone || undefined },
        theme: { color: '#0d9488' }, // teal-600
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
    <AuthShell>
      <AuthMobileHeader
        title="Create workspace."
        subtitle="Set up your clinical environment in minutes."
      />
      <div className="flex flex-1 flex-col px-6 py-8 sm:px-10 lg:justify-center lg:px-16 lg:py-12 xl:px-24">
        <div className="mb-8 hidden justify-end text-[13px] text-slate-500 lg:flex">
          Already have a workspace?{" "}
          <Link to="/login" className="ml-1 font-semibold text-teal-800 hover:text-teal-950">
            Sign in
          </Link>
        </div>
        
        <div className="flex flex-1 items-start justify-center lg:items-center py-6">
          <form onSubmit={handleSubmit(onSubmit)} className="w-full max-w-[460px] animate-fade-in" noValidate>
            <div className="hidden lg:block mb-8">
              <p className="text-[12px] font-semibold uppercase tracking-[0.22em] text-teal-800">
                Get Started
              </p>
              <h2 className="mt-2 font-serif text-[2.35rem] leading-none tracking-[-0.03em] text-slate-950">
                Create workspace
              </h2>
              <p className="mt-3 text-[15px] leading-relaxed text-slate-600">
                Set up your clinical environment in minutes.
              </p>
            </div>

            {error ? (
              <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-[13px] text-red-900">
                {error}
              </div>
            ) : null}

            <div className="space-y-8">
              {/* Step 1: Plan */}
              <div>
                <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.15em] text-teal-900/70 border-b border-stone-200 pb-2">
                  1. Select Plan
                </h3>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {plans.data?.map((p) => {
                    const active = selectedPlan === p.code;
                    return (
                      <button
                        type="button"
                        key={p.id}
                        onClick={() => setValue('planCode', p.code)}
                        className={`relative flex flex-col items-start justify-between rounded-xl border-2 p-4 text-left transition-all ${
                          active
                            ? 'border-teal-500 bg-teal-50/50 shadow-sm'
                            : 'border-stone-200 bg-white hover:border-stone-300'
                        }`}
                      >
                        <div className="flex w-full items-center justify-between mb-2">
                          <span className="text-sm font-bold text-slate-900">{p.name}</span>
                          {active ? (
                            <CheckCircle2 size={18} className="text-teal-600" />
                          ) : (
                            <div className="h-[18px] w-[18px] rounded-full border-2 border-stone-200" />
                          )}
                        </div>
                        <p className="font-serif text-xl font-bold text-slate-900 tracking-tight">
                          ₹{(p.price_paise / 100).toFixed(0)}
                          <span className="font-sans text-xs font-medium text-slate-500 ml-0.5">
                            /{p.billing_cycle === 'MONTHLY' ? 'mo' : 'yr'}
                          </span>
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Step 2: Organization */}
              <div>
                <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.15em] text-teal-900/70 border-b border-stone-200 pb-2">
                  2. Organization Details
                </h3>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Organization Type" htmlFor="tenantType">
                    <select
                      id="tenantType"
                      className={`${inputClass} appearance-none`}
                      {...register('tenantType', { required: true })}
                    >
                      <option value="CLINIC">Clinic</option>
                      <option value="HOSPITAL">Hospital</option>
                    </select>
                  </Field>
                  <Field label="Organization Name" htmlFor="hospitalName">
                    <div className="relative">
                      <Building2 className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        id="hospitalName"
                        type="text"
                        placeholder="City Care"
                        className={`${inputClass} pl-10`}
                        {...register('hospitalName', { required: true })}
                      />
                    </div>
                  </Field>
                </div>
              </div>

              {/* Step 3: Admin Account */}
              <div>
                <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.15em] text-teal-900/70 border-b border-stone-200 pb-2">
                  3. Admin Account
                </h3>
                <div className="space-y-4">
                  <Field label="Full Name" htmlFor="contactName">
                    <div className="relative">
                      <User className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        id="contactName"
                        type="text"
                        placeholder="Dr. Anita Rao"
                        className={`${inputClass} pl-10`}
                        {...register('contactName', { required: true })}
                      />
                    </div>
                  </Field>
                  
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Field label="Work Email" htmlFor="email">
                      <div className="relative">
                        <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input
                          id="email"
                          type="email"
                          placeholder="you@clinic.org"
                          className={`${inputClass} pl-10`}
                          {...register('email', { required: true })}
                        />
                      </div>
                    </Field>
                    
                    <Field label="Password" htmlFor="password">
                      <div className="relative">
                        <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input
                          id="password"
                          type={showPassword ? 'text' : 'password'}
                          placeholder="Min. 8 characters"
                          className={`${inputClass} px-10`}
                          {...register('password', { required: true, minLength: 8 })}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((v) => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 transition hover:text-slate-700"
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </Field>
                  </div>

                  <Field label="Phone Number (Optional)" htmlFor="contactPhone">
                    <div className="relative">
                      <Phone className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        id="contactPhone"
                        type="tel"
                        placeholder="+91 98765 43210"
                        className={`${inputClass} pl-10`}
                        {...register('contactPhone')}
                      />
                    </div>
                  </Field>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={busy}
              className="group mt-10 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-teal-600 to-teal-800 px-4 py-3.5 text-[15px] font-semibold text-white shadow-[0_12px_24px_rgba(13,116,110,0.28)] transition hover:from-teal-500 hover:to-teal-700 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {busy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Processing…
                </>
              ) : (
                <>
                  Proceed to Checkout
                  <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                </>
              )}
            </button>

            <p className="mt-5 flex items-center justify-center gap-1.5 text-[12px] text-slate-500">
              <ShieldCheck className="h-3.5 w-3.5 text-teal-700" />
              Secure payment processing via Razorpay
            </p>

            <p className="mt-6 text-center text-[13px] text-slate-600 lg:hidden">
              Already have an account?{" "}
              <Link to="/login" className="font-semibold text-teal-800 hover:text-teal-950">
                Sign in
              </Link>
            </p>
          </form>
        </div>
        
        <AuthFooter />
      </div>
    </AuthShell>
  );
}
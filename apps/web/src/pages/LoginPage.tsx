import { useState, type ReactNode } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import {
  ArrowRight,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
  Activity
} from 'lucide-react';
import { authRepository } from '@/repositories/auth.repository';
import { useAuthStore } from '@/stores/auth.store';
import { triggerSyncNow } from '@/sync/listeners';
import { ApiError } from '@/lib/api';

interface FormValues { email: string; password: string; remember: boolean; }

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
      <div className="relative flex min-h-screen flex-col">{children}</div>
    </div>
  );
}

export function LoginPage() {
  const navigate = useNavigate();
  const setSession = useAuthStore((s) => s.setSession);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const { register, handleSubmit, setValue, watch, formState: { isSubmitting } } = useForm<FormValues>({
    defaultValues: { email: '', password: '', remember: true },
  });

  const emailValue = watch("email");
  const passwordValue = watch("password");

  async function onSubmit(values: FormValues) {
    setError("");
    setInfo("");

    if (!values.email.includes("@")) {
      setError("Enter a valid work email.");
      return;
    }
    if (values.password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    try {
      const res = await authRepository.login(values.email, values.password);
      setSession(res);
      void triggerSyncNow().catch(() => {});
      navigate('/dashboard', { replace: true });
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Unable to sign in. Please try again.';
      setError(msg);
    }
  }

  function fillDemo() {
    setValue('email', "demo@hospital.com");
    setValue('password', "demo12345");
    setError("");
    setInfo("Demo clinician loaded. Sign in to open the clinical workspace.");
  }

  return (
    <AuthShell>
      <AuthMobileHeader
        title="Welcome back."
        subtitle="Sign in to your clinical workspace."
      />
      <div className="flex flex-1 flex-col px-6 py-8 sm:px-10 lg:justify-center lg:px-16 lg:py-12 xl:px-24">
        <div className="mb-8 hidden justify-end text-[13px] text-slate-500 lg:flex">
          Need a workspace?{" "}
          <Link to="/signup" className="ml-1 font-semibold text-teal-800 hover:text-teal-950">
            Request access
          </Link>
        </div>
        
        <div className="flex flex-1 items-start justify-center lg:items-center">
          <form onSubmit={handleSubmit(onSubmit)} className="w-full max-w-[420px] animate-fade-in" noValidate>
            <div className="hidden lg:block">
              <p className="text-[12px] font-semibold uppercase tracking-[0.22em] text-teal-800">
                Welcome back
              </p>
              <h2 className="mt-2 font-serif text-[2.35rem] leading-none tracking-[-0.03em] text-slate-950">
                Sign in to Med SaaS
              </h2>
              <p className="mt-3 text-[15px] leading-relaxed text-slate-600">
                Access your clinical workspace, census, and care team.
              </p>
            </div>

            {error ? (
              <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-[13px] text-red-900">
                {error}
              </div>
            ) : null}

            {info && !error ? (
              <div className="mt-6 rounded-xl border border-teal-200 bg-teal-50 px-3.5 py-3 text-[13px] text-teal-900">
                {info}
              </div>
            ) : null}

            <div className={`${error || info ? "mt-5" : "mt-8"} space-y-4 lg:mt-8`}>
              <Field label="Work email" htmlFor="email">
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    id="email"
                    type="email"
                    autoComplete="username"
                    placeholder="you@clinic.org"
                    className={`${inputClass} pl-10`}
                    {...register("email", { required: true })}
                  />
                </div>
              </Field>

              <Field label="Password" htmlFor="password">
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    className={`${inputClass} px-10`}
                    {...register("password", { required: true })}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 transition hover:text-slate-700"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </Field>
            </div>

            <div className="mt-4 flex items-center justify-between gap-3">
              <label className="flex cursor-pointer items-center gap-2 text-[13px] text-slate-600">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-stone-300 text-teal-700 accent-teal-700"
                  {...register("remember")}
                />
                Remember this device
              </label>
              <a href="#" className="text-[13px] font-medium text-teal-800 transition hover:text-teal-950">
                Forgot password?
              </a>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="group mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-teal-600 to-teal-800 px-4 py-3.5 text-[15px] font-semibold text-white shadow-[0_12px_24px_rgba(13,116,110,0.28)] transition hover:from-teal-500 hover:to-teal-700 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Authenticating…
                </>
              ) : (
                <>
                  Sign in to workspace
                  <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                </>
              )}
            </button>

            <div className="mt-6 flex items-center gap-3 text-[11px] uppercase tracking-[0.18em] text-slate-400">
              <span className="h-px flex-1 bg-stone-300/80" />
              or continue with
              <span className="h-px flex-1 bg-stone-300/80" />
            </div>

            <button
              type="button"
              onClick={fillDemo}
              className="mt-5 w-full rounded-xl border border-dashed border-stone-300 bg-white/60 px-4 py-3 text-left transition hover:border-teal-300 hover:bg-teal-50/70"
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-teal-800">
                Guided demo
              </p>
              <p className="mt-1 text-[13px] text-slate-600">
                Use <span className="font-medium text-slate-900">demo@hospital.com</span> — password fills automatically.
              </p>
            </button>

            <p className="mt-6 text-center text-[13px] text-slate-600">
              New to Med SaaS?{" "}
              <Link to="/signup" className="font-semibold text-teal-800 hover:text-teal-950">
                Request a workspace
              </Link>
            </p>

            <p className="mt-5 flex items-center justify-center gap-1.5 text-[12px] text-slate-500">
              <ShieldCheck className="h-3.5 w-3.5 text-teal-700" />
              Protected by role-based access and audit logging
            </p>
          </form>
        </div>
        
        <AuthFooter />
      </div>
    </AuthShell>
  );
}
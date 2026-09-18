import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { Activity, Lock, Mail, ShieldCheck, WifiOff, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Alert } from '@/components/ui/Alert';
import { authRepository } from '@/repositories/auth.repository';
import { useAuthStore } from '@/stores/auth.store';
import { triggerSyncNow } from '@/sync/listeners';
import { ApiError } from '@/lib/api';

interface FormValues { email: string; password: string; }

export function LoginPage() {
  const navigate = useNavigate();
  const setSession = useAuthStore((s) => s.setSession);
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState: { isSubmitting } } = useForm<FormValues>({
    defaultValues: { email: '', password: '' },
  });

  async function onSubmit(values: FormValues) {
    setError(null);
    try {
      const res = await authRepository.login(values.email, values.password);
      setSession(res);
      void triggerSyncNow().catch(() => {});
      navigate('/dashboard', { replace: true });
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Sign-in failed. Please try again.';
      setError(msg);
    }
  }

  return (
    <>
      {/* Ambient background — fixed, off flex flow */}
      <div
        aria-hidden="true"
        style={{
          position: 'fixed',
          inset: 0,
          overflow: 'hidden',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      >
        <div
          className="ambient-float"
          style={{
            position: 'absolute',
            top: '-200px',
            left: '-180px',
            width: 500,
            height: 500,
            borderRadius: '50%',
            filter: 'blur(110px)',
            opacity: 0.4,
            background: 'radial-gradient(circle, rgba(31,148,116,0.7), transparent 70%)',
          }}
        />
        <div
          className="ambient-float"
          style={{
            position: 'absolute',
            bottom: '-240px',
            right: '-160px',
            width: 580,
            height: 580,
            borderRadius: '50%',
            filter: 'blur(120px)',
            opacity: 0.34,
            background: 'radial-gradient(circle, rgba(16,185,129,0.6), transparent 70%)',
            animationDelay: '-9s',
          }}
        />
      </div>

      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-10">
        <div className="glass-strong ios-enter grid w-full max-w-5xl grid-cols-1 overflow-hidden rounded-3xl shadow-glass-pop lg:grid-cols-[1.05fr_1fr]">

          {/* Left: brand panel */}
          <aside className="relative hidden flex-col justify-between overflow-hidden p-10 lg:flex">
            <div className="pointer-events-none absolute inset-0" style={{ background: 'linear-gradient(155deg, rgba(31,148,116,0.14) 0%, rgba(16,185,129,0.10) 45%, rgba(20,122,95,0.12) 100%)' }} />
            <div className="pointer-events-none absolute -right-20 top-1/3 h-72 w-72 rounded-full" style={{ background: 'radial-gradient(circle, rgba(31,148,116,0.30), transparent 70%)', filter: 'blur(50px)' }} />
            <div className="pointer-events-none absolute -left-16 bottom-0 h-64 w-64 rounded-full" style={{ background: 'radial-gradient(circle, rgba(16,185,129,0.28), transparent 70%)', filter: 'blur(50px)' }} />

            <div className="relative flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-600 to-brand-800 text-white shadow-glass">
                <Activity size={20} />
              </div>
              <div>
                <p className="text-[15px] font-bold tracking-tight leading-none">MedSaaS</p>
                <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-ink-500">Hospital Suite</p>
              </div>
            </div>

            <div className="relative">
              <h2 className="text-[36px] font-bold leading-[1.1] tracking-tight">
                Care that
                <br />
                <span className="grad-text">moves with you.</span>
              </h2>
              <p className="mt-4 max-w-sm text-[15px] leading-relaxed text-ink-700/70">
                One calm workspace for OPD, IPD, pharmacy, laboratory, and billing —
                built to run reliably even when the network isn't.
              </p>

              <ul className="mt-8 space-y-3.5">
                <li className="flex items-center gap-3">
                  <span className="glass-thin flex h-7 w-7 shrink-0 items-center justify-center rounded-full">
                    <ShieldCheck size={14} className="text-brand-700" />
                  </span>
                  <span className="text-[14px] text-ink-700">Row-level tenant isolation for every record</span>
                </li>
                <li className="flex items-center gap-3">
                  <span className="glass-thin flex h-7 w-7 shrink-0 items-center justify-center rounded-full">
                    <WifiOff size={14} className="text-brand-700" />
                  </span>
                  <span className="text-[14px] text-ink-700">Offline-first — keeps working without internet</span>
                </li>
                <li className="flex items-center gap-3">
                  <span className="glass-thin flex h-7 w-7 shrink-0 items-center justify-center rounded-full">
                    <Lock size={14} className="text-brand-700" />
                  </span>
                  <span className="text-[14px] text-ink-700">Automatic audit trails, zero paperwork</span>
                </li>
              </ul>
            </div>

            <div className="relative glass-thin flex items-center gap-6 rounded-2xl px-5 py-3.5">
              <div>
                <p className="text-[20px] font-bold tabular-nums tracking-tight">8,400+</p>
                <p className="mt-0.5 text-[11px] text-ink-500">Patients managed</p>
              </div>
              <div className="h-8 w-px bg-ink-500/12" />
              <div>
                <p className="text-[20px] font-bold tabular-nums tracking-tight">99.9%</p>
                <p className="mt-0.5 text-[11px] text-ink-500">Uptime</p>
              </div>
            </div>
          </aside>

          {/* Right: form */}
          <div className="relative flex flex-col justify-center p-7 sm:p-10 lg:p-11">
            <div className="mb-6 flex items-center gap-3 lg:hidden">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-600 to-brand-800 text-white shadow-glass">
                <Activity size={18} />
              </div>
              <span className="font-bold tracking-tight">MedSaaS</span>
            </div>

            <div className="mb-6">
              <h1 className="text-2xl font-bold tracking-tight sm:text-[30px]">Welcome back</h1>
              <p className="mt-1.5 text-sm text-ink-500">Sign in to your workspace to continue.</p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
              {error && <Alert tone="error">{error}</Alert>}

              <Input
                label="Work email"
                type="email"
                autoComplete="email"
                placeholder="you@hospital.com"
                leftIcon={<Mail size={15} />}
                {...register('email', { required: true })}
              />

              <Input
                label="Password"
                type="password"
                autoComplete="current-password"
                placeholder="Enter your password"
                leftIcon={<Lock size={15} />}
                {...register('password', { required: true })}
              />

              <Button type="submit" size="lg" loading={isSubmitting} className="mt-2 w-full" rightIcon={<ArrowRight size={16} />}>
                Sign in
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-ink-500">
              Don't have an account?{' '}
              <a href="/pricing" className="font-semibold text-brand-700 hover:underline">Create one</a>
            </p>

            <p className="mt-8 text-center text-[11px] text-ink-400">
              Protected by row-level security. Sessions expire after 7 days of inactivity.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
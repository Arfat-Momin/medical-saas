import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { Activity } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Alert } from '@/components/ui/Alert';
import { authRepository } from '@/repositories/auth.repository';
import { useAuthStore } from '@/stores/auth.store';
import { ApiError } from '@/lib/api';

interface FormValues { email: string; password: string }

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
      navigate('/dashboard', { replace: true });
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Login failed';
      setError(msg);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-2">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-600 text-white">
            <Activity size={22} />
          </div>
          <h1 className="text-xl font-semibold text-slate-900">Medical SaaS</h1>
          <p className="text-sm text-slate-500">Sign in to continue</p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {error && <Alert tone="error">{error}</Alert>}

            <Input
              label="Email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              {...register('email', { required: true })}
            />

            <Input
              label="Password"
              type="password"
              autoComplete="current-password"
              placeholder="********"
              {...register('password', { required: true })}
            />

            <Button type="submit" className="w-full" loading={isSubmitting}>
              Sign in
            </Button>
          </form>
        </div>

        <p className="mt-6 text-center text-sm text-slate-600">
          Don't have an account?{' '}
          <a href="/pricing" className="font-medium text-brand-600 hover:underline">
            Create one
          </a>
        </p>

        <div className="mt-6 rounded-md border border-dashed border-slate-200 bg-slate-50 p-3">
          <p className="text-center text-[11px] font-medium uppercase tracking-wide text-slate-500">
            Demo credentials
          </p>
          <div className="mt-2 space-y-1 text-center text-xs text-slate-500">
            <div>
              Super Admin:{' '}
              <span className="font-mono text-slate-700">admin@platform.com</span>
            </div>
            <div>
              Hospital Admin:{' '}
              <span className="font-mono text-slate-700">hospital@demo.com</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
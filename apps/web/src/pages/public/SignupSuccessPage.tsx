import { Link, useSearchParams } from 'react-router-dom';
import { Activity, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { Alert } from '@/components/ui/Alert';
import { useSignupStatus } from '@/hooks/useSubscriptions';

export function SignupSuccessPage() {
  const [params] = useSearchParams();
  const signupId = params.get('signupId') ?? undefined;
  const status = useSignupStatus(signupId, { refetchInterval: 3000 });

  if (!signupId) {
    return (
      <Shell>
        <XCircle className="mx-auto text-red-500" size={40} />
        <h1 className="mt-3 text-xl font-semibold text-slate-900">Missing signup reference</h1>
        <p className="mt-1 text-sm text-slate-600">
          We couldn't find your signup. If you just paid, check your email or contact support.
        </p>
        <Link to="/pricing" className="mt-4 block"><Button variant="secondary">Back to pricing</Button></Link>
      </Shell>
    );
  }

  const s = status.data?.status;

  return (
    <Shell>
      {status.isLoading && (
        <>
          <Spinner size={36} />
          <h1 className="mt-4 text-xl font-semibold text-slate-900">Checking payment status…</h1>
          <p className="mt-1 text-sm text-slate-600">This takes just a few seconds.</p>
        </>
      )}

      {status.isError && (
        <>
          <XCircle className="mx-auto text-red-500" size={44} />
          <h1 className="mt-3 text-xl font-semibold text-slate-900">Could not reach the server</h1>
          <p className="mt-1 text-sm text-slate-600">
            Your payment may still have succeeded. Refresh this page in a moment or sign in directly.
          </p>
          <Button className="mt-4" onClick={() => status.refetch()}>Retry</Button>
        </>
      )}

      {status.data && (s === 'PENDING' || s === 'PAID') && (
        <>
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-alert-50">
            <Clock className="text-alert-600" size={26} />
          </div>
          <h1 className="mt-4 text-xl font-semibold text-slate-900">Setting up your workspace…</h1>
          <p className="mt-1 text-sm text-slate-600">
            We received your payment and are provisioning your hospital right now.
          </p>
          <div className="mt-4 flex justify-center"><Spinner size={20} /></div>
          <p className="mt-3 font-mono text-2xs text-slate-400">signupId: {signupId.slice(0, 8)}…</p>
        </>
      )}

      {status.data && s === 'PROVISIONED' && (
        <>
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-accent-50">
            <CheckCircle2 className="text-accent-600" size={26} />
          </div>
          <h1 className="mt-4 text-xl font-semibold text-slate-900">You're all set!</h1>
          <p className="mt-1 text-sm text-slate-600">
            <strong>{status.data.hospitalName}</strong> is ready. Sign in with the email and password you just created.
          </p>
          <Link to="/login" className="mt-5 block"><Button className="w-full" size="lg">Go to login</Button></Link>
        </>
      )}

      {status.data && s === 'FAILED' && (
        <>
          <XCircle className="mx-auto text-red-500" size={44} />
          <h1 className="mt-3 text-xl font-semibold text-slate-900">Payment failed</h1>
          <Alert tone="error" className="mt-3 text-left">
            We could not confirm your payment. No workspace was created.
          </Alert>
          <Link to="/pricing" className="mt-4 block"><Button>Try again</Button></Link>
        </>
      )}

      {status.data && s === 'EXPIRED' && (
        <>
          <Clock className="mx-auto text-slate-400" size={44} />
          <h1 className="mt-3 text-xl font-semibold text-slate-900">Signup expired</h1>
          <p className="mt-1 text-sm text-slate-600">This signup was not completed within 24 hours.</p>
          <Link to="/pricing" className="mt-4 block"><Button>Start over</Button></Link>
        </>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-white">
            <Activity size={18} />
          </div>
          <span className="text-lg font-semibold text-slate-900">MedSaaS</span>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-center shadow-card md:p-8">
          {children}
        </div>
      </div>
    </div>
  );
}
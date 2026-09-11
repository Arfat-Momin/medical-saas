import { Link, useSearchParams } from 'react-router-dom';
import { Activity, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { Alert } from '@/components/ui/Alert';
import { useSignupStatus } from '@/hooks/useSubscriptions';

export function SignupSuccessPage() {
  const [params] = useSearchParams();
  const signupId = params.get('signupId') ?? undefined;

  const status = useSignupStatus(signupId, {
    refetchInterval: 3000,
  });

  if (!signupId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <Card className="w-full max-w-md">
          <CardBody className="space-y-3 text-center">
            <XCircle className="mx-auto text-red-500" size={40} />
            <h1 className="text-xl font-semibold">Missing signup reference</h1>
            <p className="text-sm text-slate-600">
              We could not find your signup. If you just paid, please check your email or contact support.
            </p>
            <Link to="/pricing"><Button variant="secondary">Back to pricing</Button></Link>
          </CardBody>
        </Card>
      </div>
    );
  }

  const s = status.data?.status;

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-lg">
        <div className="mb-6 flex items-center justify-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-white">
            <Activity size={20} />
          </div>
          <span className="text-lg font-semibold text-slate-900">Medical SaaS</span>
        </div>

        <Card>
          <CardBody className="space-y-4 text-center">
            {status.isLoading && (
              <>
                <Spinner size={36} />
                <h1 className="text-xl font-semibold">Checking payment status...</h1>
                <p className="text-sm text-slate-600">This only takes a few seconds.</p>
              </>
            )}

            {status.isError && (
              <>
                <XCircle className="mx-auto text-red-500" size={44} />
                <h1 className="text-xl font-semibold">Could not reach the server</h1>
                <p className="text-sm text-slate-600">
                  Your payment may still have succeeded. Refresh this page in a moment, or log in directly.
                </p>
                <Button onClick={() => status.refetch()}>Retry</Button>
              </>
            )}

            {status.data && (s === 'PENDING' || s === 'PAID') && (
              <>
                <Clock className="mx-auto text-amber-500" size={44} />
                <h1 className="text-xl font-semibold">Setting up your workspace...</h1>
                <p className="text-sm text-slate-600">
                  We received your payment and are provisioning your hospital right now. This
                  usually finishes in a few seconds.
                </p>
                <Spinner size={20} />
                <p className="font-mono text-xs text-slate-400">
                  signupId: {signupId.slice(0, 8)}...
                </p>
              </>
            )}

            {status.data && s === 'PROVISIONED' && (
              <>
                <CheckCircle2 className="mx-auto text-green-600" size={44} />
                <h1 className="text-xl font-semibold">You are all set!</h1>
                <p className="text-sm text-slate-600">
                  <strong>{status.data.hospitalName}</strong> is ready. Sign in with the
                  email and password you just created.
                </p>
                <Link to="/login">
                  <Button className="w-full">Go to login</Button>
                </Link>
              </>
            )}

            {status.data && s === 'FAILED' && (
              <>
                <XCircle className="mx-auto text-red-500" size={44} />
                <h1 className="text-xl font-semibold">Payment failed</h1>
                <Alert tone="error">
                  We could not confirm your payment. No workspace was created.
                </Alert>
                <Link to="/pricing"><Button>Try again</Button></Link>
              </>
            )}

            {status.data && s === 'EXPIRED' && (
              <>
                <Clock className="mx-auto text-slate-400" size={44} />
                <h1 className="text-xl font-semibold">Signup expired</h1>
                <p className="text-sm text-slate-600">
                  This signup was not completed within 24 hours.
                </p>
                <Link to="/pricing"><Button>Start over</Button></Link>
              </>
            )}
          </CardBody>
        </Card>

        <p className="mt-4 text-center text-xs text-slate-400">
          Having trouble? Refresh this page or contact support.
        </p>
      </div>
    </div>
  );
}

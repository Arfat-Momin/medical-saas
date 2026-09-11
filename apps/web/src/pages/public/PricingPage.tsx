import { Link } from 'react-router-dom';
import { Activity, Check } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { Alert } from '@/components/ui/Alert';
import { Spinner } from '@/components/ui/Spinner';
import { usePublicPlans } from '@/hooks/useSubscriptions';

export function PricingPage() {
  const plans = usePublicPlans();

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white">
              <Activity size={18} />
            </div>
            <span className="font-semibold text-slate-900">Medical SaaS</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link to="/login" className="text-sm font-medium text-slate-600 hover:text-slate-900">
              Sign in
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-12">
        <div className="mb-10 text-center">
          <h1 className="text-3xl font-semibold text-slate-900">Simple, transparent pricing</h1>
          <p className="mt-2 text-slate-600">
            Choose a plan that fits your clinic or hospital. Cancel anytime.
          </p>
        </div>

        {plans.isLoading && (
          <div className="flex justify-center py-12"><Spinner size={32} /></div>
        )}

        {plans.isError && (
          <Alert tone="error">Failed to load pricing. Please try again later.</Alert>
        )}

        {plans.data && plans.data.length === 0 && (
          <Alert tone="info">No plans available yet. Please check back soon.</Alert>
        )}

        {plans.data && plans.data.length > 0 && (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {plans.data.map((p) => {
              const isPro = p.code === 'PRO';
              return (
                <Card
                  key={p.id}
                  className={isPro ? 'ring-2 ring-brand-500' : ''}
                >
                  <CardBody className="flex flex-col">
                    {isPro && (
                      <span className="mb-2 inline-block w-fit rounded-full bg-brand-100 px-2 py-0.5 text-xs font-semibold text-brand-700">
                        Most popular
                      </span>
                    )}
                    <h3 className="text-lg font-semibold text-slate-900">{p.name}</h3>
                    <p className="mt-1 font-mono text-xs text-slate-500">{p.code}</p>

                    <div className="mt-4">
                      <span className="text-3xl font-semibold text-slate-900">
                        Rs.{(p.price_paise / 100).toFixed(0)}
                      </span>
                      <span className="text-sm text-slate-500">
                        {' '}/ {p.billing_cycle === 'MONTHLY' ? 'month' : 'year'}
                      </span>
                    </div>

                    <ul className="mt-6 space-y-2 text-sm text-slate-600">
                      <Feature text={`Up to ${p.max_branches} branch${p.max_branches === 1 ? '' : 'es'}`} />
                      <Feature text={`Up to ${p.max_users} staff users`} />
                      <Feature text="OPD, IPD, Pharmacy, Lab" />
                      <Feature text="Offline-first mobile + web" />
                      <Feature text="Full audit trail" />
                    </ul>

                    <Link to={`/signup?plan=${p.code}`} className="mt-6">
                      <Button className="w-full" variant={isPro ? 'primary' : 'secondary'}>
                        Get started
                      </Button>
                    </Link>
                  </CardBody>
                </Card>
              );
            })}
          </div>
        )}

        <p className="mt-10 text-center text-sm text-slate-500">
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-brand-600 hover:underline">
            Sign in
          </Link>
        </p>
      </main>
    </div>
  );
}

function Feature({ text }: { text: string }) {
  return (
    <li className="flex items-start gap-2">
      <Check size={16} className="mt-0.5 shrink-0 text-green-600" />
      <span>{text}</span>
    </li>
  );
}

import { Link } from 'react-router-dom';
import { Activity, Check, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { Spinner } from '@/components/ui/Spinner';
import { usePublicPlans } from '@/hooks/useSubscriptions';

export function PricingPage() {
  const plans = usePublicPlans();

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3.5 md:px-6">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white">
              <Activity size={16} />
            </div>
            <span className="font-semibold text-slate-900">MedSaaS</span>
          </Link>
          <Link to="/login" className="text-sm font-medium text-slate-600 hover:text-slate-900">
            Sign in
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-12 md:px-6 md:py-16">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-100 bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700">
            <Sparkles size={12} />
            Simple, transparent pricing
          </span>
          <h1 className="mt-5 text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl">
            Pick a plan that fits your practice
          </h1>
          <p className="mt-3 text-base text-slate-600">
            Full EMR, pharmacy, laboratory, and billing. Cancel anytime.
          </p>
        </div>

        {plans.isLoading && <div className="flex justify-center py-16"><Spinner size={32} /></div>}
        {plans.isError && <Alert tone="error">Failed to load pricing. Please try again.</Alert>}
        {plans.data && plans.data.length === 0 && <Alert tone="info">No plans available yet.</Alert>}

        {plans.data && plans.data.length > 0 && (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {plans.data.map((p) => {
              const isFeatured = p.code === 'PRO' || p.code === 'GROWTH';
              return (
                <div
                  key={p.id}
                  className={`relative flex flex-col rounded-xl border bg-white shadow-card transition-shadow hover:shadow-pop ${
                    isFeatured ? 'border-brand-500 ring-2 ring-brand-500/10' : 'border-slate-200'
                  }`}
                >
                  {isFeatured && (
                    <span className="absolute -top-2.5 left-6 inline-flex items-center rounded-full bg-brand-600 px-2.5 py-0.5 text-2xs font-semibold uppercase tracking-wider text-white shadow-sm">
                      Most popular
                    </span>
                  )}

                  <div className="p-6">
                    <h3 className="text-lg font-semibold text-slate-900">{p.name}</h3>
                    <p className="mt-0.5 font-mono text-2xs uppercase tracking-wider text-slate-400">
                      {p.code}
                    </p>

                    <div className="mt-5 flex items-baseline gap-1.5">
                      <span className="text-4xl font-semibold tabular-nums text-slate-900">
                        ₹{(p.price_paise / 100).toFixed(0)}
                      </span>
                      <span className="text-sm text-slate-500">
                        /{p.billing_cycle === 'MONTHLY' ? 'month' : 'year'}
                      </span>
                    </div>

                    <ul className="mt-6 space-y-3 text-sm text-slate-700">
                      <li className="flex items-start gap-2.5">
                        <Check size={16} className="mt-0.5 shrink-0 text-accent-600" />
                        <span>Up to <strong className="font-semibold">{p.max_branches}</strong> branch{p.max_branches === 1 ? '' : 'es'}</span>
                      </li>
                      <li className="flex items-start gap-2.5">
                        <Check size={16} className="mt-0.5 shrink-0 text-accent-600" />
                        <span>Up to <strong className="font-semibold">{p.max_users}</strong> staff users</span>
                      </li>
                      <li className="flex items-start gap-2.5">
                        <Check size={16} className="mt-0.5 shrink-0 text-accent-600" />
                        <span>OPD, IPD, Pharmacy & Laboratory</span>
                      </li>
                      <li className="flex items-start gap-2.5">
                        <Check size={16} className="mt-0.5 shrink-0 text-accent-600" />
                        <span>Offline-first mobile + web</span>
                      </li>
                      <li className="flex items-start gap-2.5">
                        <Check size={16} className="mt-0.5 shrink-0 text-accent-600" />
                        <span>Full audit trail</span>
                      </li>
                    </ul>

                    <Link to={`/signup?plan=${p.code}`} className="mt-7 block">
                      <Button className="w-full" size="lg" variant={isFeatured ? 'primary' : 'secondary'}>
                        Get started
                      </Button>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <p className="mt-12 text-center text-sm text-slate-500">
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-brand-600 hover:text-brand-700">
            Sign in
          </Link>
        </p>
      </main>
    </div>
  );
}
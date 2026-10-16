import { Link } from 'react-router-dom';
import { Activity, Check, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { Spinner } from '@/components/ui/Spinner';
import { usePublicPlans } from '@/hooks/useSubscriptions';

function Brand({ compact }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className={`flex items-center justify-center rounded-xl bg-teal-700 text-white shadow-md ${compact ? 'h-9 w-9' : 'h-10 w-10'}`}>
        <Activity size={compact ? 18 : 22} strokeWidth={2.5} />
      </div>
      <span className={`font-bold tracking-tight text-slate-900 ${compact ? 'text-lg' : 'text-xl'}`}>
        Med SaaS
      </span>
    </div>
  );
}

export function PricingPage() {
  const plans = usePublicPlans();

  return (
    <div className="min-h-screen bg-[#F3F0EA] font-sans text-slate-900 selection:bg-teal-200">
      
      {/* ── Header ── */}
      <header className="sticky top-0 z-10 border-b border-stone-200/60 bg-[#F3F0EA]/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4 md:px-10">
          <Link to="/">
            <Brand compact />
          </Link>
          <div className="flex items-center gap-4">
            <Link to="/login" className="text-sm font-semibold text-teal-800 transition hover:text-teal-950">
              Sign in
            </Link>
            <Link to="/signup">
              <button className="rounded-lg bg-teal-800 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-900">
                Get started
              </button>
            </Link>
          </div>
        </div>
      </header>

      {/* ── Main Content ── */}
      <main className="mx-auto max-w-6xl px-6 py-16 md:px-10 md:py-24">
        
        {/* Hero Section */}
        <div className="mx-auto mb-16 max-w-2xl text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-teal-800">
            <Sparkles size={12} className="text-teal-600" />
            Simple, transparent pricing
          </span>
          <h1 className="mt-8 font-serif text-[2.5rem] leading-[1.05] tracking-[-0.03em] text-slate-950 md:text-[3.25rem]">
            Pick a plan that fits your practice
          </h1>
          <p className="mt-5 text-[17px] leading-relaxed text-slate-600">
            Full EMR, pharmacy, laboratory, and billing. Cancel anytime.
          </p>
        </div>

        {/* State Management */}
        {plans.isLoading && <div className="flex justify-center py-16"><Spinner size={36} className="text-teal-700" /></div>}
        {plans.isError && <Alert tone="error">Failed to load pricing. Please try again.</Alert>}
        {plans.data && plans.data.length === 0 && <Alert tone="info">No plans available yet.</Alert>}

        {/* Pricing Cards */}
        {plans.data && plans.data.length > 0 && (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {plans.data.map((p) => {
              const isFeatured = p.code === 'PRO' || p.code === 'GROWTH';
              return (
                <div
                  key={p.id}
                  className={`relative flex flex-col rounded-2xl border bg-white p-8 shadow-sm transition-all hover:shadow-[0_12px_24px_rgba(13,116,110,0.08)] ${
                    isFeatured ? 'border-teal-400 ring-1 ring-teal-400/50' : 'border-stone-200'
                  }`}
                >
                  {isFeatured && (
                    <span className="absolute -top-3 left-8 inline-flex items-center rounded-full bg-teal-700 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white shadow-sm">
                      Most popular
                    </span>
                  )}

                  <h3 className="font-serif text-2xl font-semibold text-slate-900">{p.name}</h3>
                  <p className="mt-1 text-xs font-semibold uppercase tracking-[0.15em] text-slate-400">
                    {p.code}
                  </p>

                  <div className="mt-6 flex items-baseline gap-1.5">
                    <span className="font-serif text-5xl font-semibold tracking-tight text-slate-950">
                      ₹{(p.price_paise / 100).toFixed(0)}
                    </span>
                    <span className="text-[15px] text-slate-500">
                      /{p.billing_cycle === 'MONTHLY' ? 'month' : 'year'}
                    </span>
                  </div>

                  <ul className="mt-8 space-y-4 text-[15px] text-slate-700">
                    <li className="flex items-start gap-3">
                      <Check size={18} className="mt-0.5 shrink-0 text-teal-600" />
                      <span>Up to <strong className="font-semibold text-slate-900">{p.max_branches}</strong> branch{p.max_branches === 1 ? '' : 'es'}</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <Check size={18} className="mt-0.5 shrink-0 text-teal-600" />
                      <span>Up to <strong className="font-semibold text-slate-900">{p.max_users}</strong> staff users</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <Check size={18} className="mt-0.5 shrink-0 text-teal-600" />
                      <span>OPD, IPD, Pharmacy & Laboratory</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <Check size={18} className="mt-0.5 shrink-0 text-teal-600" />
                      <span>Offline-first mobile + web app</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <Check size={18} className="mt-0.5 shrink-0 text-teal-600" />
                      <span>Role-based access & audit trail</span>
                    </li>
                  </ul>

                  <Link to={`/signup?plan=${p.code}`} className="mt-10 mt-auto block">
                    <button
                      className={`w-full rounded-xl px-4 py-3.5 text-[15px] font-semibold transition-all ${
                        isFeatured
                          ? 'bg-gradient-to-b from-teal-600 to-teal-800 text-white shadow-[0_8px_16px_rgba(13,116,110,0.2)] hover:from-teal-500 hover:to-teal-700'
                          : 'border border-stone-300 bg-white text-slate-800 hover:border-stone-400 hover:bg-stone-50'
                      }`}
                    >
                      Choose {p.name}
                    </button>
                  </Link>
                </div>
              );
            })}
          </div>
        )}

      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-stone-200/60 pb-12 pt-16">
        <div className="mx-auto max-w-6xl px-6 md:px-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <Brand compact />
          <p className="text-center text-[12px] leading-relaxed text-slate-500 md:text-right">
            HIPAA · SOC 2 Type II · HITRUST · AES-256 at rest · TLS 1.3 in transit
            <span className="mt-1 block">© 2026 Med SaaS. All rights reserved.</span>
          </p>
        </div>
      </footer>
    </div>
  );
}
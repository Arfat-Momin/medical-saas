import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type StatTone = 'brand' | 'accent' | 'alert' | 'danger' | 'neutral';

const tones: Record<StatTone, { bg: string; fg: string; ring: string }> = {
  brand:   { bg: 'bg-brand-50',  fg: 'text-brand-600',  ring: 'ring-brand-100' },
  accent:  { bg: 'bg-accent-50', fg: 'text-accent-700', ring: 'ring-accent-100' },
  alert:   { bg: 'bg-alert-50',  fg: 'text-alert-700',  ring: 'ring-alert-100' },
  danger:  { bg: 'bg-red-50',    fg: 'text-red-600',    ring: 'ring-red-100' },
  neutral: { bg: 'bg-slate-100', fg: 'text-slate-600',  ring: 'ring-slate-100' },
};

export function StatTile({
  icon, label, value, hint, tone = 'neutral', action,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: StatTone;
  action?: ReactNode;
}) {
  const t = tones[tone];
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-card md:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', t.bg, t.fg)}>
          {icon}
        </div>
        {action}
      </div>
      <p className="mt-3 text-2xs font-medium uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-0.5 text-2xl font-semibold tabular-nums text-slate-900">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}
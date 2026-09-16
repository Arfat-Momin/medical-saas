import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type BadgeTone = 'gray' | 'green' | 'red' | 'yellow' | 'blue' | 'purple' | 'brand';

const tones: Record<BadgeTone, string> = {
  gray:   'bg-slate-100 text-slate-700 border-slate-200',
  green:  'bg-accent-50 text-accent-700 border-accent-100',
  red:    'bg-red-50 text-red-700 border-red-100',
  yellow: 'bg-alert-50 text-alert-700 border-alert-100',
  blue:   'bg-blue-50 text-blue-700 border-blue-100',
  purple: 'bg-purple-50 text-purple-700 border-purple-100',
  brand:  'bg-brand-50 text-brand-700 border-brand-100',
};

export function Badge({
  children, tone = 'gray', className, dot,
}: { children: ReactNode; tone?: BadgeTone; className?: string; dot?: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-2xs font-medium',
        tones[tone], className,
      )}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />}
      {children}
    </span>
  );
}
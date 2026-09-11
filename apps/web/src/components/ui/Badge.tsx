import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type BadgeTone = 'gray' | 'green' | 'red' | 'yellow' | 'blue' | 'purple';

const tones: Record<BadgeTone, string> = {
  gray:   'bg-slate-100 text-slate-700',
  green:  'bg-green-100 text-green-700',
  red:    'bg-red-100 text-red-700',
  yellow: 'bg-amber-100 text-amber-800',
  blue:   'bg-blue-100 text-blue-700',
  purple: 'bg-purple-100 text-purple-700',
};

export function Badge({
  children, tone = 'gray', className,
}: { children: ReactNode; tone?: BadgeTone; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
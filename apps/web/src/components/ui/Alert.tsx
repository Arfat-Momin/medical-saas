import type { ReactNode } from 'react';
import { AlertCircle, CheckCircle2, Info, TriangleAlert } from 'lucide-react';
import { cn } from '@/lib/cn';

export type AlertTone = 'error' | 'success' | 'info' | 'warning';

const styles: Record<AlertTone, { wrap: string; Icon: any }> = {
  error:   { wrap: 'bg-red-50 border-red-100 text-red-800',       Icon: AlertCircle },
  success: { wrap: 'bg-accent-50 border-accent-100 text-accent-800', Icon: CheckCircle2 },
  info:    { wrap: 'bg-brand-50 border-brand-100 text-brand-800',   Icon: Info },
  warning: { wrap: 'bg-alert-50 border-alert-100 text-alert-800',   Icon: TriangleAlert },
};

export function Alert({ tone = 'info', children, className }: { tone?: AlertTone; children: ReactNode; className?: string }) {
  const { wrap, Icon } = styles[tone];
  return (
    <div className={cn('flex items-start gap-2.5 rounded-md border px-3.5 py-2.5 text-sm', wrap, className)}>
      <Icon size={16} className="mt-0.5 shrink-0" />
      <div className="flex-1 leading-relaxed">{children}</div>
    </div>
  );
}
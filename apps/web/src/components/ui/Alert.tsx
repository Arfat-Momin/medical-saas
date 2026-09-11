import type { ReactNode } from 'react';
import { AlertCircle, CheckCircle2, Info } from 'lucide-react';
import { cn } from '@/lib/cn';

export type AlertTone = 'error' | 'success' | 'info';

const styles: Record<AlertTone, { bg: string; text: string; Icon: any }> = {
  error:   { bg: 'bg-red-50 border-red-200',       text: 'text-red-800',     Icon: AlertCircle },
  success: { bg: 'bg-green-50 border-green-200',   text: 'text-green-800',   Icon: CheckCircle2 },
  info:    { bg: 'bg-blue-50 border-blue-200',     text: 'text-blue-800',    Icon: Info },
};

export function Alert({ tone = 'info', children }: { tone?: AlertTone; children: ReactNode }) {
  const { bg, text, Icon } = styles[tone];
  return (
    <div className={cn('flex items-start gap-2 rounded-md border px-3 py-2 text-sm', bg, text)}>
      <Icon size={16} className="mt-0.5 shrink-0" />
      <div className="flex-1">{children}</div>
    </div>
  );
}
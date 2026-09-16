import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export function EmptyState({
  icon, title, description, action, className,
}: { icon?: ReactNode; title: string; description?: string; action?: ReactNode; className?: string }) {
  return (
    <div className={cn(
      'flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-slate-200 bg-white px-6 py-14 text-center',
      className,
    )}>
      {icon && (
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-50 text-slate-400">
          {icon}
        </div>
      )}
      <h3 className="text-md font-semibold text-slate-900">{title}</h3>
      {description && <p className="max-w-sm text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
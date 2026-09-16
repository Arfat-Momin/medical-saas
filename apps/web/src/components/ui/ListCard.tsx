import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * Mobile replacement for table rows. On xs the entire app uses this
 * instead of <table>. Tap target is the whole card; actions live in a
 * dedicated footer row and stop propagation.
 */
export function ListCard({
  onClick, children, actions, className,
}: { onClick?: () => void; children: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'rounded-lg border border-slate-200 bg-white shadow-card transition-colors',
        onClick && 'cursor-pointer hover:border-slate-300 active:bg-slate-50',
        className,
      )}
      onClick={onClick}
    >
      <div className="p-4">{children}</div>
      {actions && (
        <div
          className="flex flex-wrap gap-2 border-t border-slate-100 px-4 py-3"
          onClick={(e) => e.stopPropagation()}
        >
          {actions}
        </div>
      )}
    </div>
  );
}
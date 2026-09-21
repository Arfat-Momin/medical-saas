import { X } from 'lucide-react';
import { cn } from '@/lib/cn';

export function Chip({
  children, onRemove, className,
}: { children: React.ReactNode; onRemove?: () => void; className?: string }) {
  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700',
      className,
    )}>
      {children}
      {onRemove && (
        <button type="button" onClick={onRemove} className="rounded-full p-1.5 sm:p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Remove">
          <X size={11} />
        </button>
      )}
    </span>
  );
}
import { cn } from '@/lib/cn';

export function Spinner({ className, size = 20 }: { className?: string; size?: number }) {
  return (
    <span
      className={cn('inline-block animate-spin rounded-full border-2 border-brand-500 border-t-transparent', className)}
      style={{ width: size, height: size }}
    />
  );
}

export function FullPageSpinner({ label = 'Loading...' }: { label?: string }) {
  return (
    <div className="full-page-h flex flex-col items-center justify-center gap-4 bg-slate-50 text-slate-500">
      <Spinner size={32} />
      <p className="text-sm">{label}</p>
    </div>
  );
}
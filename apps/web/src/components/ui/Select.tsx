import { forwardRef, type SelectHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, label, error, hint, id, children, ...rest },
  ref,
) {
  const selectId = id ?? rest.name;
  return (
    <div className="w-full">
      {label && (
        <label htmlFor={selectId} className="mb-1 block text-sm font-medium text-slate-700">
          {label}
        </label>
      )}
      <select
        ref={ref}
        id={selectId}
        className={cn(
          'block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm',
          'focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500',
          'disabled:bg-slate-50 disabled:text-slate-500',
          error && 'border-red-500 focus:border-red-500 focus:ring-red-500',
          className,
        )}
        {...rest}
      >
        {children}
      </select>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      {hint && !error && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
});
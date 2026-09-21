import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: ReactNode;
  rightSlot?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, label, error, hint, id, leftIcon, rightSlot, ...rest },
  ref,
) {
  const inputId = id ?? rest.name;
  return (
    <div className="w-full">
      {label && (
        <label htmlFor={inputId} className="mb-1.5 block text-xs font-medium text-slate-600">
          {label}
        </label>
      )}
      <div className="relative">
        {leftIcon && (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
            {leftIcon}
          </span>
        )}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            'block h-11 sm:h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-base text-slate-900',
            'placeholder:text-slate-400',
            'transition-colors',
            'focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/10',
            'disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed',
            'read-only:bg-slate-50 read-only:text-slate-500',
            leftIcon && 'pl-9',
            rightSlot && 'pr-10',
            error && 'border-red-400 focus:border-red-500 focus:ring-red-500/10',
            className,
          )}
          {...rest}
        />
        {rightSlot && (
          <span className="absolute right-2 top-1/2 -translate-y-1/2">{rightSlot}</span>
        )}
      </div>
      {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}
      {hint && !error && <p className="mt-1.5 text-xs text-slate-500">{hint}</p>}
    </div>
  );
});
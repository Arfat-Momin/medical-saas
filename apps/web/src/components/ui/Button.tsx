import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

const variants = {
  primary:   'bg-brand-600 text-white shadow-sm hover:bg-brand-700 active:bg-brand-800',
  secondary: 'bg-white text-slate-800 border border-slate-200 shadow-sm hover:bg-slate-50 active:bg-slate-100',
  ghost:     'text-slate-600 hover:bg-slate-100 active:bg-slate-200',
  danger:    'bg-red-600 text-white shadow-sm hover:bg-red-700 active:bg-red-800',
};
const sizes = {
  sm: 'h-11 sm:h-9 px-3 text-sm gap-1.5 rounded-md',
  md: 'h-11 sm:h-10 px-4 text-base gap-2 rounded-md',
  lg: 'h-12 sm:h-11 px-5 text-md gap-2 rounded-lg',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = 'primary', size = 'md', loading, disabled, leftIcon, rightIcon, children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30',
        'disabled:opacity-50 disabled:cursor-not-allowed select-none',
        variants[variant], sizes[size], className,
      )}
      {...rest}
    >
      {loading ? (
        <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : leftIcon}
      {children}
      {rightIcon}
    </button>
  );
});
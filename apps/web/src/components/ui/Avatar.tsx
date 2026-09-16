import { cn } from '@/lib/cn';

export function Avatar({
  name, size = 36, tone = 'brand', className,
}: { name?: string | null; size?: number; tone?: 'brand' | 'slate'; className?: string }) {
  const initials = (name ?? '?')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join('');
  const toneMap = tone === 'brand'
    ? 'bg-brand-50 text-brand-700'
    : 'bg-slate-100 text-slate-600';
  return (
    <span
      className={cn('inline-flex shrink-0 items-center justify-center rounded-full font-semibold', toneMap, className)}
      style={{ width: size, height: size, fontSize: Math.max(11, size * 0.38) }}
    >
      {initials || '?'}
    </span>
  );
}
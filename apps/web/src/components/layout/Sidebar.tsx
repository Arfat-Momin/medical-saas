import { NavLink } from 'react-router-dom';
import { Activity } from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { getNavFor } from './nav-items';
import { cn } from '@/lib/cn';

export function Sidebar() {
  const isPlatformAdmin = useAuthStore((s) => s.user?.isPlatformAdmin ?? false);
  const tenantId = useAuthStore((s) => s.tenantId);
  const groups = getNavFor(isPlatformAdmin);

  return (
    <aside className="ios-enter hidden w-[248px] shrink-0 flex-col gap-3 p-3 md:flex">
      {/* Brand card */}
      <div className="glass-strong flex h-[60px] shrink-0 items-center gap-3 rounded-2xl px-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-600 to-brand-800 text-white shadow-glass">
          <Activity size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-bold tracking-tight text-ink-900">MedSaaS</span>
          {isPlatformAdmin ? (
            <span className="mt-0.5 inline-flex items-center rounded-full bg-violet-100/80 px-1.5 py-0.5 text-2xs font-semibold uppercase tracking-wider text-violet-700">
              Platform
            </span>
          ) : (
            <span className="mt-0.5 block text-[10px] font-semibold uppercase tracking-wider text-ink-400">
              Hospital Suite
            </span>
          )}
        </div>
      </div>

      {/* Nav */}
      <nav className="glass-strong flex-1 space-y-5 overflow-y-auto rounded-2xl p-3 text-[13px]">
        {groups.map((group, gi) => (
          <div key={gi}>
            {group.title && (
              <p className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-ink-400">
                {group.title}
              </p>
            )}
            <div className="space-y-0.5">
              {group.items.map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to === '/dashboard'}
                  className={({ isActive }) =>
                    cn(
                      'glass-tap flex items-center gap-3 rounded-xl px-3 py-2.5 font-medium transition-colors',
                      isActive
                        ? 'bg-gradient-to-r from-brand-500/12 to-brand-600/8 font-semibold text-brand-700 ring-1 ring-inset ring-brand-500/15'
                        : 'text-ink-700 hover:bg-white/60 hover:text-ink-900',
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <Icon size={16} className={cn('shrink-0', isActive ? 'text-brand-600' : 'text-ink-400')} />
                      <span className="truncate">{label}</span>
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="shrink-0 px-2">
        <p className="text-2xs text-ink-400">v0.1.0</p>
        {tenantId && <p className="mt-0.5 font-mono text-2xs text-ink-400">{tenantId.slice(0, 8)}</p>}
      </div>
    </aside>
  );
}
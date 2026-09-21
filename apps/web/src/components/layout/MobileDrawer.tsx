import { useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { X, LogOut, Activity } from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { getNavFor } from './nav-items';
import { cn } from '@/lib/cn';
import { Avatar } from '@/components/ui/Avatar';
import { authRepository } from '@/repositories/auth.repository';
import { clearLocalSession } from '@/lib/session';

interface Props { open: boolean; onClose: () => void; }

export function MobileDrawer({ open, onClose }: Props) {
  const isPlatformAdmin = useAuthStore((s) => s.user?.isPlatformAdmin ?? false);
  const user = useAuthStore((s) => s.user);
  const groups = getNavFor(isPlatformAdmin);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  async function handleLogout() {
    try { await authRepository.logout(); } catch { /* ignore */ }
    await clearLocalSession();
    window.location.href = '/login';
  }

  return (
    <>
      <div
        onClick={onClose}
        className={cn(
          'fixed inset-0 z-40 bg-ink-900/60 transition-opacity duration-200 md:hidden',
          open ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        aria-hidden="true"
      />
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-[280px] max-w-[85vw] flex-col gap-3 bg-white p-3 transition-transform duration-300 ease-spring md:hidden safe-t safe-b',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="glass-strong flex h-[60px] shrink-0 items-center justify-between rounded-2xl px-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-600 to-brand-800 text-white shadow-glass">
              <Activity size={16} />
            </div>
            <span className="font-bold tracking-tight text-ink-900">MedSaaS</span>
          </div>
          <button onClick={onClose} className="glass-tap rounded-xl p-2.5 text-ink-500 hover:bg-white/60" aria-label="Close menu">
            <X size={18} />
          </button>
        </div>

        {user && (
          <div className="glass-strong shrink-0 rounded-2xl p-3.5">
            <div className="flex items-center gap-3">
              <Avatar name={user.fullName ?? user.email} size={36} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ink-900">{user.fullName ?? user.email}</p>
                <p className="truncate text-2xs text-ink-500">{user.email}</p>
              </div>
            </div>
            {isPlatformAdmin && (
              <span className="mt-2 inline-flex items-center rounded-full bg-violet-100/80 px-2 py-0.5 text-2xs font-semibold uppercase tracking-wider text-violet-700">
                Platform Admin
              </span>
            )}
          </div>
        )}

        <nav className="glass-strong flex-1 space-y-5 overflow-y-auto rounded-2xl p-3 pb-4 text-[13px]">
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
                    onClick={onClose}
                    className={({ isActive }) =>
                      cn(
                        'glass-tap flex items-center gap-3 rounded-xl px-3 py-2.5 font-medium transition-colors',
                        isActive
                          ? 'bg-gradient-to-r from-brand-500/12 to-brand-600/8 font-semibold text-brand-700 ring-1 ring-inset ring-brand-500/15'
                          : 'text-ink-700 hover:bg-white/60 active:bg-white/80',
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <Icon size={18} className={cn(isActive ? 'text-brand-600' : 'text-ink-400')} />
                        {label}
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="glass-strong shrink-0 rounded-2xl p-2">
          <button
            onClick={handleLogout}
            className="glass-tap flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50/70"
          >
            <LogOut size={16} />
            Sign out
          </button>
        </div>
      </aside>
    </>
  );
}
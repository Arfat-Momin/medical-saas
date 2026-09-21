import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/cn';
import { mobileTabs } from './nav-items';
import { useAuthStore } from '@/stores/auth.store';

export function BottomTabBar() {
  const isPlatformAdmin = useAuthStore((s) => s.user?.isPlatformAdmin ?? false);
  if (isPlatformAdmin) return null;

  return (
    <nav
      className="glass-strong mobile-tabbar fixed inset-x-3 z-30 flex rounded-2xl md:hidden"
      aria-label="Primary"
    >
      {mobileTabs.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            cn(
              'glass-tap flex flex-1 flex-col items-center justify-center gap-0.5 py-3 text-2xs font-medium transition-colors',
              isActive ? 'text-brand-700' : 'text-ink-500',
            )
          }
        >
          {({ isActive }) => (
            <>
              <Icon size={20} strokeWidth={isActive ? 2.25 : 1.75} />
              <span>{label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
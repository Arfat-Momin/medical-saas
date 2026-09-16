import { LogOut, Menu } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth.store';
import { authRepository } from '@/repositories/auth.repository';
import { Button } from '@/components/ui/Button';

interface Props {
  onOpenMenu?: () => void;
}

export function Topbar({ onOpenMenu }: Props) {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();

  async function handleLogout() {
    try { await authRepository.logout(); } catch { /* ignore */ }
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <header className="flex h-14 items-center justify-between border-b border-slate-200 bg-white px-3 md:px-5">
      {/* Left - hamburger on mobile */}
      <div className="flex items-center gap-2">
        <button
          onClick={onOpenMenu}
          className="rounded-md p-2 text-slate-600 hover:bg-slate-100 md:hidden"
          aria-label="Open menu"
        >
          <Menu size={20} />
        </button>

        <span className="hidden text-sm text-slate-500 md:inline">
          {user?.isPlatformAdmin ? (
            <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">
              Platform Admin
            </span>
          ) : (
            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
              Hospital User
            </span>
          )}
        </span>
      </div>

      {/* Right - user info + logout */}
      <div className="flex items-center gap-2 md:gap-4">
        <div className="text-right">
          <p className="max-w-[140px] truncate text-sm font-medium text-slate-900 md:max-w-none">
            {user?.fullName ?? user?.email}
          </p>
          <p className="hidden text-xs text-slate-500 md:block">{user?.email}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={handleLogout} title="Logout">
          <LogOut size={16} />
        </Button>
      </div>
    </header>
  );
}

import { LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth.store';
import { authRepository } from '@/repositories/auth.repository';
import { Button } from '@/components/ui/Button';

export function Topbar() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();

  async function handleLogout() {
    try { await authRepository.logout(); } catch { /* ignore */ }
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <header className="flex h-14 items-center justify-between border-b border-slate-200 bg-white px-5">
      <div className="text-sm text-slate-500">
        {user?.isPlatformAdmin ? (
          <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">
            Platform Admin
          </span>
        ) : (
          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
            Hospital User
          </span>
        )}
      </div>

      <div className="flex items-center gap-4">
        <div className="text-right">
          <p className="text-sm font-medium text-slate-900">{user?.fullName ?? user?.email}</p>
          <p className="text-xs text-slate-500">{user?.email}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={handleLogout} title="Logout">
          <LogOut size={16} />
        </Button>
      </div>
    </header>
  );
}
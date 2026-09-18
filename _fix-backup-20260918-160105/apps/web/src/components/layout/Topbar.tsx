import { useState } from 'react';
import { LogOut, Menu, UserCog, Wifi, WifiOff } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth.store';
import { authRepository } from '@/repositories/auth.repository';
import { clearLocalSession } from '@/lib/session';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Alert } from '@/components/ui/Alert';
import { Avatar } from '@/components/ui/Avatar';
import { syncQueue } from '@/sync/queue';

interface Props { onOpenMenu?: () => void; }

export function Topbar({ onOpenMenu }: Props) {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const [showPendingModal, setShowPendingModal] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [online] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

  async function handleLogout() {
    const count = await syncQueue.countPending();
    if (count > 0) { setPendingCount(count); setShowPendingModal(true); return; }
    await forceLogout();
  }
  async function forceLogout() {
    try { await authRepository.logout(); } catch { /* ignore */ }
    await clearLocalSession();
    navigate('/login', { replace: true });
  }

  return (
    <>
      <header className="glass-strong ios-enter d-1 flex h-[60px] shrink-0 items-center justify-between gap-3 rounded-2xl px-3 md:px-4">
        <div className="flex min-w-0 items-center gap-2">
          <button
            onClick={onOpenMenu}
            className="glass-tap rounded-xl p-2 text-ink-600 hover:bg-white/60 md:hidden"
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>
          <div className="hidden items-center gap-2 md:flex">
            {user?.isPlatformAdmin ? (
              <span className="inline-flex items-center rounded-full bg-violet-100/80 px-2.5 py-1 text-2xs font-semibold uppercase tracking-wider text-violet-700">
                Platform Admin
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50/80 px-2.5 py-1 text-2xs font-semibold text-brand-700">
                <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
                Hospital User
              </span>
            )}
            {online ? (
              <span className="inline-flex items-center gap-1 text-2xs text-ink-400">
                <Wifi size={10} />
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-alert-50/80 px-2 py-0.5 text-2xs font-medium text-alert-700">
                <WifiOff size={10} /> Offline
              </span>
            )}
          </div>
        </div>

        <div className="flex min-w-0 items-center gap-2 md:gap-3">
          <Link
            to="/settings/sessions"
            title="Active sessions"
            className="glass-tap hidden rounded-xl p-2 text-ink-500 hover:bg-white/60 hover:text-ink-700 md:inline-flex"
          >
            <UserCog size={16} />
          </Link>

          <div className="flex min-w-0 items-center gap-2">
            <div className="hidden text-right md:block">
              <p className="max-w-[180px] truncate text-sm font-semibold text-ink-900">
                {user?.fullName ?? user?.email}
              </p>
              <p className="max-w-[180px] truncate text-2xs text-ink-500">{user?.email}</p>
            </div>
            <Avatar name={user?.fullName ?? user?.email} size={32} />
          </div>

          <Button variant="ghost" size="sm" onClick={handleLogout} title="Sign out" aria-label="Sign out">
            <LogOut size={16} />
          </Button>
        </div>
      </header>

      <Modal
        open={showPendingModal}
        onClose={() => setShowPendingModal(false)}
        title="Unsynced changes detected"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowPendingModal(false)}>Cancel</Button>
            <Button variant="danger" onClick={forceLogout}>Sign out anyway</Button>
          </>
        }
      >
        <Alert tone="error">
          <p className="font-semibold">You have {pendingCount} unsynced change{pendingCount === 1 ? '' : 's'}.</p>
          <p className="mt-1 text-xs opacity-90">
            If you sign out now, these changes will be lost. Connect to the internet
            and wait for the sync to complete first.
          </p>
        </Alert>
      </Modal>
    </>
  );
}
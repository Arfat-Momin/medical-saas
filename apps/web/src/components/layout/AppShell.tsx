import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { MobileDrawer } from './MobileDrawer';
import { BottomTabBar } from './BottomTabBar';
import { useMeSync } from '@/hooks/useAuth';
import { FullPageSpinner } from '@/components/ui/Spinner';
import { SubscriptionGate } from '@/components/subscription/SubscriptionGate';

export function AppShell() {
  const { isLoading, isError } = useMeSync();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  if (isLoading) return <FullPageSpinner label="Loading your session..." />;

  if (isError) {
    return (
      <div className="full-page-h flex items-center justify-center p-6 text-center text-sm text-red-600">
        Failed to load your session. Try signing out and in again.
      </div>
    );
  }

  return (
    <>
      <div
        className="hidden md:block"
        aria-hidden="true"
        style={{
          position: 'fixed',
          inset: 0,
          overflow: 'hidden',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      >
        <div
          className="ambient-float"
          style={{
            position: 'absolute',
            top: '-220px',
            left: '-220px',
            width: 480,
            height: 480,
            borderRadius: '50%',
            filter: 'blur(100px)',
            opacity: 0.38,
            background: 'radial-gradient(circle, rgba(31,148,116,0.75), transparent 70%)',
          }}
        />
        <div
          className="ambient-float"
          style={{
            position: 'absolute',
            bottom: '-260px',
            right: '-180px',
            width: 560,
            height: 560,
            borderRadius: '50%',
            filter: 'blur(110px)',
            opacity: 0.32,
            background: 'radial-gradient(circle, rgba(16,185,129,0.65), transparent 70%)',
            animationDelay: '-9s',
          }}
        />
      </div>

      <div
        className="app-shell-h relative z-10 flex overflow-hidden"
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        <Sidebar />
        <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />

        <div className="flex min-w-0 flex-1 flex-col gap-3 overflow-hidden p-3">
          <Topbar onOpenMenu={() => setDrawerOpen(true)} />
          <main className="flex-1 overflow-y-auto pb-28 md:pb-0">
            <div className="mx-auto max-w-[1500px]">
              <SubscriptionGate>
                <Outlet />
              </SubscriptionGate>
            </div>
          </main>
        </div>

        <BottomTabBar />
      </div>
    </>
  );
}
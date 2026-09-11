import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { useMeSync } from '@/hooks/useAuth';
import { FullPageSpinner } from '@/components/ui/Spinner';

export function AppShell() {
  const { isLoading, isError } = useMeSync();

  if (isLoading) return <FullPageSpinner label="Loading your session..." />;
  if (isError) {
    return (
      <div className="flex h-screen items-center justify-center text-sm text-red-600">
        Failed to load your session. Try logging out and in again.
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
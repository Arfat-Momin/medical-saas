import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Monitor, Smartphone, Trash2, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { Alert } from '@/components/ui/Alert';
import { Spinner } from '@/components/ui/Spinner';
import { Badge } from '@/components/ui/Badge';
import { authRepository, type SessionRow } from '@/repositories/auth.repository';
import { clearLocalSession } from '@/lib/session';
import { useAuthStore } from '@/stores/auth.store';

const KEY = ['auth', 'sessions'];

export function SessionsPage() {
  const qc = useQueryClient();
  const logout = useAuthStore((s) => s.logout);
  const sessions = useQuery({ queryKey: KEY, queryFn: authRepository.sessions });

  const revoke = useMutation({
    mutationFn: (deviceId: string) => authRepository.revokeSession(deviceId),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });

  const logoutAll = useMutation({
    mutationFn: () => authRepository.logoutAll(),
    onSuccess: async () => {
      await clearLocalSession();
      window.location.href = '/login';
    },
  });

  function iconFor(platform: string) {
    if (platform === 'web') return <Monitor size={16} />;
    return <Smartphone size={16} />;
  }

  return (
    <>
      <PageHeader
        title="Active sessions"
        subtitle="Devices currently signed in to your account"
        action={
          <Button
            variant="danger"
            onClick={() => {
              if (confirm('Sign out of ALL devices? You will need to log in again here too.')) {
                logoutAll.mutate();
              }
            }}
            loading={logoutAll.isPending}
          >
            <LogOut size={14} /> Sign out everywhere
          </Button>
        }
      />

      {sessions.isLoading && <div className="flex justify-center py-12"><Spinner size={28} /></div>}
      {sessions.isError && <Alert tone="error">Failed to load sessions.</Alert>}

      {sessions.data && sessions.data.length === 0 && (
        <Alert tone="info">No sessions recorded yet.</Alert>
      )}

      {sessions.data && sessions.data.length > 0 && (
        <Card>
          <CardHeader title="Devices" subtitle={`${sessions.data.length} session(s)`} />
          <CardBody>
            <ul className="divide-y divide-slate-100">
              {sessions.data.map((s: SessionRow) => (
                <li key={s.id} className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                      {iconFor(s.platform)}
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-900">
                          {s.platform.toUpperCase()}
                        </span>
                        <Badge tone="gray">{s.device_id.slice(0, 8)}</Badge>
                      </div>
                      <p className="text-xs text-slate-500">
                        Last seen {new Date(s.last_seen_at).toLocaleString()}
                        {s.app_version && <> - v{s.app_version}</>}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => revoke.mutate(s.device_id)}
                    loading={revoke.isPending && revoke.variables === s.device_id}
                  >
                    <Trash2 size={14} /> Revoke
                  </Button>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}
    </>
  );
}
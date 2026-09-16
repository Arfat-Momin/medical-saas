import { useEffect, useState } from 'react';
import { Wifi, WifiOff, AlertTriangle, RefreshCw, Trash2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { syncQueue } from '@/sync/queue';
import { triggerSyncNow } from '@/sync/listeners';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import type { QueueItem } from '@/db/schema';

export function OfflineIndicator() {
  const [online, setOnline] = useState(navigator.onLine);
  const [pending, setPending] = useState(0);
  const [conflicts, setConflicts] = useState(0);
  const [justCameBack, setJustCameBack] = useState(false);
  const [issuesOpen, setIssuesOpen] = useState(false);
  const [issues, setIssues] = useState<QueueItem[]>([]);
  const qc = useQueryClient();

  async function refresh() {
    try {
      const [p, c] = await Promise.all([syncQueue.countPending(), syncQueue.countConflicts()]);
      setPending(p);
      setConflicts(c);
    } catch { /* ignore */ }
  }

  useEffect(() => {
    let wasOffline = !navigator.onLine;

    async function handleOnline() {
      setOnline(true);
      qc.invalidateQueries();
      if (wasOffline) {
        setJustCameBack(true);
        void triggerSyncNow().finally(() => setTimeout(() => setJustCameBack(false), 3000));
      }
      wasOffline = false;
      refresh();
    }

    function handleOffline() {
      setOnline(false);
      wasOffline = true;
    }

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    const iv = setInterval(refresh, 3000);
    refresh();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(iv);
    };
  }, [qc]);

  async function openIssues() {
    const list = await syncQueue.listIssues();
    setIssues(list);
    setIssuesOpen(true);
  }

  async function onRetry(id: string) {
    await syncQueue.resetToPending(id);
    const list = await syncQueue.listIssues();
    setIssues(list);
    refresh();
    void triggerSyncNow().finally(refresh);
  }

  async function onDiscard(id: string) {
    if (!confirm('Discard this change? The local edit will be lost and the server version will be kept.')) return;
    await syncQueue.removeById(id);
    const list = await syncQueue.listIssues();
    setIssues(list);
    refresh();
  }

  const showBanner = online ? (justCameBack || conflicts > 0 || pending > 0) : true;
  if (!showBanner) return null;

  return (
    <>
      <button
        type="button"
        onClick={conflicts > 0 ? openIssues : undefined}
        className={
          conflicts > 0
            ? 'flex w-full cursor-pointer items-center justify-center gap-2 bg-red-100 px-3 py-1.5 text-xs font-medium text-red-800 hover:bg-red-200'
            : online
              ? 'flex w-full items-center justify-center gap-2 bg-green-100 px-3 py-1.5 text-xs font-medium text-green-800'
              : 'flex w-full items-center justify-center gap-2 bg-amber-100 px-3 py-1.5 text-xs font-medium text-amber-900'
        }
      >
        {conflicts > 0 ? (
          <>
            <AlertTriangle size={12} />
            <span>
              {conflicts} record{conflicts === 1 ? '' : 's'} failed to sync · Tap to resolve
            </span>
          </>
        ) : online ? (
          <>
            <Wifi size={12} />
            <span>Back online - syncing changes...</span>
          </>
        ) : (
          <>
            <WifiOff size={12} />
            <span>Offline - changes saved locally {pending > 0 ? `(${pending} pending)` : ''}</span>
          </>
        )}
      </button>

      <Modal
        open={issuesOpen}
        onClose={() => setIssuesOpen(false)}
        title="Sync issues"
        size="lg"
        footer={<Button variant="secondary" onClick={() => setIssuesOpen(false)}>Close</Button>}
      >
        {issues.length === 0 ? (
          <p className="text-sm text-slate-500">No sync issues. Everything is up to date.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {issues.map((it) => (
              <li key={it.id} className="flex items-start gap-3 py-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Badge tone={it.status === 'conflict' ? 'red' : it.status === 'blocked' ? 'yellow' : 'gray'}>
                      {it.status}
                    </Badge>
                    <span className="text-sm font-medium text-slate-800">
                      {it.entity} · {it.operation}
                    </span>
                  </div>
                  {it.last_error && (
                    <p className="mt-1 text-xs text-slate-600 break-words">{it.last_error}</p>
                  )}
                  <p className="mt-1 text-[11px] text-slate-400">
                    Created {new Date(it.created_at).toLocaleString()}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button size="sm" variant="secondary" onClick={() => onRetry(it.id)}>
                    <RefreshCw size={12} /> Retry
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => onDiscard(it.id)}>
                    <Trash2 size={12} /> Discard
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Modal>
    </>
  );
}
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import App from './App';
import { queryClient, persister } from '@/lib/queryClient';
import { startWebSyncListeners } from '@/sync/listeners';
import './index.css';

// ── Force the PWA service worker to activate new builds immediately ──
// Without this, mobile devices often serve a stale bundle for hours
// after a rebuild because the SW keeps the old precache entry.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.ready.then((registration) => {
    registration.addEventListener('updatefound', () => {
      const incoming = registration.installing;
      if (!incoming) return;
      incoming.addEventListener('statechange', () => {
        if (
          incoming.state === 'installed' &&
          navigator.serviceWorker.controller
        ) {
          // Tell the new SW to skip waiting, then hard reload once.
          incoming.postMessage({ type: 'SKIP_WAITING' });
          window.location.reload();
        }
      });
    });

    // Also poll for updates every 60s while the tab is open.
    setInterval(() => {
      registration.update().catch(() => {});
    }, 60_000);
  });
}

// Start sync listeners on boot - they check for a token internally
// and skip if not authenticated.
// ── Legacy cursor cleanup ───────────────────────────────────────────
// Old keys 'last_pull_at' / 'last_pull_appt_at' were global (not
// tenant-scoped) and survived table clears, making the server return
// zero rows on every subsequent pull. The sync engine now uses
// per-tenant keys, so anything under the old names is stale.
(async () => {
  try {
    const { meta } = await import('@/db');
    await meta.remove('last_pull_at');
    await meta.remove('last_pull_appt_at');
  } catch { /* never block boot */ }
})();
startWebSyncListeners();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
        dehydrateOptions: {
          // Persist all successful queries and mutations
          shouldDehydrateQuery: (query) => query.state.status === 'success',
        },
      }}
    >
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </PersistQueryClientProvider>
  </React.StrictMode>,
);

import { useEffect, useState } from 'react';
import { Download, X, MoreVertical } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface BIPEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

declare global {
  interface Window {
    __deferredInstallPrompt: BIPEvent | null;
  }
}

export function InstallPrompt() {
  const [available, setAvailable] = useState(false);
  const [visible, setVisible] = useState(false);
  const [manual, setManual] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    // Already installed? Hide everything.
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setInstalled(true);
      return;
    }

    // Check if the event was already captured before we mounted
    if (window.__deferredInstallPrompt) {
      setAvailable(true);
      setVisible(true);
      return;
    }

    // Otherwise listen for the custom "available" event we dispatch from index.html
    function onAvailable() {
      setAvailable(true);
      setVisible(true);
    }

    // And also listen directly to beforeinstallprompt in case it fires again
    function onBeforeInstall(e: Event) {
      e.preventDefault();
      window.__deferredInstallPrompt = e as BIPEvent;
      setAvailable(true);
      setVisible(true);
    }

    window.addEventListener('pwa-install-available', onAvailable);
    window.addEventListener('beforeinstallprompt', onBeforeInstall);

    // After 15 seconds, if we still don't have the event, show the manual
    // "Add to Home screen" instructions as a fallback. This is the case for
    // browsers that don't support automatic install (Firefox, old Chrome, etc.)
    const fallback = setTimeout(() => {
      if (!window.__deferredInstallPrompt) {
        setManual(true);
        setVisible(true);
      }
    }, 15000);

    return () => {
      window.removeEventListener('pwa-install-available', onAvailable);
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      clearTimeout(fallback);
    };
  }, []);

  async function install() {
    const deferred = window.__deferredInstallPrompt;
    if (!deferred) {
      setManual(true);
      return;
    }
    try {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      if (choice.outcome === 'accepted') {
        setVisible(false);
        setInstalled(true);
      }
      window.__deferredInstallPrompt = null;
    } catch (e) {
      // Prompt failed - fall back to manual instructions
      setManual(true);
    }
  }

  function dismiss() {
    setVisible(false);
  }

  if (installed || !visible) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-md rounded-lg border border-slate-200 bg-white p-4 shadow-lg md:left-auto md:right-4 md:max-w-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
          <Download size={18} />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-slate-900">Install Medical SaaS</p>

          {!manual ? (
            <p className="mt-0.5 text-xs text-slate-500">
              Add to your home screen for quick access and full offline support.
            </p>
          ) : (
            <div className="mt-1 text-xs text-slate-600">
              <p className="mb-1.5">To install this app on Android:</p>
              <ol className="ml-4 list-decimal space-y-1">
                <li className="flex items-center gap-1">
                  Tap <MoreVertical size={11} className="inline" /> in Chrome's top bar
                </li>
                <li>Choose <strong>"Add to Home screen"</strong></li>
                <li>Confirm <strong>Install</strong></li>
              </ol>
              <p className="mt-1.5 text-slate-400">
                On iOS Safari: tap <strong>Share</strong>  <strong>Add to Home Screen</strong>.
              </p>
            </div>
          )}

          <div className="mt-3 flex gap-2">
            {!manual && <Button size="sm" onClick={install}>Install</Button>}
            <Button size="sm" variant="secondary" onClick={dismiss}>Not now</Button>
          </div>
        </div>
        <button
          onClick={dismiss}
          className="rounded p-1 text-slate-400 hover:bg-slate-100"
          aria-label="Dismiss"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}

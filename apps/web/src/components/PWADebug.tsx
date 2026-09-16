import { useEffect, useState } from 'react';

interface BIPEvent extends Event {
  prompt: () => Promise<void>;
}

export function PWADebug() {
  const [state, setState] = useState<any>({});
  const [show, setShow] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('pwa-debug') === '1') {
      localStorage.setItem('pwa_debug', '1');
      setShow(true);
    } else if (localStorage.getItem('pwa_debug') === '1') {
      setShow(true);
    }
  }, []);

  useEffect(() => {
    if (!show) return;

    const check = async () => {
      let swState = ' not registered';
      let swController = false;
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg) {
          swState = reg.active ? ' active' : reg.installing ? ' installing' : reg.waiting ? ' waiting' : ' unknown';
          swController = !!navigator.serviceWorker.controller;
        }
      } catch { /* ignore */ }

      setState({
        https: location.protocol === 'https:',
        host: location.hostname,
        manifestLink: (document.querySelector('link[rel="manifest"]') as HTMLLinkElement | null)?.href ?? null,
        swState,
        swController,
        standalone: window.matchMedia('(display-mode: standalone)').matches,
        bip: window.__deferredInstallPrompt ? ' captured' : ' not fired',
      });
    };

    check();
    const iv = setInterval(check, 2000);

    const onBip = () => check();
    window.addEventListener('pwa-install-available', onBip);

    return () => {
      clearInterval(iv);
      window.removeEventListener('pwa-install-available', onBip);
    };
  }, [show]);

  async function forceReloadSW() {
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) {
        await reg.update();
        if (reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });
      }
    } catch { /* ignore */ }
    window.location.reload();
  }

  if (!show) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[9999] bg-black/90 p-3 font-mono text-[11px] text-white">
      <div className="mb-1 flex items-center justify-between">
        <span className="font-bold">PWA Debug</span>
        <div className="flex gap-2">
          <button
            className="rounded bg-blue-600 px-2 py-0.5 text-[10px]"
            onClick={forceReloadSW}
          >
            Reload SW
          </button>
          <button
            className="text-xs opacity-70"
            onClick={() => { localStorage.removeItem('pwa_debug'); setShow(false); }}
          >
            hide
          </button>
        </div>
      </div>
      <div>HTTPS:        {state.https ? '' : ''}</div>
      <div>Host:         {state.host}</div>
      <div>Manifest:     {state.manifestLink ? ' linked' : ' missing'}</div>
      <div>SW:           {state.swState}</div>
      <div>SW controls:  {state.swController ? ' page' : ' none'}</div>
      <div>Standalone:   {state.standalone ? ' installed' : ' browser mode'}</div>
      <div>InstallEvt:   {state.bip}</div>
    </div>
  );
}

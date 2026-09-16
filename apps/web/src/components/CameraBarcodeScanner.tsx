import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';

interface Props {
  open: boolean;
  onClose: () => void;
  onScan: (value: string) => void;
}

const CONTAINER_ID = 'pharmacy-camera-scanner';

export function CameraBarcodeScanner({ open, onClose, onScan }: Props) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    async function stop() {
      const s = scannerRef.current;
      if (!s) return;
      scannerRef.current = null;
      try { await s.stop(); } catch { /* already stopped */ }
      try { s.clear(); } catch { /* ignore */ }
    }

    async function start() {
      setStarting(true);
      setError(null);
      try {
        const scanner = new Html5Qrcode(CONTAINER_ID, { verbose: false });
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 260, height: 140 } },
          (decoded) => {
            if (cancelled) return;
            const value = decoded.trim();
            if (!value) return;
            // Fire once, then stop the camera.
            onScanRef.current(value);
            void stop();
          },
          () => { /* per-frame decode errors - silent */ },
        );
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message || 'Could not access the camera.');
        }
      } finally {
        if (!cancelled) setStarting(false);
      }
    }

    void start();

    return () => {
      cancelled = true;
      void stop();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4">
      <div className="w-full max-w-md overflow-hidden rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <div className="flex items-center gap-2">
            <Camera size={16} />
            <h3 className="text-sm font-semibold text-slate-900">
              Scan barcode with camera
            </h3>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-slate-500 hover:bg-slate-100"
            aria-label="Close scanner"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-4">
          <div
            id={CONTAINER_ID}
            className="mx-auto w-full overflow-hidden rounded-md bg-slate-900"
            style={{ minHeight: 260 }}
          />

          {starting && (
            <p className="mt-2 text-center text-xs text-slate-500">
              Starting camera…
            </p>
          )}

          {error && (
            <div className="mt-3 space-y-2">
              <Alert tone="error">{error}</Alert>
              <p className="text-[11px] text-slate-500">
                Browsers require HTTPS (or localhost) to access the camera. On
                phones, allow camera permission when prompted.
              </p>
            </div>
          )}

          <p className="mt-3 text-center text-xs text-slate-500">
            Point the camera at the barcode. It will scan automatically.
          </p>
        </div>

        <div className="flex justify-end border-t border-slate-200 px-4 py-3">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
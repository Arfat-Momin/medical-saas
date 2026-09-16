import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Printer, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface Props {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}

export function PrintPreviewModal({ open, onClose, title, children }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] overflow-auto bg-slate-900/40 print:bg-transparent">
      {/* Toolbar — solid, opaque, no blur */}
      <div className="no-print sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-800">{title ?? 'Print preview'}</h2>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={onClose}>
            <X size={14} /> Close
          </Button>
          <Button size="sm" onClick={() => window.print()}>
            <Printer size={14} /> Print / Save as PDF
          </Button>
        </div>
      </div>

      <div className="mx-auto my-6 w-full max-w-[210mm] px-2 print:my-0 print:px-0">
        <div className="a4-sheet rounded-md bg-white p-8 shadow-xl print:!p-0 print:!shadow-none print:!rounded-none">
          <div className="print-area">
            {children}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
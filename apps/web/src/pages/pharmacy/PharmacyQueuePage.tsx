import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Camera } from 'lucide-react';
import { CameraBarcodeScanner } from '@/components/CameraBarcodeScanner';
import { useOrganization } from '@/hooks/useOrganization';
import { useInvoice } from '@/hooks/useBilling';
import { InvoicePrint } from '@/components/print/InvoicePrint';
import { PrintPreviewModal } from '@/components/PrintPreviewModal';
import {
  Package, ChevronDown, ChevronUp, Stethoscope, Pill, X, Check,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { Alert } from '@/components/ui/Alert';
import { Spinner } from '@/components/ui/Spinner';
import { MedicinePicker } from '@/components/MedicinePicker';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { pharmacyQueueRepository, type PharmacyQueueItem } from '@/repositories/pharmacy-queue.repository';
import { pharmacyRepository } from '@/repositories/pharmacy.repository';
import { api } from '@/lib/api';

const statusTone: Record<string, BadgeTone> = {
  PENDING: 'yellow',
  DISPENSED: 'green',
  CANCELLED: 'gray',
};

interface DispenseRow {
  medicineName: string;   // original prescription text
  medicineId: string;     // matched medicines.id
  qty: number;
  prescribedDose: string | null;
  prescribedFrequency: string | null;
  prescribedDuration: string | null;
}

export function PharmacyQueuePage() {
  const [status, setStatus] = useState<string>('PENDING');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [dispensing, setDispensing] = useState<PharmacyQueueItem | null>(null);
  const [printInvoiceId, setPrintInvoiceId] = useState<string | null>(null);
  const qc = useQueryClient();
  const organization = useOrganization();
  const invoice = useInvoice(printInvoiceId || undefined);

  const list = useQuery({
    queryKey: ['pharmacy-queue', status],
    queryFn: () => pharmacyQueueRepository.list({ status: status || undefined, pageSize: 100 }),
    refetchInterval: 15_000,
  });

  async function refresh() {
    await qc.invalidateQueries({ queryKey: ['pharmacy-queue'] });
  }

  const rows = list.data?.rows ?? [];

  return (
    <>
      <PageHeader
        title="Pharmacy Queue"
        subtitle="Prescriptions waiting to be dispensed"
        action={
          <Button variant="secondary" size="sm" onClick={refresh}>Refresh</Button>
        }
      />

      {/* Status filter */}
      <div className="mb-4 flex flex-wrap gap-2">
        {[
          { key: 'PENDING', label: 'Pending' },
          { key: 'DISPENSED', label: 'Dispensed' },
          { key: 'CANCELLED', label: 'Cancelled' },
          { key: '', label: 'All' },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setStatus(f.key)}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              status === f.key
                ? 'bg-brand-600 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {list.isLoading && (
        <div className="flex justify-center py-12">
          <Spinner size={28} />
        </div>
      )}

      {list.isError && <Alert tone="error">Failed to load queue.</Alert>}

      {rows.length === 0 && !list.isLoading && (
        <EmptyState
          title="Queue is empty"
          description={
            status === 'PENDING'
              ? 'No pending prescriptions. Complete a consultation to see it appear here.'
              : 'Nothing matches this filter.'
          }
        />
      )}

      <div className="space-y-3">
        {rows.map((item) => (
          <QueueRow
            key={item.id}
            item={item}
            isOpen={expandedId === item.id}
            onToggle={() => setExpandedId(expandedId === item.id ? null : item.id)}
            onDispense={() => setDispensing(item)}
          />
        ))}
      </div>

      {/* Dispense Modal */}
      <DispenseModal
        item={dispensing}
        onClose={() => setDispensing(null)}
        onDone={async (invoiceId) => {
          setDispensing(null);
          if (invoiceId) {
            setPrintInvoiceId(invoiceId);
          }
          await refresh();
        }}
      />

      {printInvoiceId && invoice.data && (
        <PrintPreviewModal
          open={!!printInvoiceId}
          onClose={() => setPrintInvoiceId(null)}
          title={`Invoice ${invoice.data.invoice_no}`}
        >
          <InvoicePrint organization={organization.data} invoice={invoice.data} />
        </PrintPreviewModal>
      )}
    </>
  );
}

function QueueRow({
  item, isOpen, onToggle, onDispense,
}: {
  item: PharmacyQueueItem;
  isOpen: boolean;
  onToggle: () => void;
  onDispense: () => void;
}) {
  const itemCount = item.items?.length ?? 0;

  return (
    <Card>
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50"
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600">
          <Pill size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-brand-700">
              {item.patients?.uhid ?? 'PENDING'}
            </span>
            <Badge tone={statusTone[item.status] ?? 'gray'}>{item.status}</Badge>
          </div>
          <p className="mt-0.5 truncate text-sm font-medium text-slate-900">
            {item.patients?.full_name ?? 'Unknown patient'}
          </p>
          <p className="mt-0.5 truncate text-xs text-slate-500">
            {item.doctors?.full_name ? `Prescribed by ${item.doctors.full_name} - ` : ''}
            {itemCount} medicine{itemCount === 1 ? '' : 's'}
          </p>
          {item.pharmacy_invoice && (
            <p className="mt-0.5 text-xs">
              <span className="text-slate-400">Invoice: </span>
              <Link
                to={`/billing/invoices/${item.pharmacy_invoice.id}`}
                className="font-mono text-brand-600 hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                {item.pharmacy_invoice.invoice_no}
              </Link>
              <span className="ml-2 text-slate-500">Rs.{item.pharmacy_invoice.total_amount.toFixed(2)}</span>
            </p>
          )}
        </div>
        <div className="shrink-0 text-slate-400">
          {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </button>

      {isOpen && (
        <div className="border-t border-slate-100 bg-slate-50 px-4 py-4">
          {/* Prescribed medicines */}
          <div className="mb-4">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Prescribed medicines
            </p>
            <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
              <table className="w-full text-xs">
                <thead className="border-b border-slate-100 bg-slate-50 text-left text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Medicine</th>
                    <th className="px-3 py-2">Dose</th>
                    <th className="px-3 py-2">Frequency</th>
                    <th className="px-3 py-2">Duration</th>
                    <th className="px-3 py-2">Route</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(item.items ?? []).map((it, i) => (
                    <tr key={i}>
                      <td className="px-3 py-2 font-medium text-slate-800">{it.medicineName}</td>
                      <td className="px-3 py-2 text-slate-600">{it.dosage ?? '-'}</td>
                      <td className="px-3 py-2 text-slate-600">{it.frequency ?? '-'}</td>
                      <td className="px-3 py-2 text-slate-600">{it.duration ?? '-'}</td>
                      <td className="px-3 py-2 text-slate-600">{it.route ?? '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Consultation link */}
          {item.encounters?.id && (
            <p className="mb-4 text-xs text-slate-500">
              From consultation on <strong>{item.encounters.encounter_date}</strong>
              {item.encounters.chief_complaint && ` - "${item.encounters.chief_complaint}"`}
            </p>
          )}

          {/* Actions */}
          {item.status === 'PENDING' && (
            <div className="flex justify-end gap-2">
              <Link to={`/patients/${item.patient_id}`}>
                <Button variant="secondary" size="sm">View patient</Button>
              </Link>
              <Button size="sm" onClick={onDispense}>
                <Package size={14} /> Dispense
              </Button>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

function DispenseModal({
  item, onClose, onDone,
}: {
  item: PharmacyQueueItem | null;
  onClose: () => void;
  onDone: (invoiceId?: string) => Promise<void>;
}) {
  const [rows, setRows] = useState<DispenseRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const [barcode, setBarcode] = useState('');
  const [scanning, setScanning] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);

  function addMedicineToRows(med: { id: string; name: string }) {
    setRows((prev) => {
      // 1. Exact match by medicineId -> bump the quantity on that row.
      const byId = prev.findIndex((r) => r.medicineId === med.id);
      if (byId !== -1) {
        return prev.map((r, i) =>
          i === byId ? { ...r, qty: r.qty + 1 } : r,
        );
      }

      // 2. Match an UNMATCHED prescribed row by name (case-insensitive).
      //    This is the common case: the prescription says
      //    "Paracetamol 500mg", the scanner reads the same medicine,
      //    and the user expects the row to be filled in - not a new
      //    duplicate row to appear. Previously this appended, which
      //    left the original prescribed row unmatched and made the
      //    Confirm step fail with "Select a medicine for all rows".
      const medName = med.name.trim().toLowerCase();
      const byName = prev.findIndex(
        (r) =>
          !r.medicineId &&
          r.medicineName.trim().toLowerCase() === medName,
      );
      if (byName !== -1) {
        return prev.map((r, i) =>
          i === byName ? { ...r, medicineId: med.id } : r,
        );
      }

      // 3. Genuinely new medicine (not in the prescription) -> append.
      return [
        ...prev,
        {
          medicineName: med.name,
          medicineId: med.id,
          qty: 1,
          prescribedDose: null,
          prescribedFrequency: null,
          prescribedDuration: null,
        },
      ];
    });
    setBarcode('');
    // Refocus the barcode field so the next scan works without clicking.
    setTimeout(() => barcodeInputRef.current?.focus(), 50);
  }

  useEffect(() => {
    if (item) {
      setTimeout(() => barcodeInputRef.current?.focus(), 100);
    }
  }, [item]);

  async function handleBarcodeSubmit(e: React.FormEvent) {
    e.preventDefault();
    await lookupAndAdd(barcode);
  }

  async function lookupAndAdd(rawBarcode: string) {
    const code = rawBarcode.trim();
    if (!code || !item) return;
    setScanning(true);
    setError(null);
    try {
      const med = await pharmacyRepository.getMedicineByBarcode(code);
      addMedicineToRows({ id: med.id, name: med.name });
    } catch (err: any) {
      setError(err?.message || 'Medicine not found for this barcode');
      // Still clear + refocus so the next scan is clean.
      setBarcode('');
      setTimeout(() => barcodeInputRef.current?.focus(), 50);
    } finally {
      setScanning(false);
    }
  }

  // Re-initialise rows when the queue item changes.
  useEffect(() => {
    if (!item) { setRows([]); return; }
    setRows(
      (item.items ?? []).map((it) => ({
        medicineName: it.medicineName,
        medicineId: '',
        qty: (it as any).quantity ?? 1,
        prescribedDose: it.dosage ?? null,
        prescribedFrequency: it.frequency ?? null,
        prescribedDuration: it.duration ?? null,
      })),
    );
  }, [item?.id]);

  const dispense = useMutation({
    mutationFn: async (payload: { items: { medicineId: string; qty: number }[] }) => {
      if (!item) throw new Error('No item');

      // 1. Call dispense RPC â†’ FEFO allocates across batches, reduces stock
      const result = await api.post<{ dispenseId: string; totalAmount: number; invoiceId?: string; invoiceNo?: string }>(
        '/pharmacy/dispense',
        {
          patientId: item.patient_id,
          encounterId: item.encounter_id,
          branchId: item.branch_id,
          notes: 'Dispensed from pharmacy queue',
          items: payload.items,
        },
      );

      // 2. Mark the queue item DISPENSED with the created dispense id
      await pharmacyQueueRepository.markDispensed(item.id, result.dispenseId);
      return result;
    },
    onSuccess: (result) => onDone(result.invoiceId),
    onError: (e: any) => setError(e?.message ?? 'Dispense failed'),
  });

  const updateRow = (i: number, patch: Partial<DispenseRow>) => {
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  };

  async function onConfirm() {
    setError(null);
    const missing = rows.filter((r) => !r.medicineId || r.qty <= 0);
    if (missing.length > 0) {
      setError(`Select a medicine for all rows and set quantity > 0`);
      return;
    }
    await dispense.mutateAsync({
      items: rows.map((r) => ({ medicineId: r.medicineId, qty: r.qty })),
    });
  }

  if (!item) return null;

  return (
    <Modal
      open={!!item}
      onClose={onClose}
      title="Dispense medicines"
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={onConfirm} loading={dispense.isPending}>
            <Check size={14} /> Confirm dispense
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {/* Doctor's prescription - read-only reference */}
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-4 py-2.5">
            <Stethoscope size={14} className="text-brand-600" />
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">
              Doctor&apos;s Prescription
            </span>
            {item.doctors?.full_name && (
              <span className="ml-auto text-xs text-slate-500">
                by {item.doctors.full_name}
              </span>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-left text-slate-500">
                <tr>
                  <th className="px-4 py-2 font-medium">Medicine</th>
                  <th className="px-4 py-2 font-medium">Dose</th>
                  <th className="px-4 py-2 font-medium">Frequency</th>
                  <th className="px-4 py-2 font-medium">Duration</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(item.items ?? []).map((it, i) => (
                  <tr key={i}>
                    <td className="px-4 py-2 font-medium text-slate-800">{it.medicineName}</td>
                    <td className="px-4 py-2 text-slate-600">{it.dosage ?? '-'}</td>
                    <td className="px-4 py-2 text-slate-600">{it.frequency ?? '-'}</td>
                    <td className="px-4 py-2 text-slate-600">{it.duration ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Add medicine - barcode scan OR manual search */}
        <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
            Add medicine to dispense
          </p>

          {item && (
            <form onSubmit={handleBarcodeSubmit} className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="min-w-0 flex-1">
                <Input
                  ref={barcodeInputRef}
                  label="Barcode"
                  placeholder="Scan or type barcode..."
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  disabled={scanning}
                />
              </div>
              <div className="flex gap-2 sm:mb-0.5">
                <Button type="submit" loading={scanning} className="flex-1 sm:flex-none">
                  Add
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setCameraOpen(true)}
                  title="Scan with camera"
                >
                  <Camera size={14} />
                </Button>
              </div>
            </form>
          )}

          <div className="my-3 flex items-center gap-3">
            <div className="h-px flex-1 bg-slate-200" />
            <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
              or add manually
            </span>
            <div className="h-px flex-1 bg-slate-200" />
          </div>

          <MedicinePicker
            value=""
            onChange={(name, meta) => {
              if (meta?.id) addMedicineToRows({ id: meta.id, name });
            }}
            placeholder="Search medicine from catalog..."
          />
        </div>

        <CameraBarcodeScanner
          open={cameraOpen}
          onClose={() => {
            setCameraOpen(false);
            setTimeout(() => barcodeInputRef.current?.focus(), 50);
          }}
          onScan={async (value) => {
            setCameraOpen(false);
            await lookupAndAdd(value);
          }}
        />

        {/* Patient */}
        <div className="rounded-md bg-brand-50 px-3 py-2">
          <p className="text-xs uppercase tracking-wide text-brand-700">Patient</p>
          <p className="text-sm font-semibold text-brand-900">
            {item.patients?.full_name}{' '}
            <span className="font-mono text-xs">
              ({item.patients?.uhid})
            </span>
          </p>
        </div>

        {error && <Alert tone="error">{error}</Alert>}

        {/* Items to dispense */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
              Items to dispense
            </p>
            <p className="text-xs text-slate-500">
              {rows.filter((r) => r.medicineId).length} / {rows.length} matched
            </p>
          </div>
          <div className="space-y-3">
          {rows.map((r, i) => (
            <div key={i} className="rounded-md border border-slate-200 bg-slate-50 p-3">
              {/* Prescribed (read-only) */}
              <div className="mb-2">
                <p className="text-xs font-semibold text-slate-700">
                  Prescribed: {r.medicineName}
                </p>
                <p className="text-[11px] text-slate-500">
                  {[r.prescribedDose, r.prescribedFrequency, r.prescribedDuration]
                    .filter(Boolean)
                    .join(' - ')}
                </p>
              </div>

              {/* Match to catalog + qty */}
              <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
                <div className="md:col-span-8">
                  <MedicinePicker
                    value={r.medicineName}
                    onChange={(name, meta) => {
                      updateRow(i, { medicineName: name, medicineId: meta?.id ?? '' });
                    }}
                    placeholder="Pick the medicine to dispense"
                  />
                  {r.medicineId && (
                    <p className="mt-1 text-[11px] text-green-600">
                      Matched to catalog âœ“
                    </p>
                  )}
                  {!r.medicineId && (
                    <p className="mt-1 text-[11px] text-amber-600">
                      Select the medicine from the catalog to continue
                    </p>
                  )}
                </div>
                <div className="md:col-span-4">
                  <Input
                    label="Qty to dispense"
                    type="number"
                    min="1"
                    value={String(r.qty)}
                    onChange={(e) => updateRow(i, { qty: Math.max(1, Number(e.target.value) || 1) })}
                  />
                </div>
              </div>
            </div>
          ))}
          </div>
        </div>

        <Alert tone="info">
          On confirm, the system will allocate stock using <strong>FEFO</strong> (earliest expiry first)
          and deduct the quantity from your inventory automatically.
        </Alert>
      </div>
    </Modal>
  );
}

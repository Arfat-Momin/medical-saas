import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Card } from '@/components/ui/Card';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { Alert } from '@/components/ui/Alert';
import { Spinner } from '@/components/ui/Spinner';
import { useInvoices, useCreateInvoice, useBillableItems } from '@/hooks/useBilling';
import { usePatients } from '@/hooks/usePatients';
import { usePermissions } from '@/hooks/useAuth';
import { PERMISSIONS } from '@medical/shared';

const statusTone: Record<string, BadgeTone> = {
  UNPAID: 'red', PARTIAL: 'yellow', PAID: 'green', REFUNDED: 'gray', CANCELLED: 'gray',
};

interface LineItem {
  itemType: 'MANUAL' | 'CONSULTATION' | 'LAB' | 'PHARMACY' | 'PROCEDURE' | 'IPD';
  description: string;
  qty: string;
  unitPrice: string;
  discount: string;
  taxRate: string;
}

const newLine: LineItem = {
  itemType: 'MANUAL', description: '', qty: '1', unitPrice: '0', discount: '0', taxRate: '0',
};

export function InvoicesPage() {
  const { can } = usePermissions();
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const list = useInvoices({ status: status || undefined, page, pageSize: 20 });

  const patients = usePatients({ page: 1, pageSize: 200 });
  const items = useBillableItems({ page: 1, pageSize: 200 });
  const create = useCreateInvoice();

  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [patientId, setPatientId] = useState('');
  const [notes, setNotes] = useState('');
  const [discount, setDiscount] = useState('0');
  const [lines, setLines] = useState<LineItem[]>([{ ...newLine }]);

  const canManage = can(PERMISSIONS.BILLING_MANAGE);

  function reset() {
    setPatientId(''); setNotes(''); setDiscount('0');
    setLines([{ ...newLine }]); setError(null);
  }

  function pickBillableItem(idx: number, billableId: string) {
    const b = items.data?.rows.find((x) => x.id === billableId);
    if (!b) return;
    setLines(lines.map((line, j) => j === idx ? {
      ...line,
      itemType: b.category === 'CONSULTATION' ? 'CONSULTATION' : b.category === 'PROCEDURE' ? 'PROCEDURE' : 'MANUAL',
      description: b.name,
      unitPrice: String(b.price),
      taxRate: String(b.tax_rate),
    } : line));
  }

  function updateLine(i: number, patch: Partial<LineItem>) {
    setLines(lines.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  }

  function lineTotal(l: LineItem): number {
    const sub = Number(l.qty || 0) * Number(l.unitPrice || 0) - Number(l.discount || 0);
    const tax = sub * Number(l.taxRate || 0) / 100;
    return sub + tax;
  }
  const subtotal = lines.reduce((s, l) => s + lineTotal(l), 0);
  const grand = subtotal - Number(discount || 0);

  async function onCreate() {
    setError(null);
    if (!patientId) { setError('Select a patient'); return; }
    const validLines = lines.filter((l) => l.description.trim() && Number(l.qty) > 0);
    if (validLines.length === 0) { setError('Add at least one item with description and quantity'); return; }

    try {
      await create.mutateAsync({
        patientId,
        notes: notes || null,
        discount: Number(discount || 0),
        items: validLines.map((l) => ({
          itemType: l.itemType,
          description: l.description,
          qty: Number(l.qty),
          unitPrice: Number(l.unitPrice || 0),
          discount: Number(l.discount || 0),
          taxRate: Number(l.taxRate || 0),
        })),
      });
      setOpen(false); reset();
    } catch (e: any) { setError(e?.message ?? 'Failed to create invoice'); }
  }

  const totalPages = list.data ? Math.max(1, Math.ceil(list.data.total / (list.data.pageSize || 20))) : 1;

  return (
    <>
      <PageHeader title="Invoices" subtitle="Patient billing - internal (no online gateway)"
        action={canManage && <Button onClick={() => setOpen(true)}><Plus size={16} /> New invoice</Button>} />

      <div className="mb-4 w-48">
        <Select label="Status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All</option>
          <option value="UNPAID">Unpaid</option>
          <option value="PARTIAL">Partial</option>
          <option value="PAID">Paid</option>
          <option value="REFUNDED">Refunded</option>
          <option value="CANCELLED">Cancelled</option>
        </Select>
      </div>

      {list.isLoading && <div className="flex justify-center py-12"><Spinner size={28} /></div>}
      {list.isError && <Alert tone="error">Failed to load invoices.</Alert>}

      {list.data?.rows.length === 0 && (
        <EmptyState title="No invoices yet" description="Create an invoice to start billing"
          action={canManage && <Button onClick={() => setOpen(true)}><Plus size={16} /> New invoice</Button>} />
      )}

      {list.data && list.data.rows.length > 0 && (
        <>
          <Card className="overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3">Invoice #</th>
                  <th className="px-5 py-3">Patient</th>
                  <th className="px-5 py-3">Date</th>
                  <th className="px-5 py-3 text-right">Total</th>
                  <th className="px-5 py-3 text-right">Paid</th>
                  <th className="px-5 py-3 text-right">Balance</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {list.data.rows.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3 font-mono text-xs text-brand-700">{inv.invoice_no}</td>
                    <td className="px-5 py-3">
                      <div className="font-medium text-slate-900">{inv.patients?.full_name}</div>
                      <div className="font-mono text-xs text-slate-500">{inv.patients?.uhid}</div>
                    </td>
                    <td className="px-5 py-3 text-slate-600">{new Date(inv.created_at).toLocaleDateString()}</td>
                    <td className="px-5 py-3 text-right font-mono">{inv.total_amount.toFixed(2)}</td>
                    <td className="px-5 py-3 text-right font-mono text-green-700">{inv.paid_amount.toFixed(2)}</td>
                    <td className="px-5 py-3 text-right font-mono text-red-600">{inv.balance_amount.toFixed(2)}</td>
                    <td className="px-5 py-3"><Badge tone={statusTone[inv.status] ?? 'gray'}>{inv.status}</Badge></td>
                    <td className="px-5 py-3 text-right">
                      <Link to={`/billing/invoices/${inv.id}`} className="text-sm text-brand-600 hover:underline">Open</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
            <span>{list.data.total} invoice{list.data.total === 1 ? '' : 's'} - page {page} of {totalPages}</span>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
              <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          </div>
        </>
      )}

      <Modal open={open} onClose={() => { setOpen(false); reset(); }} title="New invoice" size="lg"
        footer={<><Button variant="secondary" onClick={() => { setOpen(false); reset(); }}>Cancel</Button>
          <Button onClick={onCreate} loading={create.isPending}>Create invoice</Button></>}>
        <div className="space-y-4">
          {error && <Alert tone="error">{error}</Alert>}

          <Select label="Patient *" value={patientId} onChange={(e) => setPatientId(e.target.value)}>
            <option value="">
              {patients.isLoading ? 'Loading...' : patients.isError ? 'Failed to load patients' : '- select patient -'}
            </option>
            {patients.data?.rows.map((p) => (
              <option key={p.id} value={p.id}>{p.uhid} - {p.full_name}</option>
            ))}
          </Select>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <h4 className="text-sm font-medium text-slate-700">Line items</h4>
              <Button size="sm" variant="secondary" onClick={() => setLines([...lines, { ...newLine }])}>
                <Plus size={14} /> Add line
              </Button>
            </div>

            <div className="space-y-3">
              {lines.map((l, i) => (
                <div key={i} className="rounded-md border border-slate-200 bg-slate-50/40 p-3">
                  {/* Row 1 - identity */}
                  <div className="grid grid-cols-12 gap-3">
                    <div className="col-span-12 md:col-span-5">
                      <Select label="From catalog" onChange={(e) => pickBillableItem(i, e.target.value)}>
                        <option value="">- pick or type below -</option>
                        {items.data?.rows.map((b) => (
                          <option key={b.id} value={b.id}>{b.name} (Rs.{b.price})</option>
                        ))}
                      </Select>
                    </div>
                    <div className="col-span-11 md:col-span-6">
                      <Input
                        label="Description"
                        value={l.description}
                        onChange={(e) => updateLine(i, { description: e.target.value })}
                        placeholder="Consultation / Blood test / Medicine"
                      />
                    </div>
                    <div className="col-span-1 flex items-end justify-end">
                      {lines.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setLines(lines.filter((_, j) => j !== i))}
                          className="rounded p-2 text-slate-400 hover:bg-red-50 hover:text-red-500"
                          title="Remove line"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Row 2 - numbers */}
                  <div className="mt-3 grid grid-cols-12 gap-3">
                    <div className="col-span-4 md:col-span-2">
                      <Input
                        label="Qty"
                        type="number"
                        min="1"
                        step="1"
                        value={l.qty}
                        onChange={(e) => updateLine(i, { qty: e.target.value })}
                      />
                    </div>
                    <div className="col-span-4 md:col-span-2">
                      <Input
                        label="Unit price (Rs)"
                        type="number"
                        min="0"
                        step="0.01"
                        value={l.unitPrice}
                        onChange={(e) => updateLine(i, { unitPrice: e.target.value })}
                      />
                    </div>
                    <div className="col-span-4 md:col-span-2">
                      <Input
                        label="Discount (Rs)"
                        type="number"
                        min="0"
                        step="0.01"
                        value={l.discount}
                        onChange={(e) => updateLine(i, { discount: e.target.value })}
                      />
                    </div>
                    <div className="col-span-4 md:col-span-2">
                      <Input
                        label="Tax %"
                        type="number"
                        min="0"
                        step="0.01"
                        value={l.taxRate}
                        onChange={(e) => updateLine(i, { taxRate: e.target.value })}
                      />
                    </div>
                    <div className="col-span-8 md:col-span-4 flex items-end justify-end">
                      <div className="w-full text-right text-xs text-slate-500">
                        Line total:{' '}
                        <span className="font-mono text-sm font-medium text-slate-800">
                          Rs.{lineTotal(l).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Input label="Discount (Rs)" type="number" step="0.01" value={discount} onChange={(e) => setDiscount(e.target.value)} />
            <Input label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          <div className="rounded-md bg-slate-50 px-4 py-3 text-right text-sm">
            <div className="text-slate-600">Subtotal: <span className="font-mono text-slate-800">Rs.{subtotal.toFixed(2)}</span></div>
            <div className="text-slate-600">Discount: <span className="font-mono text-slate-800">- Rs.{Number(discount || 0).toFixed(2)}</span></div>
            <div className="mt-1 text-base font-semibold text-slate-900">
              Total: <span className="font-mono">Rs.{grand.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </Modal>
    </>
  );
}

import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { Alert } from '@/components/ui/Alert';
import { Spinner } from '@/components/ui/Spinner';
import { useSuppliers, useMedicines, usePurchases, useReceivePurchase } from '@/hooks/usePharmacy';

interface Item { medicineId: string; batchNo: string; expiryDate: string; qty: string; purchasePrice: string; mrp: string; sellingPrice: string }

const newItem: Item = { medicineId: '', batchNo: '', expiryDate: '', qty: '', purchasePrice: '', mrp: '', sellingPrice: '' };

export function PurchasesPage() {
  const [page, setPage] = useState(1);
  const list = usePurchases(page, 20);
  const suppliers = useSuppliers();
  const medicines = useMedicines({ page: 1, pageSize: 100 });
  const receive = useReceivePurchase();

  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [supplierId, setSupplierId] = useState('');
  const [invoiceNo, setInvoiceNo] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<Item[]>([{ ...newItem }]);

  function reset() {
    setSupplierId(''); setInvoiceNo(''); setNotes(''); setItems([{ ...newItem }]); setError(null);
  }

  async function onSave() {
    setError(null);
    if (!supplierId) { setError('Select a supplier'); return; }
    const validItems = items.filter((i) => i.medicineId && i.batchNo && i.expiryDate && Number(i.qty) > 0);
    if (validItems.length === 0) { setError('Add at least one item with medicine, batch, expiry and quantity'); return; }
    try {
      await receive.mutateAsync({
        supplierId, invoiceNo: invoiceNo || null, purchaseDate, notes: notes || null,
        items: validItems.map((i) => ({
          medicineId: i.medicineId, batchNo: i.batchNo, expiryDate: i.expiryDate,
          qty: Number(i.qty), purchasePrice: Number(i.purchasePrice || 0),
          mrp: i.mrp ? Number(i.mrp) : null,
          sellingPrice: i.sellingPrice ? Number(i.sellingPrice) : null,
        })),
      });
      setOpen(false); reset();
    } catch (e: any) { setError(e?.message ?? 'Failed to save purchase'); }
  }

  function updateItem(i: number, patch: Partial<Item>) {
    setItems(items.map((it, j) => (j === i ? { ...it, ...patch } : it)));
  }
  const lineTotal = (it: Item) => Number(it.qty || 0) * Number(it.purchasePrice || 0);
  const grandTotal = items.reduce((s, i) => s + lineTotal(i), 0);

  const totalPages = list.data ? Math.max(1, Math.ceil(list.data.total / 20)) : 1;

  return (
    <>
      <PageHeader title="Purchases" subtitle="Stock purchases from suppliers"
        action={<Button onClick={() => setOpen(true)}><Plus size={16} /> New purchase</Button>} />

      {list.isLoading && <div className="flex justify-center py-12"><Spinner size={28} /></div>}
      {list.isError && <Alert tone="error">Failed to load purchases.</Alert>}

      {list.data?.rows.length === 0 && (
        <EmptyState title="No purchases yet" description="Record a purchase to add stock"
          action={<Button onClick={() => setOpen(true)}><Plus size={16} /> New purchase</Button>} />
      )}

      {list.data && list.data.rows.length > 0 && (
        <>
          <Card className="overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3">Date</th>
                  <th className="px-5 py-3">Supplier</th>
                  <th className="px-5 py-3">Invoice</th>
                  <th className="px-5 py-3 text-right">Total</th>
                  <th className="px-5 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {list.data.rows.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3 text-slate-700">{p.purchase_date}</td>
                    <td className="px-5 py-3 font-medium text-slate-900">{p.suppliers?.name ?? '-'}</td>
                    <td className="px-5 py-3 text-slate-600">{p.invoice_no ?? '-'}</td>
                    <td className="px-5 py-3 text-right font-mono text-slate-800">Rs.{p.total_amount.toFixed(2)}</td>
                    <td className="px-5 py-3"><Badge tone={p.status === 'RECEIVED' ? 'green' : 'yellow'}>{p.status}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
            <span>{list.data.total} purchase{list.data.total === 1 ? '' : 's'} | page {page} of {totalPages}</span>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
              <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          </div>
        </>
      )}

      <Modal open={open} onClose={() => { setOpen(false); reset(); }} title="New purchase" size="lg"
        footer={<><Button variant="secondary" onClick={() => { setOpen(false); reset(); }}>Cancel</Button>
          <Button onClick={onSave} loading={receive.isPending}>Save & receive</Button></>}>
        <div className="space-y-4">
          {error && <Alert tone="error">{error}</Alert>}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Select label="Supplier *" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
              <option value="">- select -</option>
              {suppliers.data?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
            <Input label="Invoice no." value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} />
            <Input label="Date" type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-slate-700">Items</h4>
              <Button size="sm" variant="secondary" onClick={() => setItems([...items, { ...newItem }])}>
                <Plus size={14} /> Add item
              </Button>
            </div>
            {items.map((it, i) => (
              <div key={i} className="space-y-2 rounded-md border border-slate-200 p-3">
                {/* Row 1 - identity */}
                <div className="grid grid-cols-12 gap-3">
                  <div className="col-span-12 md:col-span-5">
                    <Select
                      label="Medicine"
                      value={it.medicineId}
                      onChange={(e) => updateItem(i, { medicineId: e.target.value })}
                    >
                      <option value="">
                        {medicines.isLoading ? 'Loading...' : medicines.isError ? ' Failed to load' : '- select -'}
                      </option>
                      {medicines.data?.rows.map((m) => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                    </Select>
                  </div>
                  <div className="col-span-6 md:col-span-3">
                    <Input
                      label="Batch no."
                      value={it.batchNo}
                      onChange={(e) => updateItem(i, { batchNo: e.target.value })}
                      placeholder="PCM001"
                    />
                  </div>
                  <div className="col-span-6 md:col-span-3">
                    <Input
                      label="Expiry"
                      type="date"
                      value={it.expiryDate}
                      onChange={(e) => updateItem(i, { expiryDate: e.target.value })}
                    />
                  </div>
                  <div className="col-span-12 md:col-span-1 flex items-end justify-end">
                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setItems(items.filter((_, j) => j !== i))}
                        className="rounded p-2 text-slate-400 hover:bg-red-50 hover:text-red-500"
                        title="Remove item"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Row 2 - quantities & prices */}
                <div className="grid grid-cols-12 gap-3">
                  <div className="col-span-6 md:col-span-3">
                    <Input
                      label="Quantity"
                      type="number"
                      min="1"
                      step="1"
                      value={it.qty}
                      onChange={(e) => updateItem(i, { qty: e.target.value })}
                      placeholder="100"
                    />
                  </div>
                  <div className="col-span-6 md:col-span-3">
                    <Input
                      label="Cost price (Rs.)"
                      type="number"
                      min="0"
                      step="0.01"
                      value={it.purchasePrice}
                      onChange={(e) => updateItem(i, { purchasePrice: e.target.value })}
                      placeholder="1.50"
                    />
                  </div>
                  <div className="col-span-6 md:col-span-3">
                    <Input
                      label="MRP (Rs.)"
                      type="number"
                      min="0"
                      step="0.01"
                      value={it.mrp}
                      onChange={(e) => updateItem(i, { mrp: e.target.value })}
                      placeholder="3.00"
                    />
                  </div>
                  <div className="col-span-6 md:col-span-3">
                    <Input
                      label="Selling price (Rs.)"
                      type="number"
                      min="0"
                      step="0.01"
                      value={it.sellingPrice}
                      onChange={(e) => updateItem(i, { sellingPrice: e.target.value })}
                      placeholder="2.50"
                    />
                  </div>
                </div>

                {/* Row 3 - live line total + margin */}
                <div className="flex items-center justify-end gap-4 text-xs">
                  {Number(it.sellingPrice) > 0 && Number(it.purchasePrice) > 0 && (
                    <span
                      className={
                        Number(it.sellingPrice) >= Number(it.purchasePrice)
                          ? 'text-green-600'
                          : 'text-red-500'
                      }
                    >
                      Margin:{' '}
                      {(
                        ((Number(it.sellingPrice) - Number(it.purchasePrice)) /
                          Number(it.purchasePrice)) *
                        100
                      ).toFixed(1)}
                      %
                    </span>
                  )}
                  <span className="text-slate-500">
                    Line total:{' '}
                    <span className="font-mono font-medium text-slate-800">
                      Rs.{(Number(it.qty || 0) * Number(it.purchasePrice || 0)).toFixed(2)}
                    </span>
                  </span>
                </div>
              </div>
            ))}
            <div className="text-right text-sm text-slate-700">
              Total: <span className="font-mono font-medium">Rs.{grandTotal.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </Modal>
    </>
  );
}
import { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertTriangle, Clock, Search, Plus, Edit3, Boxes, Filter, CheckCircle2 } from 'lucide-react';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { Alert } from '@/components/ui/Alert';
import { useLowStock, useExpiring, useBatches, useAdjustStock, useCreateBatch, useMedicines } from '@/hooks/usePharmacy';
import { usePermissions } from '@/hooks/useAuth';
import { useAuthStore } from '@/stores/auth.store';
import { PERMISSIONS } from '@medical/shared';
import type { Batch } from '@/repositories/pharmacy.repository';

const REASON_CATEGORIES = [
  'Physical inventory count correction',
  'Damaged / broken container',
  'Expired stock removal',
  'Unaccounted shortage / loss',
  'Stock surplus / unrecorded return',
  'Correction of entry error',
  'Other',
];

export function StockPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialSearch = searchParams.get('search') ?? '';

  const [search, setSearch] = useState(initialSearch);
  const [onlyInStock, setOnlyInStock] = useState(false);

  // Auth / Permissions
  const { can } = usePermissions();
  const roles = useAuthStore((s) => s.roles);
  const canEditStock =
    can(PERMISSIONS.PHARMACY_STOCK) ||
    roles.some((r) => ['HOSPITAL_ADMIN', 'PHARMACIST', 'SUPER_ADMIN'].includes(r));

  // Data queries
  const low = useLowStock();
  const exp = useExpiring();
  const batches = useBatches({ onlyInStock });
  const medicines = useMedicines({ pageSize: 200 });

  // Mutations
  const adjustStock = useAdjustStock();
  const createBatch = useCreateBatch();

  // Modal states: Edit Stock
  const [adjustBatch, setAdjustBatch] = useState<Batch | null>(null);
  const [newQty, setNewQty] = useState<number>(0);
  const [reasonCategory, setReasonCategory] = useState<string>(REASON_CATEGORIES[0] ?? 'Other');
  const [notes, setNotes] = useState('');
  const [adjustError, setAdjustError] = useState<string | null>(null);
  const [adjustSuccess, setAdjustSuccess] = useState<string | null>(null);

  // Modal states: New Batch
  const [newBatchOpen, setNewBatchOpen] = useState(false);
  const [newBatchMedId, setNewBatchMedId] = useState('');
  const [newBatchNo, setNewBatchNo] = useState('');
  const [newBatchExpiry, setNewBatchExpiry] = useState('');
  const [newBatchQty, setNewBatchQty] = useState(0);
  const [newBatchMrp, setNewBatchMrp] = useState('');
  const [newBatchSelling, setNewBatchSelling] = useState('');
  const [newBatchPurchase, setNewBatchPurchase] = useState('');
  const [newBatchError, setNewBatchError] = useState<string | null>(null);

  // Filtered batches
  const filteredBatches = useMemo(() => {
    if (!batches.data) return [];
    const q = search.trim().toLowerCase();
    if (!q) return batches.data;
    return batches.data.filter((b) => {
      const medName = b.medicines?.name?.toLowerCase() ?? '';
      const batchNo = b.batch_no?.toLowerCase() ?? '';
      return medName.includes(q) || batchNo.includes(q);
    });
  }, [batches.data, search]);

  function openAdjust(b: Batch) {
    setAdjustBatch(b);
    setNewQty(b.current_qty);
    setReasonCategory(REASON_CATEGORIES[0] ?? 'Other');
    setNotes('');
    setAdjustError(null);
  }

  function handleQuickAdjust(delta: number) {
    setNewQty((prev) => Math.max(0, prev + delta));
  }

  async function handleAdjustSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!adjustBatch) return;

    const delta = newQty - adjustBatch.current_qty;
    if (delta === 0) {
      setAdjustError('New quantity is identical to current quantity. Please change the value.');
      return;
    }
    if (newQty < 0) {
      setAdjustError('Quantity cannot be negative.');
      return;
    }

    setAdjustError(null);
    try {
      const finalReason = notes.trim()
        ? `${reasonCategory}: ${notes.trim()}`
        : (reasonCategory || 'Stock adjustment');

      await adjustStock.mutateAsync({
        batchId: adjustBatch.id,
        qtyDelta: delta,
        reason: finalReason,
      });

      setAdjustSuccess(`Successfully updated stock for batch ${adjustBatch.batch_no} to ${newQty}.`);
      setAdjustBatch(null);
      setTimeout(() => setAdjustSuccess(null), 4000);
    } catch (err: any) {
      setAdjustError(err?.response?.data?.message ?? err?.message ?? 'Failed to update stock.');
    }
  }

  async function handleCreateBatchSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!newBatchMedId) {
      setNewBatchError('Please select a medicine.');
      return;
    }
    if (!newBatchNo.trim()) {
      setNewBatchError('Batch number is required.');
      return;
    }
    if (!newBatchExpiry) {
      setNewBatchError('Expiry date is required.');
      return;
    }

    setNewBatchError(null);
    try {
      await createBatch.mutateAsync({
        medicineId: newBatchMedId,
        batchNo: newBatchNo.trim(),
        expiryDate: newBatchExpiry,
        initialQty: Number(newBatchQty) || 0,
        mrp: newBatchMrp ? Number(newBatchMrp) : null,
        sellingPrice: newBatchSelling ? Number(newBatchSelling) : null,
        purchasePrice: newBatchPurchase ? Number(newBatchPurchase) : 0,
      });

      setNewBatchOpen(false);
      setNewBatchMedId('');
      setNewBatchNo('');
      setNewBatchExpiry('');
      setNewBatchQty(0);
      setNewBatchMrp('');
      setNewBatchSelling('');
      setNewBatchPurchase('');
      setAdjustSuccess('New batch added successfully.');
      setTimeout(() => setAdjustSuccess(null), 4000);
    } catch (err: any) {
      setNewBatchError(err?.response?.data?.message ?? err?.message ?? 'Failed to add batch.');
    }
  }

  const currentDelta = adjustBatch ? newQty - adjustBatch.current_qty : 0;

  return (
    <>
      <PageHeader
        title="Stock"
        subtitle="Real-time inventory, stock editing, and alerts"
        action={
          canEditStock ? (
            <Button onClick={() => { setNewBatchError(null); setNewBatchOpen(true); }}>
              <Plus size={16} className="mr-1" /> Add Batch / Stock
            </Button>
          ) : undefined
        }
      />

      {adjustSuccess && (
        <div className="mb-4">
          <Alert tone="success">{adjustSuccess}</Alert>
        </div>
      )}

      {/* Top summary cards */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Low stock alerts"
            subtitle={`${low.data?.length ?? 0} item(s) at or below reorder level`}
            action={<AlertTriangle size={16} className="text-amber-500" />}
          />
          <CardBody>
            {low.isLoading && (
              <div className="flex justify-center py-6">
                <Spinner size={22} />
              </div>
            )}
            {low.data?.length === 0 && (
              <EmptyState title="No low stock" description="All medicines are above reorder level" />
            )}
            {low.data && low.data.length > 0 && (
              <ul className="divide-y divide-slate-100 max-h-60 overflow-y-auto">
                {low.data.map((r) => (
                  <li key={r.medicine_id} className="flex items-center justify-between py-2">
                    <div>
                      <span className="text-sm font-medium text-slate-800">{r.name}</span>
                      <div className="text-xs text-slate-500">
                        <span className={r.total_qty === 0 ? 'text-red-600 font-semibold' : 'text-amber-600'}>
                          {r.total_qty}
                        </span>{' '}
                        / {r.reorder_level} reorder level
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setSearch(r.name);
                        setSearchParams({ search: r.name });
                      }}
                    >
                      Filter Batches
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Expiring soon"
            subtitle={`${exp.data?.length ?? 0} batch(es) within 90 days`}
            action={<Clock size={16} className="text-orange-500" />}
          />
          <CardBody>
            {exp.isLoading && (
              <div className="flex justify-center py-6">
                <Spinner size={22} />
              </div>
            )}
            {exp.data?.length === 0 && <EmptyState title="Nothing expiring soon" />}
            {exp.data && exp.data.length > 0 && (
              <ul className="divide-y divide-slate-100 max-h-60 overflow-y-auto">
                {exp.data.map((r) => (
                  <li key={r.batch_id} className="flex items-center justify-between py-2">
                    <div>
                      <div className="text-sm font-medium text-slate-800">{r.medicine_name}</div>
                      <div className="font-mono text-xs text-slate-500">Batch {r.batch_no}</div>
                    </div>
                    <div className="text-right">
                      <Badge tone={new Date(r.expiry_date) < new Date() ? 'red' : 'yellow'}>
                        {r.expiry_date}
                      </Badge>
                      <div className="mt-1 text-xs text-slate-500">{r.current_qty} in stock</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Main Batches & Stock Table */}
      <Card className="mt-6">
        <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          <div className="flex-1 max-w-md">
            <Input
              placeholder="Search by medicine name or batch number..."
              leftIcon={<Search size={15} />}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setSearchParams(e.target.value ? { search: e.target.value } : {});
              }}
            />
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer select-none">
              <input
                type="checkbox"
                className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                checked={onlyInStock}
                onChange={(e) => setOnlyInStock(e.target.checked)}
              />
              <span>In stock only</span>
            </label>
            {search && (
              <Button size="sm" variant="secondary" onClick={() => { setSearch(''); setSearchParams({}); }}>
                Clear Filter
              </Button>
            )}
          </div>
        </div>

        {batches.isLoading ? (
          <div className="flex justify-center py-12">
            <Spinner size={26} />
          </div>
        ) : filteredBatches.length === 0 ? (
          <div className="p-8">
            <EmptyState
              title="No batches found"
              description={search ? `No batches matching "${search}"` : 'No batches in inventory.'}
              action={
                canEditStock ? (
                  <Button onClick={() => { setNewBatchError(null); setNewBatchOpen(true); }}>
                    <Plus size={16} className="mr-1" /> Add New Batch
                  </Button>
                ) : undefined
              }
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3">Medicine</th>
                  <th className="px-5 py-3">Batch</th>
                  <th className="px-5 py-3">Expiry</th>
                  <th className="px-5 py-3 text-right">Current Stock</th>
                  <th className="px-5 py-3 text-right">MRP</th>
                  <th className="px-5 py-3 text-right">Selling</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredBatches.map((b) => {
                  const isOutOfStock = b.current_qty <= 0;
                  return (
                    <tr key={b.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-3">
                        <div className="font-medium text-slate-900">{b.medicines?.name}</div>
                        {b.medicines?.unit && (
                          <div className="text-xs text-slate-400">Unit: {b.medicines.unit}</div>
                        )}
                      </td>
                      <td className="px-5 py-3 font-mono text-xs text-slate-700">{b.batch_no}</td>
                      <td className="px-5 py-3 text-slate-600">
                        {b.expiry_date}
                        {new Date(b.expiry_date) < new Date() && (
                          <Badge tone="red" className="ml-2">Expired</Badge>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right font-mono">
                        {isOutOfStock ? (
                          <Badge tone="red">0 Out of Stock</Badge>
                        ) : (
                          <span className="font-semibold text-slate-900">{b.current_qty}</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right text-slate-600">
                        {b.mrp ? `Rs.${b.mrp}` : '-'}
                      </td>
                      <td className="px-5 py-3 text-right text-slate-600">
                        {b.selling_price ? `Rs.${b.selling_price}` : '-'}
                      </td>
                      <td className="px-5 py-3 text-right">
                        {canEditStock ? (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => openAdjust(b)}
                          >
                            <Edit3 size={14} className="mr-1 text-slate-500" /> Edit Stock
                          </Button>
                        ) : (
                          <span className="text-xs text-slate-400">View only</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Modal: Edit Stock */}
      {adjustBatch && (
        <Modal
          open={!!adjustBatch}
          onClose={() => setAdjustBatch(null)}
          title={`Edit Stock: ${adjustBatch.medicines?.name ?? 'Medicine'}`}
          size="md"
          footer={
            <>
              <Button variant="secondary" onClick={() => setAdjustBatch(null)}>
                Cancel
              </Button>
              <Button
                form="adjust-stock-form"
                type="submit"
                loading={adjustStock.isPending}
                disabled={currentDelta === 0 || newQty < 0}
              >
                Save Adjustment
              </Button>
            </>
          }
        >
          <form id="adjust-stock-form" onSubmit={handleAdjustSubmit} className="space-y-4">
            {adjustError && <Alert tone="error">{adjustError}</Alert>}

            {/* Info summary */}
            <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Batch:</span>
                <span className="font-mono font-medium text-slate-800">{adjustBatch.batch_no}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Expiry Date:</span>
                <span className="text-slate-800">{adjustBatch.expiry_date}</span>
              </div>
              <div className="flex justify-between pt-1 border-t border-slate-200">
                <span className="font-medium text-slate-700">Current Stock:</span>
                <span className="font-mono font-semibold text-slate-900">
                  {adjustBatch.current_qty} {adjustBatch.medicines?.unit ?? 'units'}
                </span>
              </div>
            </div>

            {/* New Stock Input */}
            <div>
              <Input
                label="New Stock Quantity *"
                type="number"
                min="0"
                step="1"
                value={newQty}
                onChange={(e) => setNewQty(Math.max(0, parseInt(e.target.value) || 0))}
                required
              />
              <div className="mt-2 flex flex-wrap gap-1.5 items-center text-xs">
                <span className="text-slate-500 mr-1">Quick adjust:</span>
                <button
                  type="button"
                  className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700"
                  onClick={() => handleQuickAdjust(1)}
                >
                  +1
                </button>
                <button
                  type="button"
                  className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700"
                  onClick={() => handleQuickAdjust(5)}
                >
                  +5
                </button>
                <button
                  type="button"
                  className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700"
                  onClick={() => handleQuickAdjust(10)}
                >
                  +10
                </button>
                <button
                  type="button"
                  className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700"
                  onClick={() => handleQuickAdjust(50)}
                >
                  +50
                </button>
                <button
                  type="button"
                  className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700"
                  onClick={() => handleQuickAdjust(-1)}
                >
                  -1
                </button>
                <button
                  type="button"
                  className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700"
                  onClick={() => handleQuickAdjust(-5)}
                >
                  -5
                </button>
                <button
                  type="button"
                  className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700"
                  onClick={() => handleQuickAdjust(-10)}
                >
                  -10
                </button>
              </div>
            </div>

            {/* Calculated adjustment status */}
            <div className="rounded border p-3 text-sm flex items-center justify-between">
              <span className="text-slate-600">Net Adjustment:</span>
              {currentDelta > 0 ? (
                <span className="font-semibold text-emerald-600">
                  +{currentDelta} units (Stock Increase)
                </span>
              ) : currentDelta < 0 ? (
                <span className="font-semibold text-amber-600">
                  {currentDelta} units (Stock Reduction)
                </span>
              ) : (
                <span className="text-slate-400">0 (No change)</span>
              )}
            </div>

            {/* Reason */}
            <div>
              <Select
                label="Reason for Adjustment *"
                value={reasonCategory}
                onChange={(e) => setReasonCategory(e.target.value)}
              >
                {REASON_CATEGORIES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <Input
                label="Additional Remarks / Notes"
                placeholder="e.g. Audit physically counted in shelf B2"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </form>
        </Modal>
      )}

      {/* Modal: New Batch / Initial Stock */}
      {newBatchOpen && (
        <Modal
          open={newBatchOpen}
          onClose={() => setNewBatchOpen(false)}
          title="Add New Batch & Initial Stock"
          size="lg"
          footer={
            <>
              <Button variant="secondary" onClick={() => setNewBatchOpen(false)}>
                Cancel
              </Button>
              <Button
                form="new-batch-form"
                type="submit"
                loading={createBatch.isPending}
              >
                Create Batch
              </Button>
            </>
          }
        >
          <form id="new-batch-form" onSubmit={handleCreateBatchSubmit} className="space-y-4">
            {newBatchError && <Alert tone="error">{newBatchError}</Alert>}

            <div>
              <Select
                label="Medicine *"
                value={newBatchMedId}
                onChange={(e) => setNewBatchMedId(e.target.value)}
                required
              >
                <option value="">Select a medicine...</option>
                {medicines.data?.rows.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} {m.unit ? `(${m.unit})` : ''}
                  </option>
                ))}
              </Select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Batch Number *"
                placeholder="e.g. BATCH-2026-A1"
                value={newBatchNo}
                onChange={(e) => setNewBatchNo(e.target.value)}
                required
              />
              <Input
                label="Expiry Date *"
                type="date"
                value={newBatchExpiry}
                onChange={(e) => setNewBatchExpiry(e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Initial Stock Quantity *"
                type="number"
                min="0"
                step="1"
                value={newBatchQty}
                onChange={(e) => setNewBatchQty(Math.max(0, parseInt(e.target.value) || 0))}
                required
              />
              <Input
                label="Purchase Price (Rs.)"
                type="number"
                min="0"
                step="0.01"
                placeholder="Optional"
                value={newBatchPurchase}
                onChange={(e) => setNewBatchPurchase(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Selling Price (Rs.)"
                type="number"
                min="0"
                step="0.01"
                placeholder="Optional"
                value={newBatchSelling}
                onChange={(e) => setNewBatchSelling(e.target.value)}
              />
              <Input
                label="MRP (Rs.)"
                type="number"
                min="0"
                step="0.01"
                placeholder="Optional"
                value={newBatchMrp}
                onChange={(e) => setNewBatchMrp(e.target.value)}
              />
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
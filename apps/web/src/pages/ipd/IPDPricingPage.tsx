import { useState } from 'react';
import { Plus, Pencil, Trash2, IndianRupee } from 'lucide-react';
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
import { useBranches } from '@/hooks/useBranches';
import { useIpdPricing, useCreateIpdPricing, useUpdateIpdPricing, useDeleteIpdPricing } from '@/hooks/useIpd';
import type { IpdPricing } from '@/repositories/ipd.repository';
import { PERMISSIONS } from '@medical/shared';
import { usePermissions } from '@/hooks/useAuth';

const CATEGORIES = ['WARD', 'ICU', 'CABIN', 'NURSING', 'SERVICE', 'PACKAGE', 'TAX'] as const;

export function IPDPricingPage() {
  const { can } = usePermissions();
  const branches = useBranches();
  
  const [branchId, setBranchId] = useState('');
  const [category, setCategory] = useState('');

  const pricing = useIpdPricing({
    branchId: branchId || undefined,
    category: category || undefined,
    isActive: true, // Only show active by default
  });

  const create = useCreateIpdPricing();
  const update = useUpdateIpdPricing();
  const del = useDeleteIpdPricing();

  const canManage = can(PERMISSIONS.IPD_MANAGE);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ category: 'NURSING', name: '', code: '', unitPrice: '', unit: 'per day' });
  const [error, setError] = useState<string | null>(null);

  const [editTarget, setEditTarget] = useState<IpdPricing | null>(null);
  const [editForm, setEditForm] = useState({ category: '', name: '', code: '', unitPrice: '', unit: '' });

  const [deleteTarget, setDeleteTarget] = useState<IpdPricing | null>(null);

  function reset() {
    setForm({ category: 'NURSING', name: '', code: '', unitPrice: '', unit: 'per day' });
    setError(null);
  }

  async function onSubmit() {
    setError(null);
    if (!form.name.trim() || !form.category || !form.unitPrice) {
      setError('Name, category, and price are required.');
      return;
    }
    try {
      await create.mutateAsync({
        branchId: branchId || undefined,
        category: form.category,
        name: form.name,
        code: form.code || null,
        unitPrice: Number(form.unitPrice),
        unit: form.unit || 'per day',
      });
      setOpen(false);
      reset();
    } catch (e: any) {
      setError(e?.message ?? 'Failed to create pricing item');
    }
  }

  function openEdit(p: IpdPricing) {
    setEditTarget(p);
    setEditForm({
      category: p.category,
      name: p.name,
      code: p.code || '',
      unitPrice: String(p.unit_price),
      unit: p.unit,
    });
  }

  async function onEditSubmit() {
    if (!editTarget || !editForm.name.trim() || !editForm.unitPrice) return;
    try {
      await update.mutateAsync({
        id: editTarget.id,
        input: {
          category: editForm.category,
          name: editForm.name,
          code: editForm.code || null,
          unitPrice: Number(editForm.unitPrice),
          unit: editForm.unit,
        },
      });
      setEditTarget(null);
    } catch (e: any) {
      alert(e?.message ?? 'Failed to update pricing item');
    }
  }

  async function onDeleteConfirm() {
    if (!deleteTarget) return;
    try {
      await del.mutateAsync(deleteTarget.id);
      setDeleteTarget(null);
    } catch (e: any) {
      alert(e?.message ?? 'Failed to delete pricing item');
    }
  }

  return (
    <>
      <PageHeader
        title="IPD Pricing & Services"
        subtitle="Manage billing catalog for inpatient department"
        action={
          canManage && (
            <Button onClick={() => setOpen(true)}>
              <Plus size={16} /> New pricing item
            </Button>
          )
        }
      />

      <div className="mb-6 flex flex-wrap gap-4">
        <div className="w-48">
          <Select label="Branch (optional)" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
            <option value="">Global (All Branches)</option>
            {branches.data?.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </Select>
        </div>
        <div className="w-48">
          <Select label="Category" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">All Categories</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </Select>
        </div>
      </div>

      {pricing.isLoading && (
        <div className="flex justify-center py-12"><Spinner size={28} /></div>
      )}
      {pricing.isError && (
        <Alert tone="error">Failed to load IPD pricing catalog.</Alert>
      )}

      {pricing.data && pricing.data.length === 0 && (
        <EmptyState
          title="No IPD pricing items"
          description="Create your IPD services and pricing catalog here."
          action={
            canManage && (
              <Button onClick={() => setOpen(true)}>
                <Plus size={16} /> New pricing item
              </Button>
            )
          }
        />
      )}

      {pricing.data && pricing.data.length > 0 && (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3">Item Details</th>
                <th className="px-5 py-3">Category</th>
                <th className="px-5 py-3 text-right">Unit Price (₹)</th>
                <th className="px-5 py-3">Unit</th>
                {canManage && <th className="px-5 py-3 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pricing.data.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3">
                    <div className="font-medium text-slate-900">{p.name}</div>
                    {p.code && <div className="text-xs text-slate-500 font-mono">Code: {p.code}</div>}
                  </td>
                  <td className="px-5 py-3">
                    <Badge tone={
                      p.category === 'WARD' ? 'blue' :
                      p.category === 'ICU' ? 'red' :
                      p.category === 'CABIN' ? 'purple' :
                      p.category === 'NURSING' ? 'green' : 'gray'
                    }>
                      {p.category}
                    </Badge>
                  </td>
                  <td className="px-5 py-3 text-right font-medium text-slate-700">
                    {p.unit_price.toFixed(2)}
                  </td>
                  <td className="px-5 py-3 text-slate-500 text-xs">
                    {p.unit}
                  </td>
                  {canManage && (
                    <td className="px-5 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => openEdit(p)}
                          className="rounded p-1 text-slate-400 hover:bg-blue-50 hover:text-blue-600"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(p)}
                          className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {/* Create Modal */}
      <Modal
        open={open}
        onClose={() => { setOpen(false); reset(); }}
        title="Add IPD Pricing Item"
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => { setOpen(false); reset(); }}>Cancel</Button>
            <Button onClick={onSubmit} loading={create.isPending}>Save item</Button>
          </>
        }
      >
        <div className="space-y-4">
          {error && <Alert tone="error">{error}</Alert>}
          <Select label="Category *" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
          <Input label="Name / Description *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Nursing charge (General Ward)" />
          <div className="flex gap-4">
            <div className="flex-1">
              <Input label="Unit Price (₹) *" type="number" value={form.unitPrice} onChange={(e) => setForm({ ...form, unitPrice: e.target.value })} placeholder="0.00" />
            </div>
            <div className="flex-1">
              <Input label="Unit" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="e.g. per day, per visit" />
            </div>
          </div>
          <Input label="Code (optional)" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="e.g. IPD-NUR-GEN" />
        </div>
      </Modal>

      {/* Edit Modal */}
      <Modal
        open={Boolean(editTarget)}
        onClose={() => setEditTarget(null)}
        title="Edit Pricing Item"
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditTarget(null)}>Cancel</Button>
            <Button onClick={onEditSubmit} loading={update.isPending}>Save changes</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Select label="Category *" value={editForm.category} onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
          <Input label="Name / Description *" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
          <div className="flex gap-4">
            <div className="flex-1">
              <Input label="Unit Price (₹) *" type="number" value={editForm.unitPrice} onChange={(e) => setEditForm({ ...editForm, unitPrice: e.target.value })} />
            </div>
            <div className="flex-1">
              <Input label="Unit" value={editForm.unit} onChange={(e) => setEditForm({ ...editForm, unit: e.target.value })} />
            </div>
          </div>
          <Input label="Code (optional)" value={editForm.code} onChange={(e) => setEditForm({ ...editForm, code: e.target.value })} />
        </div>
      </Modal>

      {/* Delete Modal */}
      <Modal
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="Delete Pricing Item?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="danger" onClick={onDeleteConfirm} loading={del.isPending}>Delete</Button>
          </>
        }
      >
        <Alert tone="error">
          You are about to delete <strong>{deleteTarget?.name}</strong>. It will be marked inactive and no longer available for billing.
        </Alert>
      </Modal>
    </>
  );
}

import { useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { useForm } from 'react-hook-form';
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
import { useBillableItems, useCreateBillableItem, useUpdateBillableItem } from '@/hooks/useBilling';
import type { BillableItem } from '@/repositories/billing.repository';

const CATEGORIES = [
  { value: 'CONSULTATION', label: 'Consultation' },
  { value: 'PROCEDURE',    label: 'Procedure' },
  { value: 'ROOM',         label: 'Room / Bed' },
  { value: 'SERVICE',      label: 'Service' },
  { value: 'OTHER',        label: 'Other' },
];

const empty = { name: '', code: '', category: 'CONSULTATION', price: '0', taxRate: '0' };

export function BillableItemsPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const list = useBillableItems({ search, page, pageSize: 50 });
  const create = useCreateBillableItem();
  const update = useUpdateBillableItem();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<BillableItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm<any>({ defaultValues: empty });

  function openCreate() { setEditing(null); reset(empty); setError(null); setOpen(true); }
  function openEdit(t: BillableItem) {
    setEditing(t);
    reset({
      name: t.name, code: t.code ?? '', category: t.category,
      price: String(t.price), taxRate: String(t.tax_rate),
    });
    setError(null); setOpen(true);
  }

  async function onSubmit(v: any) {
    setError(null);
    const payload = {
      name: v.name, code: v.code || null, category: v.category,
      price: Number(v.price ?? 0), taxRate: Number(v.taxRate ?? 0),
    };
    try {
      if (editing) await update.mutateAsync({ id: editing.id, patch: payload });
      else await create.mutateAsync(payload as any);
      setOpen(false);
    } catch (e: any) { setError(e?.message ?? 'Save failed'); }
  }

  const totalPages = list.data ? Math.max(1, Math.ceil(list.data.total / (list.data.pageSize || 50))) : 1;

  return (
    <>
      <PageHeader title="Billable Items" subtitle="Service catalog - consultation fees, procedures, room charges"
        action={<Button onClick={openCreate}><Plus size={16} /> New item</Button>} />

      <div className="mb-4 max-w-md">
        <Input placeholder="Search by name or code" leftIcon={<Search size={14} />}
          value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
      </div>

      {list.isLoading && <div className="flex justify-center py-12"><Spinner size={28} /></div>}
      {list.isError && <Alert tone="error">Failed to load items.</Alert>}

      {list.data?.rows.length === 0 && (
        <EmptyState title="No items yet" description="Add services to bill patients"
          action={<Button onClick={openCreate}><Plus size={16} /> New item</Button>} />
      )}

      {list.data && list.data.rows.length > 0 && (
        <>
          <Card className="overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3">Name</th>
                  <th className="px-5 py-3">Code</th>
                  <th className="px-5 py-3">Category</th>
                  <th className="px-5 py-3 text-right">Price</th>
                  <th className="px-5 py-3 text-right">Tax</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {list.data.rows.map((it) => (
                  <tr key={it.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3 font-medium text-slate-900">{it.name}</td>
                    <td className="px-5 py-3 font-mono text-xs text-slate-500">{it.code ?? '-'}</td>
                    <td className="px-5 py-3 text-slate-600"><Badge tone="blue">{it.category}</Badge></td>
                    <td className="px-5 py-3 text-right font-mono">Rs.{it.price.toFixed(2)}</td>
                    <td className="px-5 py-3 text-right text-slate-600">{it.tax_rate}%</td>
                    <td className="px-5 py-3 text-right">
                      <Button size="sm" variant="secondary" onClick={() => openEdit(it)}>Edit</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
            <span>{list.data.total} item{list.data.total === 1 ? '' : 's'} | page {list.data.page} of {totalPages}</span>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
              <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          </div>
        </>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Edit item' : 'New billable item'} size="md"
        footer={<><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
          <Button form="bill-form" type="submit" loading={isSubmitting}>{editing ? 'Save' : 'Create'}</Button></>}>
        <form id="bill-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {error && <Alert tone="error">{error}</Alert>}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Input label="Name *" placeholder="General Consultation" {...register('name', { required: true })} />
            <Input label="Code" placeholder="CONS-GEN" {...register('code')} />
            <Select label="Category *" {...register('category', { required: true })}>
              {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </Select>
            <Input label="Price (Rs.)" type="number" step="0.01" {...register('price')} />
            <Input label="Tax rate (%)" type="number" step="0.01" {...register('taxRate')} />
          </div>
        </form>
      </Modal>
    </>
  );
}

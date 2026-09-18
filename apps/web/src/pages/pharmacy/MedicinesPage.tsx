import { useState } from 'react';
import { Plus, Search, Printer } from 'lucide-react';
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
import { useMedicines, useCreateMedicine, useUpdateMedicine } from '@/hooks/usePharmacy';
import type { Medicine } from '@/repositories/pharmacy.repository';
import { PrintPreviewModal } from '@/components/PrintPreviewModal';
import { BarcodePrintSheet } from '@/components/print/BarcodePrintSheet';
import { useOrganization } from '@/hooks/useOrganization';

const CATEGORIES = ['Tablet','Capsule','Syrup','Injection','Ointment','Drops','Inhaler','Other'];
const UNITS = ['tab','cap','ml','vial','sachet','tube','bottle'];

const emptyForm = {
  name: '', code: '', barcode: '', genericName: '', manufacturer: '', category: 'Tablet',
  unit: 'tab', hsnCode: '', gstRate: '12', reorderLevel: '10',
};

export function MedicinesPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const list = useMedicines({ search, page, pageSize: 20 });
  const create = useCreateMedicine();
  const update = useUpdateMedicine();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Medicine | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [printOpen, setPrintOpen] = useState(false);
  const organization = useOrganization();

  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm<any>({
    defaultValues: emptyForm,
  });

  function openCreate() {
    setEditing(null); reset(emptyForm); setError(null); setOpen(true);
  }
  function openEdit(m: Medicine) {
    setEditing(m);
    reset({
      name: m.name, code: m.code ?? '', barcode: (m as any).barcode ?? '', genericName: m.generic_name ?? '',
      manufacturer: m.manufacturer ?? '', category: m.category ?? 'Tablet',
      unit: m.unit ?? 'tab', hsnCode: m.hsn_code ?? '',
      gstRate: String(m.gst_rate ?? '12'), reorderLevel: String(m.reorder_level),
    });
    setError(null); setOpen(true);
  }

  async function onSubmit(values: any) {
    setError(null);
    const payload = {
      name: values.name, code: values.code || null,
      barcode: values.barcode || null,
      genericName: values.genericName || null, manufacturer: values.manufacturer || null,
      category: values.category || null, unit: values.unit || null,
      hsnCode: values.hsnCode || null,
      gstRate: values.gstRate ? Number(values.gstRate) : 0,
      reorderLevel: Number(values.reorderLevel ?? 10),
    };
    try {
      if (editing) await update.mutateAsync({ id: editing.id, patch: payload });
      else await create.mutateAsync(payload as any);
      setOpen(false);
    } catch (e: any) { setError(e?.message ?? 'Save failed'); }
  }

  const totalPages = list.data ? Math.max(1, Math.ceil(list.data.total / (list.data.pageSize || 20))) : 1;

  return (
    <>
      <PageHeader
        title="Medicines"
        subtitle="Medicine master list"
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              onClick={() => setPrintOpen(true)}
              disabled={!list.data?.rows.length}
            >
              <Printer size={16} /> Print barcodes
            </Button>
            <Button onClick={openCreate}><Plus size={16} /> New medicine</Button>
          </div>
        }
      />

      <div className="mb-4 max-w-md">
        <Input placeholder="Search by name, generic or code" leftIcon={<Search size={14} />}
          value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
      </div>

      {list.isLoading && <div className="flex justify-center py-12"><Spinner size={28} /></div>}
      {list.isError && <Alert tone="error">Failed to load medicines.</Alert>}

      {list.data?.rows.length === 0 && (
        <EmptyState title="No medicines yet" description="Add medicines to your catalog to begin"
          action={<Button onClick={openCreate}><Plus size={16} /> New medicine</Button>} />
      )}

      {list.data && list.data.rows.length > 0 && (
        <>
          <Card className="overflow-x-auto overflow-y-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3">Name</th>
                  <th className="px-5 py-3">Barcode</th>
                  <th className="px-5 py-3">Generic</th>
                  <th className="px-5 py-3">Category</th>
                  <th className="px-5 py-3">Unit</th>
                  <th className="px-5 py-3">GST</th>
                  <th className="px-5 py-3">Reorder</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {list.data.rows.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3 font-medium text-slate-900">{m.name}</td>
                    <td className="px-5 py-3 font-mono text-xs text-slate-600">{(m as any).barcode ?? '-'}</td>
                    <td className="px-5 py-3 text-slate-600">{m.generic_name ?? '-'}</td>
                    <td className="px-5 py-3 text-slate-600">{m.category ? <Badge tone="blue">{m.category}</Badge> : '-'}</td>
                    <td className="px-5 py-3 text-slate-600">{m.unit ?? '-'}</td>
                    <td className="px-5 py-3 text-slate-600">{m.gst_rate}%</td>
                    <td className="px-5 py-3 text-slate-600">{m.reorder_level}</td>
                    <td className="px-5 py-3 text-right">
                      <Button size="sm" variant="secondary" onClick={() => openEdit(m)}>Edit</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
            <span>{list.data.total} medicine{list.data.total === 1 ? '' : 's'} | page {list.data.page} of {totalPages}</span>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
              <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          </div>
        </>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Edit medicine' : 'New medicine'} size="lg"
        footer={<><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
          <Button form="med-form" type="submit" loading={isSubmitting}>{editing ? 'Save' : 'Create'}</Button></>}>
        <form id="med-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {error && <Alert tone="error">{error}</Alert>}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Input label="Name *" placeholder="Paracetamol 500mg" {...register('name', { required: true })} />
            <Input label="Code / SKU" {...register('code')} />
            <Input
              label="Barcode"
              placeholder="Leave blank to auto-generate (e.g. MED-000123)"
              {...register('barcode')}
            />
            <Input label="Generic name" {...register('genericName')} />
            <Input label="Manufacturer" {...register('manufacturer')} />
            <Select label="Category" {...register('category')}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
            <Select label="Unit" {...register('unit')}>
              {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
            </Select>
            <Input label="HSN code" {...register('hsnCode')} />
            <Input label="GST rate (%)" {...register('gstRate')} />
            <Input label="Reorder level" type="number" {...register('reorderLevel')} />
          </div>
        </form>
      </Modal>

      {printOpen && (
        <PrintPreviewModal
          open={printOpen}
          onClose={() => setPrintOpen(false)}
          title="Medicine Barcodes"
        >
          <BarcodePrintSheet
            organizationName={organization.data?.name}
            medicines={(list.data?.rows ?? []).map((m) => ({
              id: m.id,
              name: m.name,
              barcode: (m as any).barcode ?? null,
              generic_name: m.generic_name,
            }))}
          />
        </PrintPreviewModal>
      )}
    </>
  );
}
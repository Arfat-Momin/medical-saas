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
import { useLabTests, useCreateLabTest, useUpdateLabTest } from '@/hooks/useLaboratory';
import type { LabTest } from '@/repositories/laboratory.repository';

const CATEGORIES = ['Hematology','Biochemistry','Microbiology','Serology','Urine','Pathology','Radiology','Other'];
const SAMPLE_TYPES = ['Blood','Serum','Plasma','Urine','Stool','Swab','Sputum','Other'];

const empty = {
  name: '', code: '', category: 'Biochemistry', sampleType: 'Blood',
  unit: '', referenceMin: '', referenceMax: '', referenceText: '',
  price: '0', turnaroundHrs: '24',
};

export function LabTestsPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const list = useLabTests({ search, page, pageSize: 20 });
  const create = useCreateLabTest();
  const update = useUpdateLabTest();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<LabTest | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm<any>({ defaultValues: empty });

  function openCreate() { setEditing(null); reset(empty); setError(null); setOpen(true); }
  function openEdit(t: LabTest) {
    setEditing(t);
    reset({
      name: t.name, code: t.code ?? '', category: t.category ?? 'Biochemistry',
      sampleType: t.sample_type ?? 'Blood', unit: t.unit ?? '',
      referenceMin: t.reference_min?.toString() ?? '', referenceMax: t.reference_max?.toString() ?? '',
      referenceText: t.reference_text ?? '', price: String(t.price), turnaroundHrs: String(t.turnaround_hrs),
    });
    setError(null); setOpen(true);
  }

  async function onSubmit(v: any) {
    setError(null);
    const payload = {
      name: v.name, code: v.code || null, category: v.category || null,
      sampleType: v.sampleType || null, unit: v.unit || null,
      referenceMin: v.referenceMin ? Number(v.referenceMin) : null,
      referenceMax: v.referenceMax ? Number(v.referenceMax) : null,
      referenceText: v.referenceText || null,
      price: Number(v.price ?? 0), turnaroundHrs: Number(v.turnaroundHrs ?? 24),
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
      <PageHeader title="Lab Tests" subtitle="Test catalog with reference ranges"
        action={<Button onClick={openCreate}><Plus size={16} /> New test</Button>} />

      <div className="mb-4 max-w-md">
        <Input placeholder="Search by name, code or category" leftIcon={<Search size={14} />}
          value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
      </div>

      {list.isLoading && <div className="flex justify-center py-12"><Spinner size={28} /></div>}
      {list.isError && <Alert tone="error">Failed to load tests.</Alert>}

      {list.data?.rows.length === 0 && (
        <EmptyState title="No tests yet" description="Add tests to your catalog to order them"
          action={<Button onClick={openCreate}><Plus size={16} /> New test</Button>} />
      )}

      {list.data && list.data.rows.length > 0 && (
        <>
          <Card className="overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3">Name</th>
                  <th className="px-5 py-3">Category</th>
                  <th className="px-5 py-3">Sample</th>
                  <th className="px-5 py-3">Reference</th>
                  <th className="px-5 py-3 text-right">Price</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {list.data.rows.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3">
                      <div className="font-medium text-slate-900">{t.name}</div>
                      {t.code && <div className="font-mono text-xs text-slate-500">{t.code}</div>}
                    </td>
                    <td className="px-5 py-3 text-slate-600">{t.category ? <Badge tone="blue">{t.category}</Badge> : '-'}</td>
                    <td className="px-5 py-3 text-slate-600">{t.sample_type ?? '-'}</td>
                    <td className="px-5 py-3 text-slate-600 text-xs">
                      {t.reference_text || (t.reference_min != null && t.reference_max != null
                        ? `${t.reference_min} - ${t.reference_max} ${t.unit ?? ''}`
                        : '-')}
                    </td>
                    <td className="px-5 py-3 text-right font-mono">Rs.{t.price.toFixed(2)}</td>
                    <td className="px-5 py-3 text-right">
                      <Button size="sm" variant="secondary" onClick={() => openEdit(t)}>Edit</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
            <span>{list.data.total} test{list.data.total === 1 ? '' : 's'} | page {list.data.page} of {totalPages}</span>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
              <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          </div>
        </>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Edit test' : 'New test'} size="lg"
        footer={<><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
          <Button form="test-form" type="submit" loading={isSubmitting}>{editing ? 'Save' : 'Create'}</Button></>}>
        <form id="test-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {error && <Alert tone="error">{error}</Alert>}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Input label="Name *" placeholder="Hemoglobin" {...register('name', { required: true })} />
            <Input label="Code" placeholder="HGB" {...register('code')} />
            <Select label="Category" {...register('category')}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
            <Select label="Sample type" {...register('sampleType')}>
              {SAMPLE_TYPES.map((s) => <option key={s} value={s}>{s}</option>)}
            </Select>
            <Input label="Unit" placeholder="g/dL" {...register('unit')} />
            <Input label="Price (Rs.)" type="number" step="0.01" {...register('price')} />
            <Input label="Reference min" type="number" step="0.01" {...register('referenceMin')} />
            <Input label="Reference max" type="number" step="0.01" {...register('referenceMax')} />
            <Input label="Reference text (optional)" placeholder="Negative / 0-5 /hpf" {...register('referenceText')} />
            <Input label="Turnaround (hours)" type="number" {...register('turnaroundHrs')} />
          </div>
        </form>
      </Modal>
    </>
  );
}

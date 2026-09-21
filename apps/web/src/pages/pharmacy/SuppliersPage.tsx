import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { Alert } from '@/components/ui/Alert';
import { Spinner } from '@/components/ui/Spinner';
import { useSuppliers, useCreateSupplier } from '@/hooks/usePharmacy';

const empty = { name: '', code: '', contactPerson: '', phone: '', email: '', address: '', gstin: '' };

export function SuppliersPage() {
  const list = useSuppliers();
  const create = useCreateSupplier();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm<any>({ defaultValues: empty });

  async function onSubmit(v: any) {
    setError(null);
    try {
      await create.mutateAsync({
        name: v.name, code: v.code || null, contactPerson: v.contactPerson || null,
        phone: v.phone || null, email: v.email || null, address: v.address || null, gstin: v.gstin || null,
      } as any);
      reset(empty); setOpen(false);
    } catch (e: any) { setError(e?.message ?? 'Failed'); }
  }

  return (
    <>
      <PageHeader title="Suppliers" subtitle="Vendors and distributors"
        action={<Button onClick={() => setOpen(true)}><Plus size={16} /> New supplier</Button>} />

      {list.isLoading && <div className="flex justify-center py-12"><Spinner size={28} /></div>}
      {list.isError && <Alert tone="error">Failed to load suppliers.</Alert>}

      {list.data?.length === 0 && (
        <EmptyState title="No suppliers yet" description="Add suppliers to record purchases"
          action={<Button onClick={() => setOpen(true)}><Plus size={16} /> New supplier</Button>} />
      )}

      {list.data && list.data.length > 0 && (
        <Card className="overflow-x-auto overflow-y-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3">Name</th>
                <th className="px-5 py-3">Contact</th>
                <th className="px-5 py-3">Phone</th>
                <th className="px-5 py-3">GSTIN</th>
                <th className="px-5 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {list.data.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3 font-medium text-slate-900">{s.name}</td>
                  <td className="px-5 py-3 text-slate-600">{s.contact_person ?? '-'}</td>
                  <td className="px-5 py-3 text-slate-600">{s.phone ?? '-'}</td>
                  <td className="px-5 py-3 font-mono text-xs text-slate-600">{s.gstin ?? '-'}</td>
                  <td className="px-5 py-3"><Badge tone={s.is_active ? 'green' : 'gray'}>{s.is_active ? 'Active' : 'Inactive'}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="New supplier" size="lg"
        footer={<><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
          <Button form="sup-form" type="submit" loading={isSubmitting}>Create</Button></>}>
        <form id="sup-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {error && <Alert tone="error">{error}</Alert>}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Input label="Name *" placeholder="ABC Pharma Distributors" {...register('name', { required: true })} />
            <Input label="Code" {...register('code')} />
            <Input label="Contact person" {...register('contactPerson')} />
            <Input label="Phone" {...register('phone')} />
            <Input label="Email" type="email" {...register('email')} />
            <Input label="GSTIN" {...register('gstin')} />
            <Input label="Address" className="md:col-span-2" {...register('address')} />
          </div>
        </form>
      </Modal>
    </>
  );
}
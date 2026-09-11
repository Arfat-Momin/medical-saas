import { useState } from 'react';
import { Plus } from 'lucide-react';
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
import { usePlans, useCreatePlan, useUpdatePlan } from '@/hooks/usePlatform';
import type { Plan } from '@/repositories/platform.repository';

const empty = { code: '', name: '', pricePaise: '99900', billingCycle: 'MONTHLY', maxBranches: '3', maxUsers: '20' };

export function PlansPage() {
  const list = usePlans();
  const create = useCreatePlan();
  const update = useUpdatePlan();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Plan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm<any>({ defaultValues: empty });

  function openCreate() { setEditing(null); reset(empty); setError(null); setOpen(true); }
  function openEdit(p: Plan) {
    setEditing(p);
    reset({
      code: p.code, name: p.name,
      pricePaise: String(p.price_paise),
      billingCycle: p.billing_cycle,
      maxBranches: String(p.max_branches),
      maxUsers: String(p.max_users),
    });
    setError(null); setOpen(true);
  }

  async function onSubmit(v: any) {
    setError(null);
    const payload = {
      code: v.code,
      name: v.name,
      pricePaise: Number(v.pricePaise),
      billingCycle: v.billingCycle,
      maxBranches: Number(v.maxBranches),
      maxUsers: Number(v.maxUsers),
    };
    try {
      if (editing) await update.mutateAsync({ id: editing.id, patch: payload });
      else await create.mutateAsync(payload);
      setOpen(false);
    } catch (e: any) { setError(e?.message ?? 'Save failed'); }
  }

  async function toggleActive(p: Plan) {
    try { await update.mutateAsync({ id: p.id, patch: { isActive: !p.is_active } }); }
    catch (e: any) { alert(e?.message ?? 'Failed'); }
  }

  return (
    <>
      <PageHeader
        title="Subscription Plans"
        subtitle="Data-driven plans - no hard-coded tiering"
        action={<Button onClick={openCreate}><Plus size={16} /> New plan</Button>}
      />

      {list.isLoading && <div className="flex justify-center py-12"><Spinner size={28} /></div>}
      {list.isError && <Alert tone="error">Failed to load plans.</Alert>}

      {list.data?.length === 0 && (
        <EmptyState title="No plans yet" description="Create your first subscription plan."
          action={<Button onClick={openCreate}><Plus size={16} /> New plan</Button>} />
      )}

      {list.data && list.data.length > 0 && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {list.data.map((p) => (
            <Card key={p.id}>
              <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4">
                <div>
                  <h3 className="font-semibold text-slate-900">{p.name}</h3>
                  <p className="font-mono text-xs text-slate-500">{p.code}</p>
                </div>
                <Badge tone={p.is_active ? 'green' : 'gray'}>
                  {p.is_active ? 'Active' : 'Disabled'}
                </Badge>
              </div>
              <div className="space-y-3 px-5 py-4">
                <div className="text-2xl font-semibold text-slate-900">
                  Rs.{(p.price_paise / 100).toFixed(0)}
                  <span className="text-sm font-normal text-slate-500">
                    {' '}/ {p.billing_cycle === 'MONTHLY' ? 'month' : 'year'}
                  </span>
                </div>
                <ul className="space-y-1 text-sm text-slate-600">
                  <li>Up to {p.max_branches} branch(es)</li>
                  <li>Up to {p.max_users} user(s)</li>
                </ul>
                <div className="flex gap-2 pt-2">
                  <Button variant="secondary" size="sm" onClick={() => openEdit(p)}>Edit</Button>
                  <Button variant={p.is_active ? 'ghost' : 'primary'} size="sm" onClick={() => toggleActive(p)}>
                    {p.is_active ? 'Disable' : 'Enable'}
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Edit plan' : 'New plan'} size="md"
        footer={<><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
          <Button form="plan-form" type="submit" loading={isSubmitting}>{editing ? 'Save' : 'Create'}</Button></>}>
        <form id="plan-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {error && <Alert tone="error">{error}</Alert>}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Input label="Code *" placeholder="BASIC" {...register('code', { required: true, disabled: !!editing })} />
            <Input label="Name *" placeholder="Basic" {...register('name', { required: true })} />
            <Input label="Price (paise) *" type="number" {...register('pricePaise', { required: true })} />
            <Select label="Billing cycle *" {...register('billingCycle')}>
              <option value="MONTHLY">Monthly</option>
              <option value="YEARLY">Yearly</option>
            </Select>
            <Input label="Max branches" type="number" {...register('maxBranches')} />
            <Input label="Max users" type="number" {...register('maxUsers')} />
          </div>
          <p className="text-xs text-slate-500">
            Note: price is stored in paise. 99900 = Rs.999.
          </p>
        </form>
      </Modal>
    </>
  );
}

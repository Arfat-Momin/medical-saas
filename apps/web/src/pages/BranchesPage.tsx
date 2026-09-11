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
import { useBranches, useCreateBranch } from '@/hooks/useBranches';
import { usePermissions } from '@/hooks/useAuth';
import { PERMISSIONS } from '@medical/shared';

interface FormValues {
  name: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  phone: string;
}

export function BranchesPage() {
  const { data, isLoading, isError } = useBranches(false);
  const createBranch = useCreateBranch();
  const { can } = usePermissions();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm<FormValues>({
    defaultValues: { name: '', address: '', city: '', state: '', pincode: '', phone: '' },
  });

  const canManage = can(PERMISSIONS.BRANCH_MANAGE);

  async function onSubmit(values: FormValues) {
    setError(null);
    try {
      await createBranch.mutateAsync({
        name: values.name,
        address: values.address || null,
        city: values.city || null,
        state: values.state || null,
        pincode: values.pincode || null,
        phone: values.phone || null,
      });
      reset();
      setOpen(false);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to create branch');
    }
  }

  return (
    <>
      <PageHeader
        title="Branches"
        subtitle="Locations within your organization"
        action={
          canManage && (
            <Button onClick={() => setOpen(true)}>
              <Plus size={16} /> New branch
            </Button>
          )
        }
      />

      {isLoading && <div className="flex justify-center py-12"><Spinner size={28} /></div>}
      {isError && <Alert tone="error">Failed to load branches.</Alert>}

      {data?.length === 0 && (
        <EmptyState
          title="No branches yet"
          description="Create your first branch to start adding departments and users."
          action={canManage && <Button onClick={() => setOpen(true)}><Plus size={16} /> New branch</Button>}
        />
      )}

      {data && data.length > 0 && (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3">Code</th>
                  <th className="px-5 py-3">Name</th>
                  <th className="px-5 py-3">City</th>
                  <th className="px-5 py-3">State</th>
                  <th className="px-5 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3 font-mono text-xs text-slate-600">{b.branch_code}</td>
                    <td className="px-5 py-3 font-medium text-slate-900">{b.name}</td>
                    <td className="px-5 py-3 text-slate-600">{b.city ?? '-'}</td>
                    <td className="px-5 py-3 text-slate-600">{b.state ?? '-'}</td>
                    <td className="px-5 py-3">
                      <Badge tone={b.is_active ? 'green' : 'gray'}>
                        {b.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Modal
        open={open}
        onClose={() => { setOpen(false); reset(); setError(null); }}
        title="Create branch"
        footer={
          <>
            <Button variant="secondary" onClick={() => { setOpen(false); reset(); }}>Cancel</Button>
            <Button form="branch-form" type="submit" loading={isSubmitting}>Create</Button>
          </>
        }
      >
        <form id="branch-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {error && <Alert tone="error">{error}</Alert>}
          <Input label="Name" placeholder="Pune Branch" {...register('name', { required: true })} />
          <Input label="Address" {...register('address')} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="City" {...register('city')} />
            <Input label="State" {...register('state')} />
            <Input label="Pincode" {...register('pincode')} />
            <Input label="Phone" {...register('phone')} />
          </div>
        </form>
      </Modal>
    </>
  );
}
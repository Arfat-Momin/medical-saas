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
import { useBranches } from '@/hooks/useBranches';
import { useDepartments, useCreateDepartment } from '@/hooks/useDepartments';
import { usePermissions } from '@/hooks/useAuth';
import { PERMISSIONS } from '@medical/shared';

interface FormValues { branchId: string; name: string }

export function DepartmentsPage() {
  const branches = useBranches();
  const [branchFilter, setBranchFilter] = useState<string>('');
  const departments = useDepartments(branchFilter || undefined);
  const createDept = useCreateDepartment();
  const { can } = usePermissions();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm<FormValues>({
    defaultValues: { branchId: '', name: '' },
  });

  const canManage = can(PERMISSIONS.DEPARTMENT_MANAGE);

  async function onSubmit(values: FormValues) {
    setError(null);
    try {
      await createDept.mutateAsync(values);
      reset();
      setOpen(false);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to create department');
    }
  }

  return (
    <>
      <PageHeader
        title="Departments"
        subtitle="Clinical and operational units within each branch"
        action={
          canManage && (
            <Button onClick={() => setOpen(true)} disabled={!branches.data?.length}>
              <Plus size={16} /> New department
            </Button>
          )
        }
      />

      <div className="mb-4 max-w-xs">
        <Select
          label="Filter by branch"
          value={branchFilter}
          onChange={(e) => setBranchFilter(e.target.value)}
        >
          <option value="">All branches</option>
          {branches.data?.map((b) => (
            <option key={b.id} value={b.id}>{b.name} ({b.branch_code})</option>
          ))}
        </Select>
      </div>

      {departments.isLoading && <div className="flex justify-center py-12"><Spinner size={28} /></div>}
      {departments.isError && <Alert tone="error">Failed to load departments.</Alert>}

      {departments.data?.length === 0 && (
        <EmptyState
          title="No departments yet"
          description="Create a department under a branch to organize your clinical services."
        />
      )}

      {departments.data && departments.data.length > 0 && (
        <Card className="overflow-x-auto overflow-y-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3">Name</th>
                <th className="px-5 py-3">Branch</th>
                <th className="px-5 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {departments.data.map((d) => {
                const b = branches.data?.find((x) => x.id === d.branch_id);
                return (
                  <tr key={d.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3 font-medium text-slate-900">{d.name}</td>
                    <td className="px-5 py-3 text-slate-600">{b?.name ?? '-'}</td>
                    <td className="px-5 py-3">
                      <Badge tone={d.is_active ? 'green' : 'gray'}>
                        {d.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      <Modal
        open={open}
        onClose={() => { setOpen(false); reset(); setError(null); }}
        title="Create department"
        footer={
          <>
            <Button variant="secondary" onClick={() => { setOpen(false); reset(); }}>Cancel</Button>
            <Button form="dept-form" type="submit" loading={isSubmitting}>Create</Button>
          </>
        }
      >
        <form id="dept-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {error && <Alert tone="error">{error}</Alert>}
          <Select label="Branch" {...register('branchId', { required: true })}>
            <option value="">Select a branch</option>
            {branches.data?.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </Select>
          <Input label="Name" placeholder="Cardiology" {...register('name', { required: true })} />
        </form>
      </Modal>
    </>
  );
}
import { useState } from 'react';
import { Search, UserPlus, Info, Eye, EyeOff } from 'lucide-react';
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
import { useRoles } from '@/hooks/useRoles';
import { useUsers, useInviteUser } from '@/hooks/useUsers';
import { usePermissions } from '@/hooks/useAuth';
import { PERMISSIONS } from '@medical/shared';
import type { InviteUserResponse } from '@/repositories/users.repository';

interface FormValues {
  email: string;
  fullName: string;
  phone: string;
  roleCode: string;
  branchId: string;
  password: string;
}

export function UsersPage() {
  const branches = useBranches();
  const roles = useRoles();
  const { can } = usePermissions();
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [page, setPage] = useState(1);
  const users = useUsers({ page, pageSize: 10, search, roleCode: roleFilter || undefined });
  const invite = useInviteUser();

  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invited, setInvited] = useState<InviteUserResponse | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm<FormValues>({
    defaultValues: { email: '', fullName: '', phone: '', roleCode: '', branchId: '', password: '' },
  });

  const canManage = can(PERMISSIONS.USER_MANAGE);

  async function onSubmit(values: FormValues) {
    setError(null);
    try {
      const res = await invite.mutateAsync({
        email: values.email,
        fullName: values.fullName,
        phone: values.phone || null,
        roleCode: values.roleCode,
        branchId: values.branchId || null,
        password: values.password,
      });
      setInvited(res);
      reset();
      setOpen(false);
      setShowPassword(false);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to invite user');
    }
  }

  const totalPages = users.data
    ? Math.max(1, Math.ceil(users.data.total / (users.data.pageSize || 10)))
    : 1;

  return (
    <>
      <PageHeader
        title="Users"
        subtitle="Staff accounts in your organization"
        action={
          canManage && (
            <Button onClick={() => setOpen(true)}>
              <UserPlus size={16} /> Invite user
            </Button>
          )
        }
      />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="w-full max-w-xs">
          <Input
            placeholder="Search by name or email"
            leftIcon={<Search size={14} />}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <div className="w-full sm:w-48">
          <Select value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}>
            <option value="">All roles</option>
            {roles.data?.map((r) => (
              <option key={r.id} value={r.code}>{r.name}</option>
            ))}
          </Select>
        </div>
      </div>

      {users.isLoading && <div className="flex justify-center py-12"><Spinner size={28} /></div>}
      {users.isError && <Alert tone="error">Failed to load users.</Alert>}

      {users.data?.rows.length === 0 && (
        <EmptyState
          title="No users yet"
          description="Invite staff to give them access to your organization."
        />
      )}

      {users.data && users.data.rows.length > 0 && (
        <>
          <Card className="overflow-x-auto overflow-y-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3">Name</th>
                  <th className="px-5 py-3">Email</th>
                  <th className="px-5 py-3">Role</th>
                  <th className="px-5 py-3">Branch</th>
                  <th className="px-5 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.data.rows.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3 font-medium text-slate-900">{r.users.full_name}</td>
                    <td className="px-5 py-3 text-slate-600">{r.users.email}</td>
                    <td className="px-5 py-3">
                      <Badge tone="blue">{r.roles.name}</Badge>
                    </td>
                    <td className="px-5 py-3 text-slate-600">
                      {r.branches ? `${r.branches.name} (${r.branches.branch_code})` : 'All branches'}
                    </td>
                    <td className="px-5 py-3">
                      <Badge tone={r.users.is_active ? 'green' : 'gray'}>
                        {r.users.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
            <span>
              {users.data.total} user{users.data.total === 1 ? '' : 's'} | page {users.data.page} of {totalPages}
            </span>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Button>
              <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                Next
              </Button>
            </div>
          </div>
        </>
      )}

      {/* Invite user modal */}
      <Modal
        open={open}
        onClose={() => { setOpen(false); reset(); setError(null); setShowPassword(false); }}
        title="Invite user"
        footer={
          <>
            <Button variant="secondary" onClick={() => { setOpen(false); reset(); }}>Cancel</Button>
            <Button form="invite-form" type="submit" loading={isSubmitting}>Send invite</Button>
          </>
        }
      >
        <form id="invite-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {error && <Alert tone="error">{error}</Alert>}
          <Input label="Full name" placeholder="Dr. Anita Rao" {...register('fullName', { required: true })} />
          <Input label="Email" type="email" placeholder="anita@hospital.com" {...register('email', { required: true })} />
          <Input label="Phone" {...register('phone')} />
          <Input
            label="Password"
            type={showPassword ? 'text' : 'password'}
            placeholder="At least 8 characters"
            autoComplete="new-password"
            rightSlot={
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowPassword((v) => !v)}
                className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            }
            {...register('password', { required: true, minLength: 8 })}
          />
          <Select label="Role" {...register('roleCode', { required: true })}>
            <option value="">Select a role</option>
            {roles.data?.map((r) => (
              <option key={r.id} value={r.code}>{r.name}</option>
            ))}
          </Select>
          <Select label="Branch (optional)" {...register('branchId')}>
            <option value="">All branches</option>
            {branches.data?.map((b) => (
              <option key={b.id} value={b.id}>{b.name} ({b.branch_code})</option>
            ))}
          </Select>
        </form>
      </Modal>

      {/* Result modal - two flavours */}
      <Modal
        open={Boolean(invited)}
        onClose={() => setInvited(null)}
        title={invited?.existingUser ? 'User added to your hospital' : 'User invited'}
        footer={<Button onClick={() => setInvited(null)}>Done</Button>}
      >
        {invited && (
          <div className="space-y-3">
            {invited.existingUser ? (
              <>
                <Alert tone="success">
                  <strong>{invited.fullName}</strong> ({invited.email}) already had a platform
                  account and has been added to your hospital as{' '}
                  <strong>{invited.roleCode}</strong>.
                </Alert>
                <Alert tone="info">
                  <div className="flex items-start gap-2">
                    <Info size={16} className="mt-0.5 shrink-0" />
                    <div className="text-sm">
                      They keep the password they already use. The next time they sign in they
                      will be able to switch to your hospital from the tenant picker.
                    </div>
                  </div>
                </Alert>
              </>
            ) : (
              <>
                <Alert tone="success">
                  <strong>{invited.fullName}</strong> ({invited.email}) has been invited as{' '}
                  <strong>{invited.roleCode}</strong>.
                </Alert>
                <Alert tone="info">
                  <div className="flex items-start gap-2">
                    <Info size={16} className="mt-0.5 shrink-0" />
                    <div className="text-sm">
                      Share the password you just set with them securely. They use that password
                      to sign in. Only an administrator can change it later.
                    </div>
                  </div>
                </Alert>
              </>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}
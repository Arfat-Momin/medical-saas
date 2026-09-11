import { useState } from 'react';
import { Save, Shield } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { PageHeader } from '@/components/ui/PageHeader';
import { Alert } from '@/components/ui/Alert';
import { Spinner } from '@/components/ui/Spinner';
import { Modal } from '@/components/ui/Modal';
import { useRoles, useUpdateRolePermissions } from '@/hooks/useRoles';
import { usePermissions } from '@/hooks/useAuth';
import { PERMISSIONS } from '@medical/shared';
import type { Role } from '@/repositories/roles.repository';

const CATALOG: { category: string; perms: { code: string; label: string }[] }[] = [
  { category: 'Organization', perms: [
    { code: PERMISSIONS.ORG_MANAGE,        label: 'Manage organization' },
    { code: PERMISSIONS.BRANCH_MANAGE,     label: 'Manage branches' },
    { code: PERMISSIONS.DEPARTMENT_MANAGE, label: 'Manage departments' },
    { code: PERMISSIONS.USER_MANAGE,       label: 'Manage users' },
    { code: PERMISSIONS.ROLE_MANAGE,       label: 'Manage roles & permissions' },
  ]},
  { category: 'Patients', perms: [
    { code: PERMISSIONS.PATIENT_READ,   label: 'View patients' },
    { code: PERMISSIONS.PATIENT_CREATE, label: 'Register patients' },
    { code: PERMISSIONS.PATIENT_UPDATE, label: 'Update patients' },
  ]},
  { category: 'Appointments & OPD', perms: [
    { code: PERMISSIONS.APPOINTMENT_READ,   label: 'View appointments' },
    { code: PERMISSIONS.APPOINTMENT_MANAGE, label: 'Manage appointments' },
    { code: PERMISSIONS.CONSULTATION_READ,  label: 'View consultations' },
    { code: PERMISSIONS.CONSULTATION_WRITE, label: 'Write consultations' },
  ]},
  { category: 'IPD', perms: [
    { code: PERMISSIONS.IPD_READ,   label: 'View admissions' },
    { code: PERMISSIONS.IPD_MANAGE, label: 'Manage admissions & beds' },
    { code: PERMISSIONS.MAR_WRITE,  label: 'Write MAR' },
  ]},
  { category: 'Pharmacy', perms: [
    { code: PERMISSIONS.PHARMACY_READ,     label: 'View pharmacy' },
    { code: PERMISSIONS.PHARMACY_DISPENSE, label: 'Dispense medicines' },
    { code: PERMISSIONS.PHARMACY_STOCK,    label: 'Manage stock' },
  ]},
  { category: 'Laboratory', perms: [
    { code: PERMISSIONS.LAB_READ,          label: 'View lab orders' },
    { code: PERMISSIONS.LAB_ORDER,         label: 'Order lab tests' },
    { code: PERMISSIONS.LAB_RESULT_ENTER,  label: 'Enter lab results' },
    { code: PERMISSIONS.LAB_RESULT_VERIFY, label: 'Verify lab results' },
  ]},
  { category: 'Billing', perms: [
    { code: PERMISSIONS.BILLING_READ,   label: 'View invoices' },
    { code: PERMISSIONS.BILLING_MANAGE, label: 'Manage invoices & payments' },
    { code: PERMISSIONS.BILLING_REFUND, label: 'Process refunds' },
  ]},
];

export function RolesPage() {
  const roles = useRoles();
  const { can } = usePermissions();
  const [editing, setEditing] = useState<Role | null>(null);

  return (
    <>
      <PageHeader
        title="Roles & Permissions"
        subtitle="Control what each role can see and do"
      />

      {roles.isLoading && <div className="flex justify-center py-12"><Spinner size={28} /></div>}
      {roles.isError && <Alert tone="error">Failed to load roles.</Alert>}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {roles.data?.map((role) => (
          <Card key={role.id}>
            <CardHeader
              title={role.name}
              subtitle={`${role.permissions.length} permission${role.permissions.length === 1 ? '' : 's'}`}
              action={
                can(PERMISSIONS.ROLE_MANAGE) ? (
                  <Button variant="secondary" size="sm" onClick={() => setEditing(role)}>
                    Edit
                  </Button>
                ) : null
              }
            />
            <CardBody>
              <div className="mb-2 flex items-center gap-2 text-xs text-slate-500">
                <Shield size={12} />
                <span className="font-mono">{role.code}</span>
                {role.is_system && <Badge tone="gray">system</Badge>}
              </div>
              <div className="flex flex-wrap gap-1">
                {role.permissions.length === 0 && <span className="text-xs text-slate-400">No permissions assigned</span>}
                {role.permissions.slice(0, 6).map((p) => (
                  <Badge key={p} tone="blue">{p}</Badge>
                ))}
                {role.permissions.length > 6 && (
                  <Badge tone="gray">+{role.permissions.length - 6} more</Badge>
                )}
              </div>
            </CardBody>
          </Card>
        ))}
      </div>

      <PermissionEditor role={editing} onClose={() => setEditing(null)} />
    </>
  );
}

function PermissionEditor({ role, onClose }: { role: Role | null; onClose: () => void }) {
  const update = useUpdateRolePermissions();
  const [selected, setSelected] = useState<string[]>(role?.permissions ?? []);
  const [saved, setSaved] = useState(false);

  if (role && !selected.length && role.permissions.length && !saved) {
    // initialize on first open
    setSelected(role.permissions);
  }

  function toggle(code: string) {
    setSelected((s) => (s.includes(code) ? s.filter((x) => x !== code) : [...s, code]));
  }

  async function onSave() {
    if (!role) return;
    await update.mutateAsync({ id: role.id, permissions: selected });
    setSaved(true);
    setTimeout(() => { setSaved(false); onClose(); }, 800);
  }

  return (
    <Modal
      open={Boolean(role)}
      onClose={() => { setSaved(false); onClose(); }}
      title={role ? `Edit permissions - ${role.name}` : ''}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={() => { setSaved(false); onClose(); }}>Cancel</Button>
          <Button onClick={onSave} loading={update.isPending}>
            <Save size={14} /> Save
          </Button>
        </>
      }
    >
      {saved && <Alert tone="success">Permissions updated.</Alert>}
      <div className="space-y-5">
        {CATALOG.map(({ category, perms }) => (
          <div key={category}>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{category}</h4>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              {perms.map(({ code, label }) => (
                <label key={code} className="flex cursor-pointer items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                    checked={selected.includes(code)}
                    onChange={() => toggle(code)}
                  />
                  <div className="flex flex-col">
                    <span className="text-slate-800">{label}</span>
                    <span className="font-mono text-[10px] text-slate-400">{code}</span>
                  </div>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}
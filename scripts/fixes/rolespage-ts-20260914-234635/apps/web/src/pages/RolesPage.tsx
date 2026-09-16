import { useMemo, useState } from 'react';
import { Save, Shield, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { PageHeader } from '@/components/ui/PageHeader';
import { Alert } from '@/components/ui/Alert';
import { Spinner } from '@/components/ui/Spinner';
import { Modal } from '@/components/ui/Modal';
import { useRoles, useUpdateRolePermissions } from '@/hooks/useRoles';
import { usePermissions } from '@/hooks/useAuth';
import { PERMISSIONS, type Permission } from '@medical/shared';
import type { Role } from '@/repositories/roles.repository';

/**
 * UI catalog. Codes come from the shared PERMISSIONS constant so
 * adding a new permission in packages/shared automatically surfaces
 * here. Only the human labels are local.
 */
const LABELS: Record<string, string> = {
  [PERMISSIONS.ORG_MANAGE]:               'Manage organization',
  [PERMISSIONS.BRANCH_MANAGE]:            'Manage branches',
  [PERMISSIONS.DEPARTMENT_MANAGE]:        'Manage departments',
  [PERMISSIONS.USER_MANAGE]:              'Manage users',
  [PERMISSIONS.ROLE_MANAGE]:              'Manage roles & permissions',

  [PERMISSIONS.PATIENT_READ]:             'View patients',
  [PERMISSIONS.PATIENT_CREATE]:           'Register patients',
  [PERMISSIONS.PATIENT_UPDATE]:           'Update patients',

  [PERMISSIONS.APPOINTMENT_READ]:         'View appointments',
  [PERMISSIONS.APPOINTMENT_MANAGE]:       'Manage appointments',
  [PERMISSIONS.CONSULTATION_READ]:        'View consultations',
  [PERMISSIONS.CONSULTATION_WRITE]:       'Write consultations',

  [PERMISSIONS.IPD_READ]:                 'View admissions',
  [PERMISSIONS.IPD_MANAGE]:               'Manage admissions & beds',
  [PERMISSIONS.MAR_WRITE]:                'Write MAR',

  [PERMISSIONS.PHARMACY_READ]:            'View pharmacy',
  [PERMISSIONS.PHARMACY_DISPENSE]:        'Dispense medicines',
  [PERMISSIONS.PHARMACY_STOCK]:           'Manage stock',

  [PERMISSIONS.LAB_READ]:                 'View lab orders',
  [PERMISSIONS.LAB_ORDER]:                'Order lab tests',
  [PERMISSIONS.LAB_RESULT_ENTER]:         'Enter lab results',
  [PERMISSIONS.LAB_RESULT_VERIFY]:        'Verify lab results',

  [PERMISSIONS.BILLING_READ]:             'View invoices',
  [PERMISSIONS.BILLING_MANAGE]:           'Manage invoices & payments',
  [PERMISSIONS.BILLING_REFUND]:           'Process refunds',
};

const CATALOG: { category: string; perms: { code: Permission; label: string }[] }[] = [
  { category: 'Organization', perms: [
    { code: PERMISSIONS.ORG_MANAGE,        label: LABELS[PERMISSIONS.ORG_MANAGE] },
    { code: PERMISSIONS.BRANCH_MANAGE,     label: LABELS[PERMISSIONS.BRANCH_MANAGE] },
    { code: PERMISSIONS.DEPARTMENT_MANAGE, label: LABELS[PERMISSIONS.DEPARTMENT_MANAGE] },
    { code: PERMISSIONS.USER_MANAGE,       label: LABELS[PERMISSIONS.USER_MANAGE] },
    { code: PERMISSIONS.ROLE_MANAGE,       label: LABELS[PERMISSIONS.ROLE_MANAGE] },
  ]},
  { category: 'Patients', perms: [
    { code: PERMISSIONS.PATIENT_READ,   label: LABELS[PERMISSIONS.PATIENT_READ] },
    { code: PERMISSIONS.PATIENT_CREATE, label: LABELS[PERMISSIONS.PATIENT_CREATE] },
    { code: PERMISSIONS.PATIENT_UPDATE, label: LABELS[PERMISSIONS.PATIENT_UPDATE] },
  ]},
  { category: 'Appointments & OPD', perms: [
    { code: PERMISSIONS.APPOINTMENT_READ,   label: LABELS[PERMISSIONS.APPOINTMENT_READ] },
    { code: PERMISSIONS.APPOINTMENT_MANAGE, label: LABELS[PERMISSIONS.APPOINTMENT_MANAGE] },
    { code: PERMISSIONS.CONSULTATION_READ,  label: LABELS[PERMISSIONS.CONSULTATION_READ] },
    { code: PERMISSIONS.CONSULTATION_WRITE, label: LABELS[PERMISSIONS.CONSULTATION_WRITE] },
  ]},
  { category: 'IPD', perms: [
    { code: PERMISSIONS.IPD_READ,   label: LABELS[PERMISSIONS.IPD_READ] },
    { code: PERMISSIONS.IPD_MANAGE, label: LABELS[PERMISSIONS.IPD_MANAGE] },
    { code: PERMISSIONS.MAR_WRITE,  label: LABELS[PERMISSIONS.MAR_WRITE] },
  ]},
  { category: 'Pharmacy', perms: [
    { code: PERMISSIONS.PHARMACY_READ,     label: LABELS[PERMISSIONS.PHARMACY_READ] },
    { code: PERMISSIONS.PHARMACY_DISPENSE, label: LABELS[PERMISSIONS.PHARMACY_DISPENSE] },
    { code: PERMISSIONS.PHARMACY_STOCK,    label: LABELS[PERMISSIONS.PHARMACY_STOCK] },
  ]},
  { category: 'Laboratory', perms: [
    { code: PERMISSIONS.LAB_READ,          label: LABELS[PERMISSIONS.LAB_READ] },
    { code: PERMISSIONS.LAB_ORDER,         label: LABELS[PERMISSIONS.LAB_ORDER] },
    { code: PERMISSIONS.LAB_RESULT_ENTER,  label: LABELS[PERMISSIONS.LAB_RESULT_ENTER] },
    { code: PERMISSIONS.LAB_RESULT_VERIFY, label: LABELS[PERMISSIONS.LAB_RESULT_VERIFY] },
  ]},
  { category: 'Billing', perms: [
    { code: PERMISSIONS.BILLING_READ,   label: LABELS[PERMISSIONS.BILLING_READ] },
    { code: PERMISSIONS.BILLING_MANAGE, label: LABELS[PERMISSIONS.BILLING_MANAGE] },
    { code: PERMISSIONS.BILLING_REFUND, label: LABELS[PERMISSIONS.BILLING_REFUND] },
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
                {role.permissions.length === 0 && (
                  <span className="text-xs text-slate-400">No permissions assigned</span>
                )}
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

      {/*
       * key={editing?.id ?? 'closed'} forces React to unmount
       * PermissionEditor when the role changes, so its internal
       * `selected` state is rebuilt from scratch for each role.
       * This kills the stale-permissions bug.
       */}
      <PermissionEditor
        key={editing?.id ?? 'closed'}
        role={editing}
        allRoles={roles.data ?? []}
        onClose={() => setEditing(null)}
      />
    </>
  );
}

function PermissionEditor({
  role,
  allRoles,
  onClose,
}: {
  role: Role | null;
  allRoles: Role[];
  onClose: () => void;
}) {
  const update = useUpdateRolePermissions();
  const [selected, setSelected] = useState<string[]>(() => role?.permissions ?? []);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // If removing role:manage from THIS role would leave no role in
  // the tenant with that permission, block the save locally with a
  // clear message. The backend enforces this too.
  const wouldLockOut = useMemo(() => {
    if (!role) return false;
    if (!role.permissions.includes(PERMISSIONS.ROLE_MANAGE)) return false;
    if (selected.includes(PERMISSIONS.ROLE_MANAGE)) return false;

    const otherRoles = allRoles.filter(
      (r) => r.id !== role.id && r.permissions.includes(PERMISSIONS.ROLE_MANAGE),
    );
    return otherRoles.length === 0;
  }, [role, selected, allRoles]);

  function toggle(code: string) {
    setSelected((s) => (s.includes(code) ? s.filter((x) => x !== code) : [...s, code]));
  }

  async function onSave() {
    if (!role) return;
    setError(null);
    try {
      await update.mutateAsync({ id: role.id, permissions: selected });
      setSaved(true);
      setTimeout(() => { setSaved(false); onClose(); }, 800);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to save permissions');
    }
  }

  return (
    <Modal
      open={Boolean(role)}
      onClose={() => { setSaved(false); setError(null); onClose(); }}
      title={role ? `Edit permissions - ${role.name}` : ''}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={() => { setSaved(false); setError(null); onClose(); }}>
            Cancel
          </Button>
          <Button onClick={onSave} loading={update.isPending} disabled={wouldLockOut}>
            <Save size={14} /> Save
          </Button>
        </>
      }
    >
      {saved && <Alert tone="success">Permissions updated.</Alert>}
      {error && <div className="mb-3"><Alert tone="error">{error}</Alert></div>}
      {wouldLockOut && (
        <div className="mb-3">
          <Alert tone="error">
            <div className="flex items-start gap-2">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <div>
                <strong>Cannot remove “Manage roles &amp; permissions”</strong>
                <p className="mt-0.5 text-xs">
                  This is the last role in your hospital holding that permission.
                  Removing it would permanently lock everyone out of role editing.
                  Grant it to another role first.
                </p>
              </div>
            </div>
          </Alert>
        </div>
      )}
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
import { useMemo, useState } from 'react';
import { Save, Shield, AlertTriangle, CheckCircle2, XCircle, ChevronRight } from 'lucide-react';
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
 * UI catalog. Codes are pulled from the shared PERMISSIONS constant
 * so a rename or addition in packages/shared shows up as a TypeScript
 * error here instead of silently drifting. Labels are literal strings
 * next to each code - they are purely cosmetic.
 */
const CATALOG: { category: string; perms: { code: Permission; label: string }[] }[] = [
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
  const [viewingRole, setViewingRole] = useState<Role | null>(null);
  const [editingRole, setEditingRole] = useState<Role | null>(null);

  const canManage = can(PERMISSIONS.ROLE_MANAGE);

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
          <Card
            key={role.id}
            className="group cursor-pointer transition-all hover:border-brand-300 hover:shadow-md"
            onClick={() => setViewingRole(role)}
          >
            <CardHeader
              title={role.name}
              subtitle={`${role.permissions.length} permission${role.permissions.length === 1 ? '' : 's'}`}
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
                {role.permissions.slice(0, 3).map((p) => (
                  <Badge key={p} tone="blue">{p}</Badge>
                ))}
                {role.permissions.length > 3 && (
                  <Badge tone="gray">+{role.permissions.length - 3} more</Badge>
                )}
              </div>
              <div className="mt-3 flex items-center justify-end text-xs font-medium text-brand-600 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100">
                View access <ChevronRight size={12} />
              </div>
            </CardBody>
          </Card>
        ))}
      </div>

      {/* View Role Modal */}
      <Modal
        open={Boolean(viewingRole)}
        onClose={() => setViewingRole(null)}
        title={viewingRole ? `${viewingRole.name} - Access List` : ''}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setViewingRole(null)}>Close</Button>
            {canManage && viewingRole && (
              <Button onClick={() => { setEditingRole(viewingRole); setViewingRole(null); }}>
                Edit Permissions
              </Button>
            )}
          </>
        }
      >
        {viewingRole && (
          <div className="space-y-5">
            <div className="flex items-center gap-2 rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-600">
              <Shield size={14} />
              <span className="font-mono font-medium">{viewingRole.code}</span>
              {viewingRole.is_system && <Badge tone="gray">System Role</Badge>}
            </div>

            {CATALOG.map((cat) => (
              <div key={cat.category}>
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {cat.category}
                </h4>
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  {cat.perms.map((p) => {
                    const hasPerm = viewingRole.permissions.includes(p.code);
                    return (
                      <div
                        key={p.code}
                        className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${
                          hasPerm
                            ? 'border-green-200 bg-green-50 text-green-800'
                            : 'border-slate-100 bg-slate-50 text-slate-400'
                        }`}
                      >
                        {hasPerm ? (
                          <CheckCircle2 size={14} className="shrink-0 text-green-600" />
                        ) : (
                          <XCircle size={14} className="shrink-0 text-slate-300" />
                        )}
                        <span className="flex-1">{p.label}</span>
                        <span className="font-mono text-[10px] opacity-70">{p.code}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>

      {/* Edit Role Modal (Existing Editor) */}
      <PermissionEditor
        key={editingRole?.id ?? 'closed'}
        role={editingRole}
        allRoles={roles.data ?? []}
        onClose={() => setEditingRole(null)}
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
                <strong>Cannot remove "Manage roles & permissions"</strong>
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
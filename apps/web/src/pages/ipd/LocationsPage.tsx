import { useMemo, useState } from 'react';
import { ChevronRight, Plus, Building2, Pencil, Trash2, IndianRupee } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Card, CardBody } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { Alert } from '@/components/ui/Alert';
import { Spinner } from '@/components/ui/Spinner';
import { useBranches } from '@/hooks/useBranches';
import { useLocations, useCreateLocation, useUpdateLocation, useDeleteLocation } from '@/hooks/useIpd';
import type { Location } from '@/repositories/ipd.repository';

type LocType = 'FACILITY' | 'BUILDING' | 'FLOOR' | 'WARD' | 'ROOM' | 'BED';
type WardCategory = 'GENERAL' | 'MALE' | 'FEMALE' | 'ICU' | 'CABIN' | 'PRIVATE' | 'CUSTOM';

const TYPE_LABEL: Record<LocType, string> = {
  FACILITY: 'Facility', BUILDING: 'Building', FLOOR: 'Floor',
  WARD: 'Ward', ROOM: 'Room', BED: 'Bed',
};

const TYPE_HINT: Record<LocType, string> = {
  FACILITY: 'Hospital / clinic overall',
  BUILDING: 'Block / wing inside the facility',
  FLOOR:    'Ground, 1st, 2nd floor',
  WARD:     'General, ICU, Maternity, etc.',
  ROOM:     'Room 101, Room 102...',
  BED:      'Bed A, Bed B...',
};

const WARD_CATEGORIES: WardCategory[] = ['GENERAL', 'MALE', 'FEMALE', 'ICU', 'CABIN', 'PRIVATE', 'CUSTOM'];

/** Valid child types for a given parent type. */
function validChildTypes(parentType: LocType | null): LocType[] {
  if (!parentType) return ['WARD', 'BUILDING', 'FACILITY']; // Allow WARD at root for simplicity
  switch (parentType) {
    case 'FACILITY': return ['BUILDING', 'FLOOR', 'WARD'];
    case 'BUILDING': return ['FLOOR', 'WARD'];
    case 'FLOOR':    return ['WARD', 'ROOM'];
    case 'WARD':     return ['ROOM', 'BED']; // Allow BED directly under WARD
    case 'ROOM':     return ['BED'];
    case 'BED':      return [];
  }
}

interface TreeNode extends Location {
  children: TreeNode[];
}

function buildTree(rows: Location[]): TreeNode[] {
  const map = new Map<string, TreeNode>();
  rows.forEach((r) => map.set(r.id, { ...r, children: [] }));
  const roots: TreeNode[] = [];
  map.forEach((n) => {
    if (n.parent_id && map.has(n.parent_id)) {
      map.get(n.parent_id)!.children.push(n);
    } else {
      roots.push(n);
    }
  });
  return roots;
}

interface LocationForm {
  type: LocType;
  name: string;
  code: string;
  capacity: string;
  wardCategory: string;
  dailyRate: string;
  pricingNotes: string;
}

const emptyForm = (): LocationForm => ({
  type: 'FACILITY', name: '', code: '', capacity: '', wardCategory: '', dailyRate: '', pricingNotes: '',
});

export function LocationsPage() {
  const branches = useBranches();
  const [branchId, setBranchId] = useState('');
  const activeBranch = branchId || branches.data?.[0]?.id || '';

  const locs = useLocations({ branchId: activeBranch });
  const create = useCreateLocation();
  const update = useUpdateLocation();
  const del = useDeleteLocation();

  const [open, setOpen] = useState(false);
  const [parent, setParent] = useState<Location | null>(null);
  const [form, setForm] = useState<LocationForm>(emptyForm());
  const [error, setError] = useState<string | null>(null);

  const [editTarget, setEditTarget] = useState<Location | null>(null);
  const [editForm, setEditForm] = useState({ name: '', wardCategory: '', dailyRate: '', pricingNotes: '' });
  const [deleteTarget, setDeleteTarget] = useState<Location | null>(null);

  const tree = useMemo(() => buildTree(locs.data ?? []), [locs.data]);
  const allowedTypes: LocType[] = useMemo(() => {
    const parentType = parent ? (parent.type as LocType) : null;
    return validChildTypes(parentType);
  }, [parent]);

  function openCreate(p: Location | null) {
    setParent(p);
    const types = validChildTypes(p ? (p.type as LocType) : null);
    const defaultType = types[0] ?? 'FACILITY';
    setForm({ ...emptyForm(), type: defaultType });
    setError(null);
    setOpen(true);
  }

  async function onSubmit() {
    setError(null);
    if (!activeBranch) { setError('Select a branch first'); return; }
    if (!form.name.trim()) { setError('Name is required'); return; }
    if (allowedTypes.length === 0) { setError('Cannot add anything under a Bed'); return; }
    if (!allowedTypes.includes(form.type)) {
      setError(`"${TYPE_LABEL[form.type]}" is not a valid child of this parent`); return;
    }
    try {
      await create.mutateAsync({
        branchId: activeBranch,
        parentId: parent?.id ?? null,
        type: form.type,
        name: form.name,
        code: form.code || null,
        capacity: form.capacity ? Number(form.capacity) : null,
        wardCategory: (form.wardCategory || null) as any,
        dailyRate: form.dailyRate ? Number(form.dailyRate) : null,
        pricingNotes: form.pricingNotes || null,
      });
      setOpen(false);
    } catch (e: any) { setError(e?.message ?? 'Failed to create'); }
  }

  function openEdit(loc: Location) {
    setEditTarget(loc);
    setEditForm({
      name: loc.name,
      wardCategory: loc.ward_category ?? '',
      dailyRate: loc.daily_rate != null ? String(loc.daily_rate) : '',
      pricingNotes: loc.pricing_notes ?? '',
    });
  }

  async function onEditSubmit() {
    if (!editTarget || !editForm.name.trim()) return;
    try {
      await update.mutateAsync({
        id: editTarget.id,
        patch: {
          name: editForm.name,
          wardCategory: editForm.wardCategory || null,
          dailyRate: editForm.dailyRate ? Number(editForm.dailyRate) : null,
          pricingNotes: editForm.pricingNotes || null,
        },
      });
      setEditTarget(null);
    } catch (e: any) { alert(e?.message ?? 'Update failed'); }
  }

  async function onDeleteConfirm() {
    if (!deleteTarget) return;
    try {
      await del.mutateAsync(deleteTarget.id);
      setDeleteTarget(null);
    } catch (e: any) { alert(e?.message ?? 'Delete failed'); }
  }

  const modalTitle = parent
    ? `Add under "${parent.name}" (${TYPE_LABEL[parent.type as LocType]})`
    : 'Add top-level location';

  const showCapacity   = form.type === 'WARD' || form.type === 'ROOM' || form.type === 'FLOOR';
  const showWardFields = form.type === 'WARD' || form.type === 'BED' || form.type === 'ROOM';
  const editIsWard     = editTarget?.type === 'WARD' || editTarget?.type === 'BED' || editTarget?.type === 'ROOM';

  return (
    <>
      <PageHeader
        title="IPD Locations & Beds"
        subtitle="Manage your wards, rooms, and beds"
        action={
          <Button onClick={() => openCreate(null)} disabled={!activeBranch}>
            <Plus size={16} /> New Location / Ward
          </Button>
        }
      />

      <div className="mb-4 max-w-xs">
        <Select label="Branch" value={activeBranch} onChange={(e) => setBranchId(e.target.value)}>
          {branches.data?.map((b) => (
            <option key={b.id} value={b.id}>{b.name} ({b.branch_code})</option>
          ))}
        </Select>
      </div>

      {locs.isLoading && <div className="flex justify-center py-12"><Spinner size={28} /></div>}
      {locs.isError && <Alert tone="error">Failed to load locations.</Alert>}

      {tree.length === 0 && !locs.isLoading && (
        <EmptyState
          title="No locations yet"
          description="Start by adding a Ward (e.g. General Ward) and then add Beds to it."
          action={<Button onClick={() => openCreate(null)}><Plus size={16} /> Add a Ward</Button>}
        />
      )}

      {tree.length > 0 && (
        <Card>
          <CardBody className="py-2">
            <div className="space-y-0.5">
              {tree.map((n) => (
                <NodeRow key={n.id} node={n} depth={0} onAdd={openCreate} onEdit={openEdit} onDelete={setDeleteTarget} />
              ))}
            </div>
          </CardBody>
        </Card>
      )}

      {/* Create modal */}
      <Modal open={open} onClose={() => setOpen(false)} title={modalTitle} size="md"
        footer={<><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={onSubmit} loading={create.isPending} disabled={allowedTypes.length === 0}>Create</Button></>}
      >
        <div className="space-y-4">
          {error && <Alert tone="error">{error}</Alert>}
          {allowedTypes.length === 0 ? (
            <Alert tone="error">A Bed cannot contain anything. Pick a Room to add beds.</Alert>
          ) : (
            <>
              <Select label="Type *" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as LocType })}>
                {allowedTypes.map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
              </Select>
              <p className="-mt-2 text-xs text-slate-500">{TYPE_HINT[form.type]}</p>
              <Input label="Name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder={form.type === 'WARD' ? 'General Ward' : form.type === 'ROOM' ? 'Room 101' :
                  form.type === 'BED' ? 'Bed A' : form.type === 'FLOOR' ? 'Ground Floor' :
                  form.type === 'BUILDING' ? 'Main Block' : 'Demo Hospital'} />
              <Input label="Code (optional)" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
              {showCapacity && (
                <Input label="Capacity" type="number" value={form.capacity}
                  onChange={(e) => setForm({ ...form, capacity: e.target.value })} hint="Approximate number of patients" />
              )}
              {showWardFields && (
                <>
                  <Select label="Ward / Bed Category" value={form.wardCategory}
                    onChange={(e) => setForm({ ...form, wardCategory: e.target.value })}>
                    <option value="">- none -</option>
                    {WARD_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </Select>
                  <Input label="Daily Rate (₹)" type="number" value={form.dailyRate}
                    onChange={(e) => setForm({ ...form, dailyRate: e.target.value })} placeholder="e.g. 1500" hint="Bed charge per day" />
                  <Input label="Pricing notes" value={form.pricingNotes}
                    onChange={(e) => setForm({ ...form, pricingNotes: e.target.value })} placeholder="Includes nursing, excludes diet..." />
                </>
              )}
            </>
          )}
        </div>
      </Modal>

      {/* Edit modal */}
      <Modal open={Boolean(editTarget)} onClose={() => setEditTarget(null)}
        title={`Edit ${editTarget ? TYPE_LABEL[editTarget.type as LocType] : ''}`}
        footer={<><Button variant="secondary" onClick={() => setEditTarget(null)}>Cancel</Button>
          <Button onClick={onEditSubmit} loading={update.isPending}>Save changes</Button></>}
      >
        <div className="space-y-4">
          <Input label="Name *" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} autoFocus />
          {editIsWard && (
            <>
              <Select label="Ward / Bed Category" value={editForm.wardCategory}
                onChange={(e) => setEditForm({ ...editForm, wardCategory: e.target.value })}>
                <option value="">- none -</option>
                {WARD_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </Select>
              <Input label="Daily Rate (₹)" type="number" value={editForm.dailyRate}
                onChange={(e) => setEditForm({ ...editForm, dailyRate: e.target.value })} placeholder="e.g. 1500" />
              <Input label="Pricing notes" value={editForm.pricingNotes}
                onChange={(e) => setEditForm({ ...editForm, pricingNotes: e.target.value })} />
            </>
          )}
        </div>
      </Modal>

      {/* Delete confirmation modal */}
      <Modal open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)}
        title={`Delete ${deleteTarget ? TYPE_LABEL[deleteTarget.type as LocType] : ''}?`}
        footer={<><Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button variant="danger" onClick={onDeleteConfirm} loading={del.isPending}>Delete</Button></>}
      >
        <div className="space-y-3">
          <Alert tone="error">
            <span>You are about to delete <strong>{deleteTarget?.name}</strong>.
              {deleteTarget?.type !== 'BED' && ' All child locations under it will also be deleted.'}
            </span>
          </Alert>
          <p className="text-sm text-slate-600">
            Cannot be undone. Beds with admissions are protected — mark them inactive instead.
          </p>
        </div>
      </Modal>
    </>
  );
}

function NodeRow({
  node, depth, onAdd, onEdit, onDelete,
}: {
  node: TreeNode;
  depth: number;
  onAdd: (p: Location) => void;
  onEdit: (p: Location) => void;
  onDelete: (p: Location) => void;
}) {
  const [expanded, setExpanded] = useState(depth < 2);
  const hasChildren = node.children.length > 0;
  const nodeType = node.type as LocType;
  const canAddChild = validChildTypes(nodeType).length > 0;

  return (
    <div className="mb-2">
      <div
        className={`group flex flex-col sm:flex-row sm:items-center justify-between rounded-lg border border-slate-200 bg-white p-3 shadow-sm transition-all hover:border-brand-300 hover:shadow-md`}
        style={{ marginLeft: `${depth * 24}px` }}
      >
        <div className="flex flex-1 items-center gap-3">
          {hasChildren ? (
            <button
              type="button"
              onClick={() => setExpanded((e) => !e)}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200"
            >
              <ChevronRight size={16} className={`transition-transform ${expanded ? 'rotate-90' : ''}`} />
            </button>
          ) : (
            <span className="inline-block w-8" />
          )}
          
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600">
            <Building2 size={18} />
          </div>

          <div className="flex flex-col">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-base font-semibold text-slate-800">{node.name}</span>
              <Badge tone={nodeType === 'BED' ? 'green' : nodeType === 'ROOM' ? 'purple' : nodeType === 'WARD' ? 'blue' : 'gray'}>
                {TYPE_LABEL[nodeType]}
              </Badge>
              {node.ward_category && <Badge tone="yellow">{node.ward_category}</Badge>}
              {!node.is_active && <Badge tone="gray">inactive</Badge>}
            </div>
            
            <div className="mt-1 flex flex-wrap items-center gap-4 text-sm text-slate-500">
              {node.code && (
                <span className="font-mono text-xs">Code: {node.code}</span>
              )}
              {node.daily_rate != null && (
                <span className="flex items-center gap-1 font-medium text-emerald-600">
                  <IndianRupee size={12} /> {node.daily_rate}/day
                </span>
              )}
              {hasChildren && (
                <span className="text-xs">{node.children.length} child locations</span>
              )}
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-end gap-2 border-t pt-3 sm:mt-0 sm:border-none sm:pt-0">
          {canAddChild && (
            <Button variant="secondary" size="sm" onClick={() => onAdd(node)}>
              <Plus size={14} className="mr-1" /> Add
            </Button>
          )}
          <Button variant="secondary" size="sm" onClick={() => onEdit(node)} title="Edit">
            <Pencil size={14} />
          </Button>
          <Button variant="secondary" size="sm" onClick={() => onDelete(node)} title="Delete" className="text-red-600 hover:bg-red-50">
            <Trash2 size={14} />
          </Button>
        </div>
      </div>

      {expanded && hasChildren && (
        <div className="mt-2 relative">
          {/* Vertical connector line for nested items */}
          <div className="absolute left-[36px] top-0 bottom-4 w-px bg-slate-200" style={{ marginLeft: `${depth * 24}px` }} />
          {node.children.map((c) => (
            <NodeRow key={c.id} node={c} depth={depth + 1} onAdd={onAdd} onEdit={onEdit} onDelete={onDelete} />
          ))}
        </div>
      )}
    </div>
  );
}

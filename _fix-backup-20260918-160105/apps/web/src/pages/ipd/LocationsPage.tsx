import { useMemo, useState } from 'react';
import { ChevronRight, Plus, Building2, Pencil, Trash2 } from 'lucide-react';
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

const TYPE_LABEL: Record<LocType, string> = {
  FACILITY: 'Facility',
  BUILDING: 'Building',
  FLOOR:    'Floor',
  WARD:     'Ward',
  ROOM:     'Room',
  BED:      'Bed',
};

const TYPE_HINT: Record<LocType, string> = {
  FACILITY: 'Hospital / clinic overall',
  BUILDING: 'Block / wing inside the facility',
  FLOOR:    'Ground, 1st, 2nd floor',
  WARD:     'General, ICU, Maternity, etc.',
  ROOM:     'Room 101, Room 102...',
  BED:      'Bed A, Bed B...',
};

/** Valid child types for a given parent type. */
function validChildTypes(parentType: LocType | null): LocType[] {
  if (!parentType) return ['FACILITY', 'BUILDING'];
  switch (parentType) {
    case 'FACILITY': return ['BUILDING', 'FLOOR'];
    case 'BUILDING': return ['FLOOR', 'WARD'];
    case 'FLOOR':    return ['WARD', 'ROOM'];
    case 'WARD':     return ['ROOM'];
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
  const [form, setForm] = useState<{ type: LocType; name: string; code: string; capacity: string }>({
    type: 'FACILITY', name: '', code: '', capacity: '',
  });
  const [error, setError] = useState<string | null>(null);

  const [renameTarget, setRenameTarget] = useState<Location | null>(null);
  const [renameName, setRenameName] = useState('');
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
    setForm({ type: defaultType, name: '', code: '', capacity: '' });
    setError(null);
    setOpen(true);
  }

  async function onSubmit() {
    setError(null);
    if (!activeBranch) { setError('Select a branch first'); return; }
    if (!form.name.trim()) { setError('Name is required'); return; }
    if (allowedTypes.length === 0) { setError('Cannot add anything under a Bed'); return; }
    if (!allowedTypes.includes(form.type)) {
      setError(`"${TYPE_LABEL[form.type]}" is not a valid child of this parent`);
      return;
    }

    try {
      await create.mutateAsync({
        branchId: activeBranch,
        parentId: parent?.id ?? null,
        type: form.type,
        name: form.name,
        code: form.code || null,
        capacity: form.capacity ? Number(form.capacity) : null,
      });
      setOpen(false);
    } catch (e: any) { setError(e?.message ?? 'Failed to create'); }
  }

  function openRename(loc: Location) {
    setRenameTarget(loc);
    setRenameName(loc.name);
  }

  async function onRenameSubmit() {
    if (!renameTarget || !renameName.trim()) return;
    try {
      await update.mutateAsync({ id: renameTarget.id, patch: { name: renameName } });
      setRenameTarget(null);
    } catch (e: any) { alert(e?.message ?? 'Rename failed'); }
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

  const showCapacity = form.type === 'WARD' || form.type === 'ROOM' || form.type === 'FLOOR';

  return (
    <>
      <PageHeader
        title="Locations"
        subtitle="Facility > Building > Floor > Ward > Room > Bed"
        action={
          <Button onClick={() => openCreate(null)} disabled={!activeBranch}>
            <Plus size={16} /> New top-level location
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
          description="Start by adding a facility, then drill down: Building > Floor > Ward > Room > Bed."
          action={<Button onClick={() => openCreate(null)}><Plus size={16} /> New top-level location</Button>}
        />
      )}

      {tree.length > 0 && (
        <Card>
          <CardBody className="py-2">
            <div className="space-y-0.5">
              {tree.map((n) => (
                <NodeRow
                  key={n.id}
                  node={n}
                  depth={0}
                  onAdd={openCreate}
                  onRename={openRename}
                  onDelete={setDeleteTarget}
                />
              ))}
            </div>
          </CardBody>
        </Card>
      )}

      {/* Create modal */}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={modalTitle}
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={onSubmit} loading={create.isPending} disabled={allowedTypes.length === 0}>
              Create
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {error && <Alert tone="error">{error}</Alert>}

          {allowedTypes.length === 0 ? (
            <Alert tone="error">A Bed cannot contain anything. Pick a Room to add beds.</Alert>
          ) : (
            <>
              <Select
                label="Type *"
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as LocType })}
              >
                {allowedTypes.map((t) => (
                  <option key={t} value={t}>{TYPE_LABEL[t]}</option>
                ))}
              </Select>
              <p className="-mt-2 text-xs text-slate-500">{TYPE_HINT[form.type]}</p>

              <Input
                label="Name *"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder={
                  form.type === 'WARD' ? 'General Ward' :
                  form.type === 'ROOM' ? 'Room 101' :
                  form.type === 'BED' ? 'Bed A' :
                  form.type === 'FLOOR' ? 'Ground Floor' :
                  form.type === 'BUILDING' ? 'Main Block' : 'Demo Hospital'
                }
              />

              <Input
                label="Code (optional)"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
              />

              {showCapacity && (
                <Input
                  label="Capacity"
                  type="number"
                  value={form.capacity}
                  onChange={(e) => setForm({ ...form, capacity: e.target.value })}
                  hint="Approximate number of patients this can hold"
                />
              )}
            </>
          )}
        </div>
      </Modal>

      {/* Rename modal */}
      <Modal
        open={Boolean(renameTarget)}
        onClose={() => setRenameTarget(null)}
        title={`Rename ${renameTarget ? TYPE_LABEL[renameTarget.type as LocType] : ''}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setRenameTarget(null)}>Cancel</Button>
            <Button onClick={onRenameSubmit} loading={update.isPending}>Save</Button>
          </>
        }
      >
        <Input label="New name" value={renameName} onChange={(e) => setRenameName(e.target.value)} autoFocus />
      </Modal>

      {/* Delete confirmation modal */}
      <Modal
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title={`Delete ${deleteTarget ? TYPE_LABEL[deleteTarget.type as LocType] : ''}?`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="danger" onClick={onDeleteConfirm} loading={del.isPending}>Delete</Button>
          </>
        }
      >
        <div className="space-y-3">
          <Alert tone="error">
            <span>
              You are about to delete <strong>{deleteTarget?.name}</strong>.
              {deleteTarget?.type !== 'BED' && ' All child locations under it will also be deleted.'}
            </span>
          </Alert>
          <p className="text-sm text-slate-600">
            Cannot be undone. Beds with admissions are protected and cannot be deleted - mark them inactive instead.
          </p>
        </div>
      </Modal>
    </>
  );
}

function NodeRow({
  node, depth, onAdd, onRename, onDelete,
}: {
  node: TreeNode;
  depth: number;
  onAdd: (p: Location) => void;
  onRename: (p: Location) => void;
  onDelete: (p: Location) => void;
}) {
  const [expanded, setExpanded] = useState(depth < 2);
  const hasChildren = node.children.length > 0;
  const nodeType = node.type as LocType;
  const canAddChild = validChildTypes(nodeType).length > 0;

  return (
    <div>
      <div
        className="group flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-slate-50"
        style={{ paddingLeft: `${depth * 20 + 8}px` }}
      >
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="flex flex-1 items-center gap-2 text-left"
        >
          {hasChildren ? (
            <ChevronRight
              size={14}
              className={`shrink-0 text-slate-400 transition-transform ${expanded ? 'rotate-90' : ''}`}
            />
          ) : (
            <span className="inline-block w-3.5" />
          )}
          <Building2 size={14} className="shrink-0 text-slate-400" />
          <span className="text-sm text-slate-800">{node.name}</span>
          <Badge
            tone={
              nodeType === 'BED' ? 'green' :
              nodeType === 'ROOM' ? 'purple' :
              nodeType === 'WARD' ? 'blue' : 'gray'
            }
          >
            {TYPE_LABEL[nodeType]}
          </Badge>
          {node.code && <span className="font-mono text-xs text-slate-500">{node.code}</span>}
          {!node.is_active && <Badge tone="gray">inactive</Badge>}
        </button>

        <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          {canAddChild && (
            <button
              type="button"
              onClick={() => onAdd(node)}
              className="rounded p-1 text-slate-300 hover:bg-brand-50 hover:text-brand-600"
              title="Add child"
            >
              <Plus size={14} />
            </button>
          )}
          <button
            type="button"
            onClick={() => onRename(node)}
            className="rounded p-1 text-slate-300 hover:bg-blue-50 hover:text-blue-600"
            title="Rename"
          >
            <Pencil size={14} />
          </button>
          <button
            type="button"
            onClick={() => onDelete(node)}
            className="rounded p-1 text-slate-300 hover:bg-red-50 hover:text-red-500"
            title="Delete"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {expanded && hasChildren && (
        <div>
          {node.children.map((c) => (
            <NodeRow
              key={c.id}
              node={c}
              depth={depth + 1}
              onAdd={onAdd}
              onRename={onRename}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}

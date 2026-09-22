import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, Save, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { PageHeader } from '@/components/ui/PageHeader';
import { Alert } from '@/components/ui/Alert';
import { Spinner } from '@/components/ui/Spinner';
import { useAdmission } from '@/hooks/useIpd';
import { useIpdBillByAdmission, useCreateIpdDraft, useReplaceIpdItems } from '@/hooks/useBilling';
import { usePermissions } from '@/hooks/useAuth';
import { PERMISSIONS } from '@medical/shared';

type ItemType = 'MANUAL' | 'CONSULTATION' | 'LAB' | 'PHARMACY' | 'PROCEDURE' | 'IPD';

interface BillItem {
  itemType: ItemType;
  description: string;
  qty: string;
  unitPrice: string;
  discount: string;
  taxRate: string;
}

const newItem: BillItem = {
  itemType: 'MANUAL',
  description: '',
  qty: '1',
  unitPrice: '0',
  discount: '0',
  taxRate: '0',
};

export function IPDBillBuilderPage() {
  const { admissionId } = useParams<{ admissionId: string }>();
  const adm = useAdmission(admissionId);
  const bill = useIpdBillByAdmission(admissionId);
  const createDraft = useCreateIpdDraft();
  const replaceItems = useReplaceIpdItems(bill.data?.id ?? '');
  const { can } = usePermissions();
  const canManage = can(PERMISSIONS.BILLING_MANAGE);

  const [items, setItems] = useState<BillItem[]>([{ ...newItem }]);
  const [discount, setDiscount] = useState('0');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!bill.data) return;
    const serverItems = bill.data.items;
    if (serverItems.length > 0) {
      setItems(
        serverItems.map((it: any) => ({
          itemType: it.item_type,
          description: it.description,
          qty: String(it.qty),
          unitPrice: String(it.unit_price),
          discount: String(it.discount),
          taxRate: String(it.tax_rate),
        })),
      );
    } else {
      setItems([{ ...newItem }]);
    }
    setDiscount(String(bill.data.discount_amount ?? 0));
  }, [bill.data]);

  function updateItem(i: number, patch: Partial<BillItem>) {
    setItems(items.map((it, j) => (j === i ? { ...it, ...patch } : it)));
  }

  function lineTotal(it: BillItem) {
    const sub = Number(it.qty || 0) * Number(it.unitPrice || 0) - Number(it.discount || 0);
    const tax = sub * Number(it.taxRate || 0) / 100;
    return sub + tax;
  }

  const subtotal = items.reduce((s, it) => s + lineTotal(it), 0);
  const total = subtotal - Number(discount || 0);

  async function onCreateDraft() {
    setError(null);
    try {
      await createDraft.mutateAsync({ admissionId: admissionId! });
    } catch (e: any) {
      setError(e?.message ?? 'Failed to create IPD draft');
    }
  }

  async function onSave() {
    setError(null);
    if (!bill.data?.id) return;
    const valid = items.filter((it) => it.description.trim() && Number(it.qty) > 0);
    if (valid.length === 0) { setError('Add at least one item'); return; }

    const hasInvalidLines = items.some((it) => (it.description.trim() || Number(it.unitPrice) > 0) && Number(it.qty) <= 0);
    if (hasInvalidLines) {
      setError('Some rows are missing a valid quantity (> 0). Please fix or remove them.');
      return;
    }
    try {
      await replaceItems.mutateAsync({
        discount: Number(discount || 0),
        items: valid.map((it) => ({
          itemType: it.itemType,
          description: it.description,
          qty: Number(it.qty),
          unitPrice: Number(it.unitPrice || 0),
          discount: Number(it.discount || 0),
          taxRate: Number(it.taxRate || 0),
        })),
      });
    } catch (e: any) {
      setError(e?.message ?? 'Failed to save IPD bill');
    }
  }

  if (adm.isLoading || bill.isLoading) {
    return <div className="flex justify-center py-20"><Spinner size={32} /></div>;
  }
  if (adm.isError || !adm.data) return <Alert tone="error">Failed to load admission.</Alert>;
  if (bill.isError) return <Alert tone="error">Failed to load IPD bill.</Alert>;

  const a = adm.data;
  const isFinalized = Boolean(bill.data?.finalized_at);

  return (
    <>
      <div className="mb-4">
        <Link to={`/ipd/admissions/${admissionId}`} className="inline-flex items-center gap-1 text-sm text-brand-600 hover:underline">
          <ArrowLeft size={14} /> Back to admission
        </Link>
      </div>

      <PageHeader
        title="IPD Bill"
        subtitle={`${a.patients?.full_name ?? 'Patient'} - ${a.patients?.uhid ?? ''}`}
        action={bill.data ? (
          <Badge tone={isFinalized ? 'green' : 'blue'} className="px-3 py-1.5 text-sm">
            {isFinalized ? 'FINALIZED' : bill.data.status}
          </Badge>
        ) : undefined}
      />

      {error && <div className="mb-4"><Alert tone="error">{error}</Alert></div>}

      {!bill.data && (
        <Card>
          <CardBody className="space-y-3 text-center">
            <p className="text-sm text-slate-500">No IPD bill exists for this admission yet.</p>
            <Button onClick={onCreateDraft} loading={createDraft.isPending} disabled={!canManage}>
              Create IPD draft bill
            </Button>
          </CardBody>
        </Card>
      )}

      {bill.data && (
        <Card>
          <CardHeader
            title={bill.data.invoice_no}
            subtitle={isFinalized ? 'This bill is finalized and cannot be edited.' : 'Add charges and save.'}
            action={isFinalized ? <Badge tone="green">Finalized</Badge> : undefined}
          />
          <CardBody className="space-y-4">
            <div className="space-y-3">
              {items.map((it, i) => (
                <div key={i} className="rounded-md border border-slate-200 bg-slate-50/40 p-3">
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-12 sm:gap-3">
                    <div className="sm:col-span-8">
                      <Input
                        label="Description"
                        value={it.description}
                        onChange={(e) => updateItem(i, { description: e.target.value })}
                        placeholder="Room charge / Procedure / Medicine"
                        disabled={isFinalized || !canManage}
                      />
                    </div>
                    <div className="sm:col-span-3">
                      <Select
                        label="Type"
                        value={it.itemType}
                        onChange={(e) => updateItem(i, { itemType: e.target.value as ItemType })}
                        disabled={isFinalized || !canManage}
                      >
                        <option value="MANUAL">Manual</option>
                        <option value="CONSULTATION">Consultation</option>
                        <option value="PROCEDURE">Procedure</option>
                        <option value="LAB">Lab</option>
                        <option value="PHARMACY">Pharmacy</option>
                        <option value="IPD">IPD</option>
                      </Select>
                    </div>
                    <div className="flex items-end justify-end sm:col-span-1">
                      {items.length > 1 && !isFinalized && canManage && (
                        <button
                          type="button"
                          onClick={() => setItems(items.filter((_, j) => j !== i))}
                          className="rounded p-2 text-slate-400 hover:bg-red-50 hover:text-red-500"
                          title="Remove line"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-12">
                    <div className="md:col-span-2">
                      <Input label="Qty" type="number" min="1" step="1" value={it.qty} onChange={(e) => updateItem(i, { qty: e.target.value })} disabled={isFinalized || !canManage} />
                    </div>
                    <div className="md:col-span-2">
                      <Input label="Unit price" type="number" min="0" step="0.01" value={it.unitPrice} onChange={(e) => updateItem(i, { unitPrice: e.target.value })} disabled={isFinalized || !canManage} />
                    </div>
                    <div className="md:col-span-2">
                      <Input label="Discount" type="number" min="0" step="0.01" value={it.discount} onChange={(e) => updateItem(i, { discount: e.target.value })} disabled={isFinalized || !canManage} />
                    </div>
                    <div className="md:col-span-2">
                      <Input label="Tax %" type="number" min="0" step="0.01" value={it.taxRate} onChange={(e) => updateItem(i, { taxRate: e.target.value })} disabled={isFinalized || !canManage} />
                    </div>
                    <div className="col-span-2 flex items-end justify-end sm:col-span-4 md:col-span-4">
                      <div className="text-right text-xs text-slate-500">
                        Line total:{' '}
                        <span className="font-mono text-sm font-medium text-slate-800">Rs.{lineTotal(it).toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {!isFinalized && canManage && (
              <Button variant="secondary" size="sm" onClick={() => setItems([...items, { ...newItem }])}>
                <Plus size={14} /> Add line
              </Button>
            )}

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Input label="Discount (Rs)" type="number" step="0.01" value={discount} onChange={(e) => setDiscount(e.target.value)} disabled={isFinalized || !canManage} />
            </div>

            <div className="rounded-md bg-slate-50 px-4 py-3 text-right text-sm">
              <div className="text-slate-600">Subtotal: <span className="font-mono text-slate-800">Rs.{subtotal.toFixed(2)}</span></div>
              <div className="text-slate-600">Discount: <span className="font-mono text-slate-800">- Rs.{Number(discount || 0).toFixed(2)}</span></div>
              <div className="mt-1 text-base font-semibold text-slate-900">Total: <span className="font-mono">Rs.{total.toFixed(2)}</span></div>
            </div>

            {!isFinalized && canManage && (
              <div className="flex justify-end">
                <Button onClick={onSave} loading={replaceItems.isPending}>
                  <Save size={14} /> Save IPD bill
                </Button>
              </div>
            )}
          </CardBody>
        </Card>
      )}
    </>
  );
}
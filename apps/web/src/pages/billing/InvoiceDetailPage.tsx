import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft, BanknoteIcon, Printer, Receipt, RefreshCw, RotateCcw,
  Stethoscope, FlaskConical, Pill, Activity, FileText, Pencil, Check,
  X, Percent, ExternalLink, Tag,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Alert } from '@/components/ui/Alert';
import { Spinner } from '@/components/ui/Spinner';
import {
  useInvoice, useRecordPayment, useRefundPayment,
  useSubInvoices, useUpdateDiscount,
} from '@/hooks/useBilling';
import { PrintPreviewModal } from '@/components/PrintPreviewModal';
import { InvoicePrint } from '@/components/print/InvoicePrint';
import { usePermissions } from '@/hooks/useAuth';
import { useOrganization } from '@/hooks/useOrganization';
import { PERMISSIONS } from '@medical/shared';

const statusTone: Record<string, BadgeTone> = {
  UNPAID: 'red', PARTIAL: 'yellow', PAID: 'green', REFUNDED: 'gray', CANCELLED: 'gray',
};

const itemTypeTone: Record<string, BadgeTone> = {
  CONSULTATION: 'blue', LAB: 'purple', PHARMACY: 'green',
  PROCEDURE: 'yellow', IPD: 'red', MANUAL: 'gray',
};

const itemTypeLabel: Record<string, string> = {
  CONSULTATION: 'Consultation',
  LAB: 'Laboratory',
  PHARMACY: 'Pharmacy',
  PROCEDURE: 'Procedure',
  IPD: 'IPD',
  MANUAL: 'Manual',
};

const itemTypeIcon: Record<string, any> = {
  CONSULTATION: Stethoscope,
  LAB: FlaskConical,
  PHARMACY: Pill,
  PROCEDURE: Activity,
  IPD: FileText,
  MANUAL: Receipt,
};

const subInvoiceSourceLabel: Record<string, string> = {
  DOCTOR: 'Doctor consultation',
  PHARMACY: 'Pharmacy dispense',
  LAB: 'Laboratory',
};

const subInvoiceSourceIcon: Record<string, any> = {
  DOCTOR: Stethoscope,
  PHARMACY: Pill,
  LAB: FlaskConical,
};

export function InvoiceDetailPage() {
  const { invoiceId } = useParams<{ invoiceId: string }>();
  const inv = useInvoice(invoiceId);
  const subs = useSubInvoices(invoiceId);
  const updateDiscount = useUpdateDiscount(invoiceId ?? '');
  const recordPay = useRecordPayment(invoiceId ?? '');
  const refund = useRefundPayment(invoiceId ?? '');
  const { can } = usePermissions();
  const organization = useOrganization();

  const [printOpen, setPrintOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [refundOpen, setRefundOpen] = useState(false);
  const [discountOpen, setDiscountOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<'CASH'|'CARD'|'UPI'|'NETBANKING'|'INSURANCE'|'CREDIT'|'OTHER'>('CASH');
  const [reference, setReference] = useState('');
  const [payNotes, setPayNotes] = useState('');

  const [refundPaymentId, setRefundPaymentId] = useState('');
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');

  const [discountInput, setDiscountInput] = useState('');

  if (inv.isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size={32} />
      </div>
    );
  }
  if (inv.isError || !inv.data) {
    return (
      <div className="space-y-4">
        <Alert tone="error">Failed to load invoice. It may have been deleted or you may not have access.</Alert>
        <Link to="/billing/invoices">
          <Button variant="secondary"><ArrowLeft size={14} /> Back to invoices</Button>
        </Link>
      </div>
    );
  }

  const i = inv.data;
  const canPay    = can(PERMISSIONS.BILLING_MANAGE);
  const canRefund = can(PERMISSIONS.BILLING_REFUND);
  const hasItems  = i.items.length > 0;

  function openPay() {
    setAmount(String(i.balance_amount.toFixed(2)));
    setMethod('CASH'); setReference(''); setPayNotes('');
    setError(null); setPayOpen(true);
  }
  async function onPay() {
    setError(null);
    const balance = Number(i.balance_amount.toFixed(2));
    const amt = Number(Number(amount).toFixed(2));
    if (!Number.isFinite(amt) || amt <= 0) { setError('Enter a valid amount'); return; }
    if (amt - balance > 0.005) { setError(`Cannot exceed balance of Rs.${balance.toFixed(2)}`); return; }
    const finalAmt = Math.min(amt, balance);
    try {
      await recordPay.mutateAsync({ amount: finalAmt, method, reference: reference || null, notes: payNotes || null });
      setPayOpen(false);
    } catch (e: any) { setError(e?.message ?? 'Failed to record payment'); }
  }
  function openRefund(paymentId: string, maxAmount: number) {
    setRefundPaymentId(paymentId);
    setRefundAmount(String(maxAmount));
    setRefundReason('');
    setError(null); setRefundOpen(true);
  }
  async function onRefund() {
    setError(null);
    const amt = Number(refundAmount);
    if (isNaN(amt) || amt <= 0) { setError('Enter a valid amount'); return; }
    if (!refundReason.trim()) { setError('Reason is required'); return; }
    try {
      await refund.mutateAsync({ paymentId: refundPaymentId, amount: amt, reason: refundReason.trim() });
      setRefundOpen(false);
    } catch (e: any) { setError(e?.message ?? 'Failed to refund'); }
  }
  function openDiscount() {
    setDiscountInput(String(i.discount_amount ?? 0));
    setError(null); setDiscountOpen(true);
  }
  async function onSaveDiscount() {
    setError(null);
    const d = Number(discountInput);
    if (isNaN(d) || d < 0) { setError('Enter a valid discount'); return; }
    if (d > i.subtotal + 0.01) { setError(`Discount cannot exceed subtotal (Rs.${i.subtotal.toFixed(2)})`); return; }
    try {
      await updateDiscount.mutateAsync(d);
      setDiscountOpen(false);
    } catch (e: any) { setError(e?.message ?? 'Failed to update discount'); }
  }

  const subRows: any[] = (subs.data as any)?.rows ?? [];
  const doctorSub  = subRows.find((r) => r.invoice_type === 'DOCTOR');
  const labSub     = subRows.find((r) => r.invoice_type === 'LAB');
  const pharmaSub  = subRows.find((r) => r.invoice_type === 'PHARMACY');
  const orderedSubs = [doctorSub, labSub, pharmaSub].filter(Boolean);

  return (
    <>
      {/* ─── Toolbar ───────────────────────────────────────────── */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Link to="/billing/invoices" className="inline-flex items-center gap-1 text-sm text-brand-600 hover:underline">
          <ArrowLeft size={14} /> Back to invoices
        </Link>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => inv.refetch()} loading={inv.isFetching} title="Refresh">
            <RefreshCw size={14} />
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setPrintOpen(true)} disabled={!hasItems}>
            <Printer size={14} /> Download PDF
          </Button>
        </div>
      </div>

      {/* ─── Invoice header block ─────────────────────────────── */}
      <Card className="mb-6 overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6">
          {/* Left: hospital identity */}
          <div>
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
              <Receipt size={20} />
            </div>
            <h1 className="text-lg font-bold text-slate-900">
              {organization.data?.name ?? 'Hospital'}
            </h1>
            {organization.data?.legal_name && (
              <p className="text-xs text-slate-600">{organization.data.legal_name}</p>
            )}
            {organization.data?.address && (
              <p className="mt-1 text-xs text-slate-600">
                {[organization.data.address, organization.data.city, organization.data.state, organization.data.pincode]
                  .filter(Boolean).join(', ')}
              </p>
            )}
            <p className="mt-0.5 text-xs text-slate-600">
              {organization.data?.phone && `Phone: ${organization.data.phone}`}
              {organization.data?.phone && organization.data?.email && ' • '}
              {organization.data?.email && `Email: ${organization.data.email}`}
            </p>
          </div>

          {/* Right: invoice meta */}
          <div className="md:text-right">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Invoice</p>
            <p className="font-mono text-xl font-semibold text-slate-900">{i.invoice_no}</p>
            <div className="mt-3 space-y-1 text-xs text-slate-600 md:text-right">
              <p><span className="text-slate-400">Issued:</span> {new Date(i.created_at).toLocaleString()}</p>
              <p><span className="text-slate-400">Status:</span>{' '}
                <Badge tone={statusTone[i.status] ?? 'gray'}>{i.status}</Badge>
              </p>
            </div>
          </div>
        </div>

        {/* Patient strip */}
        <div className="border-t border-slate-200 bg-slate-50 px-6 py-4">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm sm:gap-x-8">
            <div>
              <span className="text-[11px] uppercase tracking-wider text-slate-500">Billed to</span>
              <p className="font-semibold text-slate-900">{i.patients?.full_name ?? 'Unknown patient'}</p>
            </div>
            <div>
              <span className="text-[11px] uppercase tracking-wider text-slate-500">UHID</span>
              <p className="font-mono text-slate-800">{i.patients?.uhid ?? '-'}</p>
            </div>
            {i.patients?.mobile && (
              <div>
                <span className="text-[11px] uppercase tracking-wider text-slate-500">Mobile</span>
                <p className="text-slate-800">{i.patients.mobile}</p>
              </div>
            )}
          </div>
        </div>
      </Card>

      {error && !payOpen && !refundOpen && !discountOpen && (
        <div className="mb-4"><Alert tone="error">{error}</Alert></div>
      )}

      {/* ─── Line items ───────────────────────────────────────── */}
      <Card className="mb-6">
        <CardHeader
          title="Line items"
          subtitle={hasItems ? `${i.items.length} item(s) on this invoice` : 'No items have been billed yet'}
        />
        {!hasItems && (
          <CardBody>
            <Alert tone="info">
              <div className="flex items-start gap-2">
                <Receipt size={16} className="mt-0.5 shrink-0" />
                <div>
                  <p className="font-semibold">No items yet</p>
                  <p className="mt-0.5 text-xs">Charges appear here automatically as the patient moves through their visit.</p>
                </div>
              </div>
            </Alert>
          </CardBody>
        )}
        {hasItems && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-6 py-3 w-8">#</th>
                  <th className="px-6 py-3">Description</th>
                  <th className="px-6 py-3 text-right">Qty</th>
                  <th className="px-6 py-3 text-right">Rate</th>
                  <th className="px-6 py-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {i.items.map((it: any, idx: number) => {
                  const Icon = itemTypeIcon[it.item_type] ?? Receipt;
                  return (
                    <tr key={it.id} className="align-middle hover:bg-slate-50/50">
                      <td className="px-6 py-3 text-slate-400 font-mono text-xs">{idx + 1}</td>
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-2">
                          <Badge tone={itemTypeTone[it.item_type] ?? 'gray'}>
                            <Icon size={10} className="mr-1" />
                            {itemTypeLabel[it.item_type] ?? it.item_type}
                          </Badge>
                          <span className="text-slate-800">{it.description}</span>
                        </div>
                      </td>
                      <td className="px-6 py-3 text-right tabular-nums text-slate-600">{it.qty}</td>
                      <td className="px-6 py-3 text-right font-mono tabular-nums text-slate-600">
                        Rs.{Number(it.unit_price).toFixed(2)}
                      </td>
                      <td className="px-6 py-3 text-right font-mono tabular-nums font-medium text-slate-900">
                        Rs.{Number(it.amount).toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Totals block */}
        {hasItems && (
          <div className="border-t border-slate-200 bg-slate-50 px-6 py-5">
            <div className="ml-auto w-full max-w-xs space-y-2 text-sm">
              <Row label="Subtotal" value={`Rs.${i.subtotal.toFixed(2)}`} />
              <Row
                label={
                  <span className="inline-flex items-center gap-1">
                    <Tag size={12} />
                    Discount
                  </span>
                }
                value={
                  <span className="inline-flex items-center gap-2">
                    {i.discount_amount > 0 ? `- Rs.${i.discount_amount.toFixed(2)}` : 'Rs.0.00'}
                    {canPay && (
                      <button
                        type="button"
                        onClick={openDiscount}
                        className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                        title="Edit discount"
                      >
                        <Pencil size={11} />
                      </button>
                    )}
                  </span>
                }
              />
              {i.tax_amount > 0 && (
                <Row label="Tax" value={`Rs.${i.tax_amount.toFixed(2)}`} />
              )}
              <div className="flex items-center justify-between border-t border-slate-300 pt-2 text-base font-semibold text-slate-900">
                <span>Total</span>
                <span className="font-mono">Rs.{i.total_amount.toFixed(2)}</span>
              </div>
              <Row label="Paid" value={`Rs.${i.paid_amount.toFixed(2)}`} tone="green" />
              <div className="flex items-center justify-between border-t border-slate-300 pt-2 text-base font-semibold">
                <span className={i.balance_amount >= 0.005 ? 'text-red-600' : 'text-green-600'}>Balance Due</span>
                <span className={`font-mono ${i.balance_amount >= 0.005 ? 'text-red-600' : 'text-green-600'}`}>
                  Rs.{(i.balance_amount < 0.005 ? 0 : i.balance_amount).toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* ─── Source invoices (sub-invoices) ───────────────────── */}
      {orderedSubs.length > 0 && (
        <Card className="mb-6">
          <CardHeader
            title="Source invoices"
            subtitle="Each department issues its own invoice. All of them roll up into this combined bill."
          />
          <CardBody className="p-0">
            <ul className="divide-y divide-slate-100">
              {orderedSubs.map((sub) => {
                const Icon = subInvoiceSourceIcon[sub.invoice_type] ?? Receipt;
                const tone = statusTone[sub.status] ?? 'gray';
                return (
                  <li key={sub.id}>
                    <Link
                      to={`/billing/invoices/${sub.id}`}
                      className="flex items-center gap-3 px-4 py-4 hover:bg-slate-50 sm:gap-4 sm:px-6"
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                        <Icon size={16} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-900">
                          {subInvoiceSourceLabel[sub.invoice_type] ?? sub.invoice_type}
                        </p>
                        <p className="truncate font-mono text-xs text-slate-500">
                          {sub.invoice_no}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-mono text-sm font-medium text-slate-900">
                          Rs.{Number(sub.total_amount).toFixed(2)}
                        </p>
                        <div className="mt-0.5 flex items-center justify-end gap-1">
                          <Badge tone={tone}>{sub.status}</Badge>
                        </div>
                      </div>
                      <ExternalLink size={14} className="shrink-0 text-slate-400" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </CardBody>
        </Card>
      )}

      {/* ─── Payments ─────────────────────────────────────────── */}
      <Card className="mb-6">
        <CardHeader
          title="Payments"
          subtitle={`Paid Rs.${i.paid_amount.toFixed(2)} of Rs.${i.total_amount.toFixed(2)}`}
          action={
            canPay && i.balance_amount >= 0.01 && i.status !== 'CANCELLED' ? (
              <Button onClick={openPay}>
                <BanknoteIcon size={14} /> Record payment
              </Button>
            ) : null
          }
        />
        <CardBody>
          {i.payments.length === 0 && (
            <p className="text-sm text-slate-500">No payments recorded yet.</p>
          )}
          {i.payments.length > 0 && (
            <ul className="divide-y divide-slate-100">
              {i.payments.map((p: any) => (
                <li key={p.id} className="flex items-center justify-between py-3">
                  <div>
                    <div className="text-sm font-medium text-slate-900">
                      Rs.{Number(p.amount).toFixed(2)} <span className="text-slate-400">via</span> {p.method}
                      {p.reference && (
                        <span className="ml-2 font-mono text-xs text-slate-500">{p.reference}</span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500">
                      {new Date(p.received_at).toLocaleString()}
                      {p.received?.full_name && <> • {p.received.full_name}</>}
                      {p.notes && <> • {p.notes}</>}
                    </div>
                  </div>
                  {canRefund && (
                    <Button size="sm" variant="secondary" onClick={() => openRefund(p.id, Number(p.amount))}>
                      <RotateCcw size={14} /> Refund
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {i.refunds.length > 0 && (
            <>
              <h4 className="mt-6 mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Refunds
              </h4>
              <ul className="divide-y divide-slate-100">
                {i.refunds.map((r: any) => (
                  <li key={r.id} className="flex items-center justify-between py-2 text-sm">
                    <div>
                      <span className="font-medium text-red-600">-Rs.{Number(r.amount).toFixed(2)}</span>
                      <span className="ml-2 text-slate-500">{r.reason}</span>
                    </div>
                    <span className="text-xs text-slate-500">
                      {new Date(r.refunded_at).toLocaleString()}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </CardBody>
      </Card>

      {i.notes && (
        <Card className="mb-6">
          <CardBody>
            <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Notes</h4>
            <p className="text-sm text-slate-700 whitespace-pre-wrap">{i.notes}</p>
          </CardBody>
        </Card>
      )}

      {/* ─── Modals ───────────────────────────────────────────── */}
      <Modal open={payOpen} onClose={() => setPayOpen(false)} title="Record payment"
        footer={<><Button variant="secondary" onClick={() => setPayOpen(false)}>Cancel</Button>
          <Button onClick={onPay} loading={recordPay.isPending}>Save payment</Button></>}>
        <div className="space-y-4">
          {error && <Alert tone="error">{error}</Alert>}
          <div className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-600">
            Balance: <span className="font-mono font-medium text-slate-900">Rs.{(i.balance_amount < 0.005 ? 0 : i.balance_amount).toFixed(2)}</span>
          </div>
          <Input label="Amount (Rs.) *" type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <Select label="Method *" value={method} onChange={(e) => setMethod(e.target.value as any)}>
            <option value="CASH">Cash</option>
            <option value="CARD">Card</option>
            <option value="UPI">UPI</option>
            <option value="NETBANKING">Net banking</option>
            <option value="INSURANCE">Insurance</option>
            <option value="CREDIT">Credit (pay later)</option>
            <option value="OTHER">Other</option>
          </Select>
          <Input label="Reference (txn ID / cheque / UPI ref)" value={reference} onChange={(e) => setReference(e.target.value)} />
          <Input label="Notes" value={payNotes} onChange={(e) => setPayNotes(e.target.value)} />
        </div>
      </Modal>

      <Modal open={refundOpen} onClose={() => setRefundOpen(false)} title="Refund payment"
        footer={<><Button variant="secondary" onClick={() => setRefundOpen(false)}>Cancel</Button>
          <Button onClick={onRefund} loading={refund.isPending} variant="danger">Confirm refund</Button></>}>
        <div className="space-y-4">
          {error && <Alert tone="error">{error}</Alert>}
          <Alert tone="info">Refunds are audit-logged with the reason and operator name.</Alert>
          <Input label="Amount (Rs.) *" type="number" step="0.01" value={refundAmount} onChange={(e) => setRefundAmount(e.target.value)} />
          <Input label="Reason *" value={refundReason} onChange={(e) => setRefundReason(e.target.value)}
            placeholder="Duplicate charge / cancelled service / ..." />
        </div>
      </Modal>

      <Modal open={discountOpen} onClose={() => setDiscountOpen(false)} title="Apply discount"
        footer={<><Button variant="secondary" onClick={() => setDiscountOpen(false)}>Cancel</Button>
          <Button onClick={onSaveDiscount} loading={updateDiscount.isPending}>
            <Check size={14} /> Save discount
          </Button></>}>
        <div className="space-y-4">
          {error && <Alert tone="error">{error}</Alert>}
          <div className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-600">
            Subtotal: <span className="font-mono font-medium text-slate-900">Rs.{i.subtotal.toFixed(2)}</span>
          </div>
          <Input
            label="Discount amount (Rs.)"
            type="number"
            step="0.01"
            min="0"
            value={discountInput}
            onChange={(e) => setDiscountInput(e.target.value)}
          />
          <Alert tone="info">
            <div className="flex items-start gap-2">
              <Percent size={14} className="mt-0.5 shrink-0" />
              <p className="text-xs">
                New total will be <strong>Rs.{Math.max(i.subtotal - (Number(discountInput) || 0) + (i.tax_amount || 0), 0).toFixed(2)}</strong>.
              </p>
            </div>
          </Alert>
        </div>
      </Modal>

      <PrintPreviewModal
        open={printOpen}
        onClose={() => setPrintOpen(false)}
        title={`Invoice ${i.invoice_no}`}
      >
        <InvoicePrint organization={organization.data} invoice={i} />
      </PrintPreviewModal>
    </>
  );
}

function Row({ label, value, tone }: { label: React.ReactNode; value: React.ReactNode; tone?: 'green' | 'red' }) {
  const toneCls = tone === 'green' ? 'text-green-600' : tone === 'red' ? 'text-red-600' : 'text-slate-700';
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-600">{label}</span>
      <span className={`font-mono ${toneCls}`}>{value}</span>
    </div>
  );
}
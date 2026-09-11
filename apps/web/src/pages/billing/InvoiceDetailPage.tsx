import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, BanknoteIcon, Printer, Receipt, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { PageHeader } from '@/components/ui/PageHeader';
import { Alert } from '@/components/ui/Alert';
import { Spinner } from '@/components/ui/Spinner';
import { useInvoice, useRecordPayment, useRefundPayment } from '@/hooks/useBilling';
import { usePermissions } from '@/hooks/useAuth';
import { PERMISSIONS } from '@medical/shared';

const statusTone: Record<string, BadgeTone> = {
  UNPAID: 'red', PARTIAL: 'yellow', PAID: 'green', REFUNDED: 'gray', CANCELLED: 'gray',
};
const itemTypeTone: Record<string, BadgeTone> = {
  CONSULTATION: 'blue', LAB: 'purple', PHARMACY: 'green', PROCEDURE: 'yellow', IPD: 'red', MANUAL: 'gray',
};

export function InvoiceDetailPage() {
  const { invoiceId } = useParams<{ invoiceId: string }>();
  const inv = useInvoice(invoiceId);
  const recordPay = useRecordPayment(invoiceId ?? '');
  const refund = useRefundPayment(invoiceId ?? '');
  const { can } = usePermissions();

  const [payOpen, setPayOpen] = useState(false);
  const [refundOpen, setRefundOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // payment form
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<'CASH'|'CARD'|'UPI'|'NETBANKING'|'INSURANCE'|'CREDIT'|'OTHER'>('CASH');
  const [reference, setReference] = useState('');
  const [payNotes, setPayNotes] = useState('');

  // refund form
  const [refundPaymentId, setRefundPaymentId] = useState('');
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');

  if (inv.isLoading) return <div className="flex justify-center py-20"><Spinner size={32} /></div>;
  if (inv.isError || !inv.data) return <Alert tone="error">Failed to load invoice.</Alert>;

  const i = inv.data;
  const canPay    = can(PERMISSIONS.BILLING_MANAGE);
  const canRefund = can(PERMISSIONS.BILLING_REFUND);

  function openPay() {
    setAmount(String(i.balance_amount));
    setMethod('CASH'); setReference(''); setPayNotes('');
    setError(null); setPayOpen(true);
  }

  async function onPay() {
    setError(null);
    try {
      await recordPay.mutateAsync({
        amount: Number(amount),
        method,
        reference: reference || null,
        notes: payNotes || null,
      });
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
    try {
      await refund.mutateAsync({
        paymentId: refundPaymentId,
        amount: Number(refundAmount),
        reason: refundReason,
      });
      setRefundOpen(false);
    } catch (e: any) { setError(e?.message ?? 'Failed to refund'); }
  }

  return (
    <>
      <div className="mb-4 flex items-center justify-between print:hidden">
        <Link to="/billing/invoices" className="inline-flex items-center gap-1 text-sm text-brand-600 hover:underline">
          <ArrowLeft size={14} /> Back to invoices
        </Link>
        <Button variant="secondary" size="sm" onClick={() => window.print()}>
          <Printer size={14} /> Print / Save PDF
        </Button>
      </div>

      <PageHeader
        title={`Invoice ${i.invoice_no}`}
        subtitle={`${i.patients?.full_name} | ${i.patients?.uhid}`}
        action={
          <Badge tone={statusTone[i.status] ?? 'gray'} className="px-3 py-1.5 text-sm">
            {i.status}
          </Badge>
        }
      />

      {error && !payOpen && !refundOpen && <div className="mb-4"><Alert tone="error">{error}</Alert></div>}

      {/* Header info */}
      <Card className="mb-6">
        <CardBody className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <Info label="Patient"   value={i.patients?.full_name} sub={i.patients?.uhid} />
          <Info label="Mobile"    value={i.patients?.mobile ?? '-'} />
          <Info label="Branch"    value={i.branches?.name} sub={i.branches?.branch_code} />
          <Info label="Issued"    value={new Date(i.created_at).toLocaleString()} />
        </CardBody>
      </Card>

      {/* Totals summary */}
      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
        <Stat label="Subtotal"        value={i.subtotal} />
        <Stat label="Tax"             value={i.tax_amount} />
        <Stat label="Discount"        value={-i.discount_amount} negative />
        <Stat label="Total"           value={i.total_amount} emphasis />
      </div>

      {/* Line items */}
      <Card className="mb-6">
        <CardHeader title="Items" subtitle={`${i.items.length} line item(s)`} />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3">Type</th>
                <th className="px-5 py-3">Description</th>
                <th className="px-5 py-3 text-right">Qty</th>
                <th className="px-5 py-3 text-right">Unit price</th>
                <th className="px-5 py-3 text-right">Discount</th>
                <th className="px-5 py-3 text-right">Tax %</th>
                <th className="px-5 py-3 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {i.items.map((it) => (
                <tr key={it.id}>
                  <td className="px-5 py-3">
                    <Badge tone={itemTypeTone[it.item_type] ?? 'gray'}>{it.item_type}</Badge>
                  </td>
                  <td className="px-5 py-3 text-slate-800">{it.description}</td>
                  <td className="px-5 py-3 text-right">{it.qty}</td>
                  <td className="px-5 py-3 text-right font-mono">Rs.{it.unit_price.toFixed(2)}</td>
                  <td className="px-5 py-3 text-right font-mono text-slate-500">Rs.{it.discount.toFixed(2)}</td>
                  <td className="px-5 py-3 text-right text-slate-500">{it.tax_rate}%</td>
                  <td className="px-5 py-3 text-right font-mono font-medium">Rs.{it.amount.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50 font-medium">
                <td colSpan={6} className="px-5 py-3 text-right text-slate-600">Total</td>
                <td className="px-5 py-3 text-right font-mono">Rs.{i.total_amount.toFixed(2)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

      {/* Payment ledger + refunds */}
      <Card className="mb-6">
        <CardHeader
          title="Payments"
          subtitle={`Paid Rs.${i.paid_amount.toFixed(2)} | Balance Rs.${i.balance_amount.toFixed(2)}`}
          action={
            canPay && i.balance_amount > 0 && i.status !== 'CANCELLED' ? (
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
              {i.payments.map((p) => (
                <li key={p.id} className="flex items-center justify-between py-3">
                  <div>
                    <div className="text-sm font-medium text-slate-900">
                      Rs.{p.amount.toFixed(2)} <span className="text-slate-400">via</span> {p.method}
                      {p.reference && <span className="ml-2 font-mono text-xs text-slate-500">{p.reference}</span>}
                    </div>
                    <div className="text-xs text-slate-500">
                      {new Date(p.received_at).toLocaleString()}
                      {p.received?.full_name && <> | {p.received.full_name}</>}
                      {p.notes && <> | {p.notes}</>}
                    </div>
                  </div>
                  {canRefund && i.status !== 'REFUNDED' && (
                    <Button size="sm" variant="secondary" onClick={() => openRefund(p.id, p.amount)}>
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
                {i.refunds.map((r) => (
                  <li key={r.id} className="flex items-center justify-between py-2 text-sm">
                    <div>
                      <span className="font-medium text-red-600">- Rs.{r.amount.toFixed(2)}</span>
                      <span className="ml-2 text-slate-500">{r.reason}</span>
                    </div>
                    <span className="text-xs text-slate-500">{new Date(r.refunded_at).toLocaleString()}</span>
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

      <Card className="mb-6 hidden print:block">
        <CardBody className="text-center text-xs text-slate-500">
          <Receipt size={16} className="mx-auto mb-2" />
          This is a computer-generated invoice. No signature required.
        </CardBody>
      </Card>

      {/* ---------- Record payment modal ---------- */}
      <Modal open={payOpen} onClose={() => setPayOpen(false)} title="Record payment"
        footer={<><Button variant="secondary" onClick={() => setPayOpen(false)}>Cancel</Button>
          <Button onClick={onPay} loading={recordPay.isPending}>Save payment</Button></>}>
        <div className="space-y-4">
          {error && <Alert tone="error">{error}</Alert>}
          <div className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-600">
            Balance: <span className="font-mono font-medium text-slate-900">Rs.{i.balance_amount.toFixed(2)}</span>
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

      {/* ---------- Refund modal ---------- */}
      <Modal open={refundOpen} onClose={() => setRefundOpen(false)} title="Refund payment"
        footer={<><Button variant="secondary" onClick={() => setRefundOpen(false)}>Cancel</Button>
          <Button onClick={onRefund} loading={refund.isPending} variant="danger">Confirm refund</Button></>}>
        <div className="space-y-4">
          {error && <Alert tone="error">{error}</Alert>}
          <Alert tone="info">Refunds are audit-logged with the reason and the operator's name.</Alert>
          <Input label="Amount (Rs.) *" type="number" step="0.01" value={refundAmount} onChange={(e) => setRefundAmount(e.target.value)} />
          <Input label="Reason *" value={refundReason} onChange={(e) => setRefundReason(e.target.value)}
            placeholder="Duplicate charge / cancelled service / ..." />
        </div>
      </Modal>
    </>
  );
}

function Info({ label, value, sub }: { label: string; value?: string | null; sub?: string | null }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-slate-900">{value ?? '-'}</p>
      {sub && <p className="font-mono text-xs text-slate-500">{sub}</p>}
    </div>
  );
}

function Stat({ label, value, emphasis, negative }:
  { label: string; value: number; emphasis?: boolean; negative?: boolean }) {
  return (
    <Card>
      <CardBody>
        <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
        <p className={`mt-1 font-mono ${emphasis ? 'text-lg font-semibold' : 'text-base'} ${negative ? 'text-red-600' : 'text-slate-900'}`}>
          Rs.{value.toFixed(2)}
        </p>
      </CardBody>
    </Card>
  );
}

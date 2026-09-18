import { PrintHeader } from './PrintHeader';

interface Props {
  organization?: any;
  invoice: {
    invoice_no: string;
    created_at: string;
    status: string;
    subtotal: number;
    discount_amount: number;
    tax_amount: number;
    total_amount: number;
    paid_amount: number;
    balance_amount: number;
    notes?: string | null;
    patients?: {
      full_name: string;
      uhid: string;
      mobile?: string | null;
      date_of_birth?: string | null;
      gender?: string | null;
      address?: string | null;
    };
    items: Array<{
      id: string;
      item_type: string;
      description: string;
      qty: number;
      unit_price: number;
      discount: number;
      tax_rate: number;
      amount: number;
    }>;
    payments?: Array<{
      id: string;
      amount: number;
      method: string;
      reference?: string | null;
      received_at: string;
    }>;
  };
}

function money(n: number) {
  return '₹' + (n ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function InvoicePrint({ organization, invoice }: Props) {
  return (
    <div className="text-ink-900">
      <PrintHeader
        organization={organization}
        title="Invoice"
        subtitle={`No. ${invoice.invoice_no} · ${new Date(invoice.created_at).toLocaleDateString('en-IN')}`}
      />

      {/* Bill from / Bill to */}
      <div className="mb-6 grid grid-cols-1 gap-4 text-[12px] md:grid-cols-2 md:gap-10">
        <div>
          <p className="mb-2 text-[11px] font-bold text-ink-800">Bill from:</p>
          <p className="text-ink-800">{organization?.name ?? 'Hospital'}</p>
          {organization?.legal_name && <p className="text-ink-600">{organization.legal_name}</p>}
          {organization?.address && <p className="text-ink-600">{organization.address}</p>}
          {(organization?.city || organization?.pincode) && (
            <p className="text-ink-600">
              {[organization.city, organization.state, organization.pincode].filter(Boolean).join(', ')}
            </p>
          )}
          {organization?.phone && <p className="text-ink-600">{organization.phone}</p>}
          {organization?.email && <p className="text-ink-600">{organization.email}</p>}
        </div>
        <div>
          <p className="mb-2 text-[11px] font-bold text-ink-800">Bill to:</p>
          <p className="text-ink-800">{invoice.patients?.full_name ?? 'Patient'}</p>
          <p className="font-mono text-ink-600">{invoice.patients?.uhid ?? '-'}</p>
          {invoice.patients?.address && <p className="text-ink-600">{invoice.patients.address}</p>}
          {invoice.patients?.mobile && <p className="text-ink-600">{invoice.patients.mobile}</p>}
        </div>
      </div>

      {/* Items table */}
      <div className="mb-6 overflow-x-auto"><table className="mb-6 w-full border-collapse text-[12px]">
        <thead>
          <tr className="border-y border-ink-900 text-left">
            <th className="w-[45%] py-3 pr-2 text-[11px] font-bold uppercase tracking-wider text-ink-800">Item</th>
            <th className="w-[12%] py-3 pr-2 text-center text-[11px] font-bold uppercase tracking-wider text-ink-800">Quantity</th>
            <th className="w-[15%] py-3 pr-2 text-right text-[11px] font-bold uppercase tracking-wider text-ink-800">Rate</th>
            <th className="w-[13%] py-3 pr-2 text-right text-[11px] font-bold uppercase tracking-wider text-ink-800">Tax</th>
            <th className="w-[15%] py-3 pl-2 text-right text-[11px] font-bold uppercase tracking-wider text-ink-800">Amount</th>
          </tr>
        </thead>
        <tbody>
          {invoice.items.map((it) => (
            <tr key={it.id} className="border-b border-ink-200">
              <td className="py-4 pr-2 align-top">
                <p className="font-medium text-ink-900">{it.description}</p>
                <p className="mt-0.5 text-[10px] uppercase tracking-wider text-ink-400">{it.item_type}</p>
              </td>
              <td className="py-4 pr-2 align-top text-center tabular-nums">{String(it.qty).padStart(2, '0')}</td>
              <td className="py-4 pr-2 align-top text-right tabular-nums">{money(it.unit_price)}</td>
              <td className="py-4 pr-2 align-top text-right tabular-nums">{it.tax_rate ? `${it.tax_rate}%` : '0.00'}</td>
              <td className="py-4 pl-2 align-top text-right font-semibold tabular-nums">{money(it.amount)}</td>
            </tr>
          ))}
          {invoice.items.length === 0 && (
            <tr><td colSpan={5} className="py-8 text-center text-ink-400">No items</td></tr>
          )}
        </tbody>
      </table></div>

      {/* Terms + Totals */}
      <div className="mb-8 grid grid-cols-2 gap-10 text-[12px]">
        <div>
          <p className="mb-1 text-[11px] font-semibold text-ink-700">Terms &amp; Conditions:</p>
          <p className="text-ink-500">
            Payment is due within 15 days from date of issue. Please retain this invoice for your records.
          </p>
        </div>
        <div className="space-y-1.5">
          <Line label="Subtotal" value={money(invoice.subtotal)} />
          <Line label="Discount" value={money(invoice.discount_amount)} muted={invoice.discount_amount === 0} />
          <Line label="Tax"      value={money(invoice.tax_amount)} muted={invoice.tax_amount === 0} />
          <Line label="Paid"     value={money(invoice.paid_amount)} />
        </div>
      </div>

      {/* Grand total bar */}
      <div className="flex justify-end">
        <div className="print-banner flex w-full items-center justify-between gap-4 rounded-md bg-brand-800 px-4 py-4 text-white sm:gap-6 sm:px-6 md:w-auto md:min-w-[280px]">
          <span className="text-[14px] font-bold uppercase tracking-wider">Total</span>
          <span className="text-[18px] font-bold tabular-nums">{money(invoice.total_amount)}</span>
        </div>
      </div>

      {/* Payment history */}
      {invoice.payments && invoice.payments.length > 0 && (
        <div className="mt-10">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-ink-700">Payment history</p>
          <div className="overflow-x-auto"><table className="w-full border-collapse text-[11px]">
            <thead>
              <tr className="border-b border-ink-300 text-left">
                <th className="py-2 pr-2 font-semibold">Date</th>
                <th className="py-2 pr-2 font-semibold">Method</th>
                <th className="py-2 pr-2 font-semibold">Reference</th>
                <th className="py-2 pl-2 text-right font-semibold">Amount</th>
              </tr>
            </thead>
            <tbody>
              {invoice.payments.map((p) => (
                <tr key={p.id} className="border-b border-ink-100">
                  <td className="py-2 pr-2">{new Date(p.received_at).toLocaleString('en-IN')}</td>
                  <td className="py-2 pr-2 uppercase">{p.method}</td>
                  <td className="py-2 pr-2 font-mono">{p.reference ?? '-'}</td>
                  <td className="py-2 pl-2 text-right tabular-nums">{money(p.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </div>
      )}

      {invoice.notes && (
        <div className="mt-8">
          <p className="mb-1 text-[11px] font-semibold text-ink-700">Notes</p>
          <p className="text-[11px] italic text-ink-500">{invoice.notes}</p>
        </div>
      )}

      <div className="mt-12 border-t border-ink-300 pt-3 text-center text-[10px] text-ink-500">
        This is a computer-generated invoice. Thank you for choosing us.
      </div>
    </div>
  );
}

function Line({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-ink-600">{label}:</span>
      <span className={muted ? 'tabular-nums text-ink-400' : 'tabular-nums text-ink-900'}>{value}</span>
    </div>
  );
}
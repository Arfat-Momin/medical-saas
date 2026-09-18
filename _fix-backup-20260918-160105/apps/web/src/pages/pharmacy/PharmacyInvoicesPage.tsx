import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Pill } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { Alert } from '@/components/ui/Alert';
import { Spinner } from '@/components/ui/Spinner';
import { usePharmacyInvoices } from '@/hooks/useBilling';

const statusTone: Record<string, BadgeTone> = {
  UNPAID: 'red', PARTIAL: 'yellow', PAID: 'green', REFUNDED: 'gray', CANCELLED: 'gray',
};

export function PharmacyInvoicesPage() {
  const [page, setPage] = useState(1);
  const list = usePharmacyInvoices({ page, pageSize: 20 });
  const totalPages = list.data ? Math.max(1, Math.ceil(list.data.total / (list.data.pageSize || 20))) : 1;

  return (
    <>
      <PageHeader
        title="Pharmacy Invoices"
        subtitle="Medicine dispensing bills â€” MED-XXXXX"
      />

      {list.isLoading && <div className="flex justify-center py-12"><Spinner size={28} /></div>}
      {list.isError && <Alert tone="error">Failed to load pharmacy invoices.</Alert>}

      {list.data?.rows.length === 0 && (
        <EmptyState
          title="No pharmacy invoices yet"
          description="Invoices are generated automatically when medicines are dispensed from the queue."
        />
      )}

      {list.data && list.data.rows.length > 0 && (
        <>
          <Card className="overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3">Invoice #</th>
                  <th className="px-5 py-3">Patient UHID</th>
                  <th className="px-5 py-3">Patient</th>
                  <th className="px-5 py-3">Date</th>
                  <th className="px-5 py-3 text-right">Total</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {list.data.rows.map((inv: any) => (
                  <tr key={inv.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3 font-mono text-xs text-brand-700">{inv.invoice_no}</td>
                    <td className="px-5 py-3 font-mono text-xs text-slate-700">{inv.patients?.uhid}</td>
                    <td className="px-5 py-3 font-medium text-slate-900">{inv.patients?.full_name}</td>
                    <td className="px-5 py-3 text-slate-600">{new Date(inv.created_at).toLocaleDateString()}</td>
                    <td className="px-5 py-3 text-right font-mono">Rs.{inv.total_amount.toFixed(2)}</td>
                    <td className="px-5 py-3"><Badge tone={statusTone[inv.status] ?? 'gray'}>{inv.status}</Badge></td>
                    <td className="px-5 py-3 text-right">
                      <Link to={`/billing/invoices/${inv.id}`} className="text-sm text-brand-600 hover:underline">Open</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
            <span>{list.data.total} invoice{list.data.total === 1 ? '' : 's'} â€” page {page} of {totalPages}</span>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
              <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
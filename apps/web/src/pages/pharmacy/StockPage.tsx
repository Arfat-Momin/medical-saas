import { AlertTriangle, Clock } from 'lucide-react';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Spinner';
import { useLowStock, useExpiring, useBatches } from '@/hooks/usePharmacy';

export function StockPage() {
  const low = useLowStock();
  const exp = useExpiring();
  const batches = useBatches({ onlyInStock: true });

  return (
    <>
      <PageHeader title="Stock" subtitle="Real-time inventory and alerts" />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Low stock alerts" subtitle={`${low.data?.length ?? 0} item(s) at or below reorder level`}
            action={<AlertTriangle size={16} className="text-amber-500" />} />
          <CardBody>
            {low.isLoading && <div className="flex justify-center py-6"><Spinner size={22} /></div>}
            {low.data?.length === 0 && <EmptyState title="No low stock" description="All medicines are above reorder level" />}
            {low.data && low.data.length > 0 && (
              <ul className="divide-y divide-slate-100">
                {low.data.map((r) => (
                  <li key={r.medicine_id} className="flex items-center justify-between py-2">
                    <span className="text-sm font-medium text-slate-800">{r.name}</span>
                    <span className="text-sm text-slate-500">
                      <span className={r.total_qty === 0 ? 'text-red-600 font-medium' : 'text-amber-600'}>{r.total_qty}</span>
                      <span className="mx-1 text-slate-300">/</span>
                      {r.reorder_level} reorder
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Expiring soon" subtitle={`${exp.data?.length ?? 0} batch(es) within 90 days`}
            action={<Clock size={16} className="text-orange-500" />} />
          <CardBody>
            {exp.isLoading && <div className="flex justify-center py-6"><Spinner size={22} /></div>}
            {exp.data?.length === 0 && <EmptyState title="Nothing expiring soon" />}
            {exp.data && exp.data.length > 0 && (
              <ul className="divide-y divide-slate-100">
                {exp.data.map((r) => (
                  <li key={r.batch_id} className="flex items-center justify-between py-2">
                    <div>
                      <div className="text-sm font-medium text-slate-800">{r.medicine_name}</div>
                      <div className="font-mono text-xs text-slate-500">Batch {r.batch_no}</div>
                    </div>
                    <div className="text-right">
                      <Badge tone={new Date(r.expiry_date) < new Date() ? 'red' : 'yellow'}>{r.expiry_date}</Badge>
                      <div className="mt-1 text-xs text-slate-500">{r.current_qty} in stock</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>

      <Card className="mt-6 overflow-x-auto overflow-y-hidden">
        <CardHeader title="In-stock batches" subtitle={`${batches.data?.length ?? 0} batch(es) with quantity > 0`} />
        {batches.isLoading ? (
          <div className="flex justify-center py-8"><Spinner size={22} /></div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3">Medicine</th>
                <th className="px-5 py-3">Batch</th>
                <th className="px-5 py-3">Expiry</th>
                <th className="px-5 py-3 text-right">Qty</th>
                <th className="px-5 py-3 text-right">MRP</th>
                <th className="px-5 py-3 text-right">Selling</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {batches.data?.map((b) => (
                <tr key={b.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3 font-medium text-slate-900">{b.medicines?.name}</td>
                  <td className="px-5 py-3 font-mono text-xs text-slate-600">{b.batch_no}</td>
                  <td className="px-5 py-3 text-slate-600">{b.expiry_date}</td>
                  <td className="px-5 py-3 text-right font-mono">{b.current_qty}</td>
                  <td className="px-5 py-3 text-right text-slate-600">{b.mrp ? `Rs.${b.mrp}` : '-'}</td>
                  <td className="px-5 py-3 text-right text-slate-600">{b.selling_price ? `Rs.${b.selling_price}` : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}
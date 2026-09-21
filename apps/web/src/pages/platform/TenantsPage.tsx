import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { Alert } from '@/components/ui/Alert';
import { Spinner } from '@/components/ui/Spinner';
import { useTenants } from '@/hooks/usePlatform';

const statusTone: Record<string, BadgeTone> = {
  TRIAL: 'blue', ACTIVE: 'green', GRACE: 'yellow', SUSPENDED: 'red', CANCELLED: 'gray',
};

export function TenantsPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const list = useTenants({ search, status: status || undefined, page, pageSize: 20 });

  const totalPages = list.data ? Math.max(1, Math.ceil(list.data.total / (list.data.pageSize || 20))) : 1;

  return (
    <>
      <PageHeader title="Tenants" subtitle="Hospitals and clinics registered on the platform" />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="w-full sm:w-72">
          <Input
            placeholder="Search by name, code or slug"
            leftIcon={<Search size={14} />}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <div className="w-full sm:w-48">
          <Select label="Status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="">All statuses</option>
            <option value="TRIAL">Trial</option>
            <option value="ACTIVE">Active</option>
            <option value="GRACE">Grace</option>
            <option value="SUSPENDED">Suspended</option>
            <option value="CANCELLED">Cancelled</option>
          </Select>
        </div>
      </div>

      {list.isLoading && <div className="flex justify-center py-12"><Spinner size={28} /></div>}
      {list.isError && <Alert tone="error">Failed to load tenants.</Alert>}

      {list.data?.rows.length === 0 && (
        <EmptyState title="No tenants found" description="No matches for the current filters." />
      )}

      {list.data && list.data.rows.length > 0 && (
        <>
          <Card className="overflow-x-auto overflow-y-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3">Tenant</th>
                  <th className="px-5 py-3">Type</th>
                  <th className="px-5 py-3">Plan</th>
                  <th className="px-5 py-3">Subscription</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {list.data.rows.map((t) => {
                  const sub = t.latest_subscription;
                  const days = sub ? Math.max(0, Math.ceil((new Date(sub.ends_at).getTime() - Date.now()) / (24 * 60 * 60 * 1000))) : 0;
                  return (
                    <tr key={t.id} className="hover:bg-slate-50">
                      <td className="px-5 py-3">
                        <div className="font-medium text-slate-900">{t.name}</div>
                        <div className="font-mono text-xs text-slate-500">{t.tenant_code}</div>
                      </td>
                      <td className="px-5 py-3 text-slate-600">{t.type}</td>
                      <td className="px-5 py-3 text-slate-600">
                        {sub?.plans?.name ?? '-'}
                        {sub?.plans?.price_paise !== undefined && (
                          <div className="text-xs text-slate-500">
                            Rs.{(sub.plans.price_paise / 100).toFixed(0)}/{sub.plans.billing_cycle === 'MONTHLY' ? 'mo' : 'yr'}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-3 text-slate-600 text-xs">
                        {sub ? (
                          <>
                            <div>{new Date(sub.ends_at).toLocaleDateString()}</div>
                            {days <= 30 && (
                              <Badge tone={days <= 7 ? 'red' : 'yellow'}>{days}d left</Badge>
                            )}
                          </>
                        ) : '-'}
                      </td>
                      <td className="px-5 py-3">
                        <Badge tone={statusTone[t.status] ?? 'gray'}>{t.status}</Badge>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <Link to={`/tenants/${t.id}`} className="text-sm text-brand-600 hover:underline">
                          Manage
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>

          <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
            <span>{list.data.total} tenant{list.data.total === 1 ? '' : 's'} - page {page} of {totalPages}</span>
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

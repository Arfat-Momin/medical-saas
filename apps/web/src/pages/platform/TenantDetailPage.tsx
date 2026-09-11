import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Calendar, Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { PageHeader } from '@/components/ui/PageHeader';
import { Alert } from '@/components/ui/Alert';
import { Spinner } from '@/components/ui/Spinner';
import { useTenant, useUpdateTenant, useExtendSubscription } from '@/hooks/usePlatform';
import type { TenantStatus } from '@/repositories/platform.repository';

const statusTone: Record<string, BadgeTone> = {
  TRIAL: 'blue', ACTIVE: 'green', GRACE: 'yellow', SUSPENDED: 'red', CANCELLED: 'gray',
};

export function TenantDetailPage() {
  const { tenantId } = useParams<{ tenantId: string }>();
  const t = useTenant(tenantId);
  const update = useUpdateTenant();
  const extend = useExtendSubscription();

  const [statusOpen, setStatusOpen] = useState(false);
  const [newStatus, setNewStatus] = useState<TenantStatus>('ACTIVE');

  const [extendOpen, setExtendOpen] = useState(false);
  const [extendDays, setExtendDays] = useState('30');
  const [extendNotes, setExtendNotes] = useState('');

  const [error, setError] = useState<string | null>(null);

  if (t.isLoading) return <div className="flex justify-center py-20"><Spinner size={32} /></div>;
  if (t.isError || !t.data) return <Alert tone="error">Failed to load tenant.</Alert>;

  const tenant = t.data;
  const latest = tenant.subscriptions[0];

  async function onStatusSubmit() {
    setError(null);
    try {
      await update.mutateAsync({ id: tenant.id, patch: { status: newStatus } });
      setStatusOpen(false);
    } catch (e: any) { setError(e?.message ?? 'Failed'); }
  }

  async function onExtendSubmit() {
    setError(null);
    try {
      await extend.mutateAsync({ id: tenant.id, days: Number(extendDays), notes: extendNotes || null });
      setExtendOpen(false);
    } catch (e: any) { setError(e?.message ?? 'Failed'); }
  }

  return (
    <>
      <div className="mb-4">
        <Link to="/tenants" className="inline-flex items-center gap-1 text-sm text-brand-600 hover:underline">
          <ArrowLeft size={14} /> Back to tenants
        </Link>
      </div>

      <PageHeader
        title={tenant.name}
        subtitle={`${tenant.tenant_code} - ${tenant.slug}`}
        action={
          <div className="flex items-center gap-2">
            <Badge tone={statusTone[tenant.status] ?? 'gray'} className="px-3 py-1.5 text-sm">
              {tenant.status}
            </Badge>
            <Button variant="secondary" size="sm" onClick={() => { setNewStatus(tenant.status); setStatusOpen(true); }}>
              Change status
            </Button>
            {latest && (
              <Button size="sm" onClick={() => { setExtendDays('30'); setExtendNotes(''); setExtendOpen(true); }}>
                <Plus size={14} /> Extend subscription
              </Button>
            )}
          </div>
        }
      />

      {error && !statusOpen && !extendOpen && <div className="mb-4"><Alert tone="error">{error}</Alert></div>}

      <Card className="mb-6">
        <CardBody className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <Info label="Type" value={tenant.type} />
          <Info label="Contact email" value={tenant.contact_email ?? '-'} />
          <Info label="Contact phone" value={tenant.contact_phone ?? '-'} />
          <Info label="Created" value={new Date(tenant.created_at).toLocaleDateString()} />
        </CardBody>
      </Card>

      {latest && (
        <Card className="mb-6">
          <CardHeader title="Current subscription" subtitle={`Plan: ${latest.plans.name}`} action={<Calendar size={16} className="text-slate-400" />} />
          <CardBody className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <Info label="Status" value={latest.status} />
            <Info label="Starts" value={new Date(latest.starts_at).toLocaleDateString()} />
            <Info label="Ends"   value={new Date(latest.ends_at).toLocaleDateString()} />
            <Info label="Price"  value={`Rs.${(latest.plans.price_paise / 100).toFixed(2)} / ${latest.plans.billing_cycle === 'MONTHLY' ? 'month' : 'year'}`} />
          </CardBody>
        </Card>
      )}

      <Card className="mb-6">
        <CardHeader title="Subscription history" subtitle={`${tenant.subscriptions.length} record(s)`} />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3">Plan</th>
                <th className="px-5 py-3">Starts</th>
                <th className="px-5 py-3">Ends</th>
                <th className="px-5 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tenant.subscriptions.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3 font-medium text-slate-800">{s.plans.name}</td>
                  <td className="px-5 py-3 text-slate-600">{new Date(s.starts_at).toLocaleDateString()}</td>
                  <td className="px-5 py-3 text-slate-600">{new Date(s.ends_at).toLocaleDateString()}</td>
                  <td className="px-5 py-3"><Badge tone={statusTone[s.status] ?? 'gray'}>{s.status}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <CardHeader title="Payment history" subtitle={`${tenant.payments.length} payment(s)`} />
        <CardBody>
          {tenant.payments.length === 0 && (
            <p className="text-sm text-slate-500">
              No online payments yet. Razorpay-powered subscription payments will appear here once Module 10 is live.
            </p>
          )}
          {tenant.payments.length > 0 && (
            <ul className="divide-y divide-slate-100">
              {tenant.payments.map((p) => (
                <li key={p.id} className="flex items-center justify-between py-3 text-sm">
                  <div>
                    <span className="font-mono font-medium text-slate-800">
                      Rs.{(p.amount_paise / 100).toFixed(2)}
                    </span>
                    <span className="ml-2 text-slate-500">{p.status}</span>
                    {p.razorpay_payment_id && (
                      <span className="ml-2 font-mono text-xs text-slate-400">{p.razorpay_payment_id}</span>
                    )}
                  </div>
                  <span className="text-xs text-slate-500">{new Date(p.created_at).toLocaleString()}</span>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      {/* Status modal */}
      <Modal open={statusOpen} onClose={() => setStatusOpen(false)} title="Change tenant status"
        footer={<><Button variant="secondary" onClick={() => setStatusOpen(false)}>Cancel</Button>
          <Button onClick={onStatusSubmit} loading={update.isPending}>Save</Button></>}>
        <div className="space-y-3">
          <Alert tone="info">
            Suspending a tenant blocks all their users from logging in. Use it only when necessary.
          </Alert>
          <Select label="New status" value={newStatus} onChange={(e) => setNewStatus(e.target.value as TenantStatus)}>
            <option value="TRIAL">Trial</option>
            <option value="ACTIVE">Active</option>
            <option value="GRACE">Grace</option>
            <option value="SUSPENDED">Suspended</option>
            <option value="CANCELLED">Cancelled</option>
          </Select>
        </div>
      </Modal>

      {/* Extend modal */}
      <Modal open={extendOpen} onClose={() => setExtendOpen(false)} title="Extend subscription"
        footer={<><Button variant="secondary" onClick={() => setExtendOpen(false)}>Cancel</Button>
          <Button onClick={onExtendSubmit} loading={extend.isPending}>Extend</Button></>}>
        <div className="space-y-3">
          <Input label="Days to add" type="number" min="1" value={extendDays} onChange={(e) => setExtendDays(e.target.value)} />
          <Input label="Notes (optional)" value={extendNotes} onChange={(e) => setExtendNotes(e.target.value)}
            placeholder="Manual renewal - cheque received" />
        </div>
      </Modal>
    </>
  );
}

function Info({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-slate-900">{value ?? '-'}</p>
    </div>
  );
}

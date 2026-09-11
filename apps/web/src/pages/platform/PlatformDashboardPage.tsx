import { Link } from 'react-router-dom';
import { Building2, TrendingUp, AlertCircle, CheckCircle2, Clock, Ban } from 'lucide-react';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { Alert } from '@/components/ui/Alert';
import { Spinner } from '@/components/ui/Spinner';
import { usePlatformDashboard } from '@/hooks/usePlatform';
import { useAuthStore } from '@/stores/auth.store';

export function PlatformDashboardPage() {
  const user = useAuthStore((s) => s.user);
  const dash = usePlatformDashboard();

  if (dash.isLoading) return <div className="flex justify-center py-20"><Spinner size={32} /></div>;
  if (dash.isError || !dash.data) return <Alert tone="error">Failed to load dashboard.</Alert>;

  const s = dash.data.stats;
  const revenueRs = (s.totalRevenuePaise / 100).toFixed(2);

  return (
    <>
      <PageHeader
        title={`Welcome, ${user?.fullName ?? 'Admin'}`}
        subtitle="Platform administration - tenants, subscriptions and revenue"
      />

      <Alert tone="info">
        <strong>Platform Admin Mode.</strong> You see only tenant metadata,
        subscription status and payment totals. Patient, clinical and billing
        data inside hospitals is protected by database-level isolation.
      </Alert>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard icon={<Building2 size={18} />} label="Total tenants"    value={s.totalTenants}  tone="slate" />
        <StatCard icon={<CheckCircle2 size={18} />} label="Active"        value={s.active}        tone="green" />
        <StatCard icon={<Clock size={18} />} label="Trial"                value={s.trial}         tone="blue" />
        <StatCard icon={<Ban size={18} />} label="Suspended"              value={s.suspended}     tone="red" />
        <StatCard icon={<AlertCircle size={18} />} label="Expiring in 30 days" value={s.expiringSoon} tone="yellow" />
        <StatCard icon={<TrendingUp size={18} />} label="Total revenue"   value={`Rs.${revenueRs}`} tone="purple" />
      </div>

      <Card className="mt-6">
        <CardHeader
          title="Subscriptions expiring soon"
          subtitle="Next 30 days - reach out for renewals"
        />
        <CardBody>
          {dash.data.expiringSoon.length === 0 && (
            <EmptyState title="Nothing expiring soon" description="All active subscriptions are healthy." />
          )}
          {dash.data.expiringSoon.length > 0 && (
            <ul className="divide-y divide-slate-100">
              {dash.data.expiringSoon.map((r) => (
                <li key={r.id} className="flex items-center justify-between py-3">
                  <div>
                    <Link to={`/tenants/${r.tenant_id}`}
                      className="text-sm font-medium text-brand-700 hover:underline">
                      {r.tenants.name}
                    </Link>
                    <p className="font-mono text-xs text-slate-500">
                      {r.tenants.tenant_code} - {r.plans.name}
                    </p>
                  </div>
                  <div className="text-right">
                    <Badge tone="yellow">{daysUntil(r.ends_at)} days</Badge>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {new Date(r.ends_at).toLocaleDateString()}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <Card className="mt-6">
        <CardHeader title="Quick actions" />
        <CardBody>
          <div className="flex flex-wrap gap-3">
            <Link to="/tenants" className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
              View all tenants
            </Link>
            <Link to="/plans" className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
              Manage plans
            </Link>
          </div>
        </CardBody>
      </Card>
    </>
  );
}

function daysUntil(iso: string): number {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / (24 * 60 * 60 * 1000)));
}

function StatCard({ icon, label, value, tone }: {
  icon: React.ReactNode; label: string; value: string | number;
  tone: 'slate' | 'green' | 'blue' | 'red' | 'yellow' | 'purple';
}) {
  const colors: Record<string, string> = {
    slate:  'bg-slate-100 text-slate-600',
    green:  'bg-green-100 text-green-600',
    blue:   'bg-blue-100 text-blue-600',
    red:    'bg-red-100 text-red-600',
    yellow: 'bg-amber-100 text-amber-700',
    purple: 'bg-purple-100 text-purple-600',
  };
  return (
    <Card>
      <CardBody className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
        </div>
        <span className={`flex h-10 w-10 items-center justify-center rounded-lg ${colors[tone]}`}>
          {icon}
        </span>
      </CardBody>
    </Card>
  );
}

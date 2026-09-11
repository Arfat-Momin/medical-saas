import { Building2, GitBranch, Network, Users } from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { PlatformDashboardPage } from '@/pages/platform/PlatformDashboardPage';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { useBranches } from '@/hooks/useBranches';
import { useUsers } from '@/hooks/useUsers';

export function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  if (user?.isPlatformAdmin) return <PlatformDashboardPage />;
  const isPlatformAdmin = user?.isPlatformAdmin ?? false;

  const branches = useBranches();
  const users = useUsers({ page: 1, pageSize: 1 });

  if (isPlatformAdmin) {
    return (
      <>
        <PageHeader title={`Welcome, ${user?.fullName ?? 'Admin'}`} subtitle="Platform overview" />
        <Card>
          <CardBody>
            <p className="text-sm text-slate-600">
              Platform administration. Open <strong>Tenants</strong> in the sidebar to manage subscriptions.
            </p>
          </CardBody>
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader title={`Welcome, ${user?.fullName ?? 'User'}`} subtitle="Hospital overview" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={<GitBranch size={18} />} label="Branches" value={branches.data?.length ?? '-'} />
        <StatCard icon={<Users size={18} />} label="Staff" value={users.data?.total ?? '-'} />
        <StatCard icon={<Network size={18} />} label="Departments" value="-" />
        <StatCard icon={<Building2 size={18} />} label="Organization" value="Active" />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Branches" subtitle="Active locations" />
          <CardBody>
            {branches.data?.length ? (
              <ul className="space-y-2 text-sm">
                {branches.data.map((b) => (
                  <li key={b.id} className="flex items-center justify-between border-b border-slate-100 pb-2 last:border-0">
                    <span className="font-medium text-slate-800">{b.name}</span>
                    <span className="text-xs text-slate-500">{b.branch_code}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-500">No branches yet.</p>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Getting started" subtitle="Module roadmap" />
          <CardBody>
            <ul className="space-y-2 text-sm text-slate-600">
              <li> Foundation + Auth</li>
              <li> Hospital / Clinic Management</li>
              <li> Patients &amp; Appointments (Module 3-4)</li>
              <li> Pharmacy &amp; Lab (Module 5-6)</li>
              <li> Billing (Module 7)</li>
            </ul>
          </CardBody>
        </Card>
      </div>
    </>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <Card>
      <CardBody className="flex items-center gap-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
          {icon}
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
          <p className="text-lg font-semibold text-slate-900">{value}</p>
        </div>
      </CardBody>
    </Card>
  );
}
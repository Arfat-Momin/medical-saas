import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bed, UserCheck } from 'lucide-react';
import { Card, CardBody } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Select';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { Alert } from '@/components/ui/Alert';
import { Spinner } from '@/components/ui/Spinner';
import { useBranches } from '@/hooks/useBranches';
import { useBeds } from '@/hooks/useIpd';

const statusColor: Record<string, string> = {
  AVAILABLE: 'bg-green-50 border-green-200 text-green-700 hover:border-green-400',
  OCCUPIED:  'bg-red-50 border-red-200 text-red-700 hover:border-red-400',
  INACTIVE:  'bg-slate-50 border-slate-200 text-slate-400',
};

export function BedsPage() {
  const branches = useBranches();
  const [branchId, setBranchId] = useState('');
  const activeBranch = branchId || branches.data?.[0]?.id || '';
  const beds = useBeds(activeBranch || undefined);

  const stats = useMemo(() => {
    const s = { total: 0, available: 0, occupied: 0, inactive: 0 };
    beds.data?.forEach((b) => {
      s.total++;
      if (b.bed_status === 'AVAILABLE') s.available++;
      else if (b.bed_status === 'OCCUPIED') s.occupied++;
      else s.inactive++;
    });
    return s;
  }, [beds.data]);

  const grouped = useMemo(() => {
    const g: Record<string, typeof beds.data> = {};
    beds.data?.forEach((b) => {
      const key = `${b.ward_name ?? 'No ward'} / ${b.room_name ?? 'No room'}`;
      if (!g[key]) g[key] = [];
      g[key]!.push(b);
    });
    return g;
  }, [beds.data]);

  return (
    <>
      <PageHeader title="Beds" subtitle="Live occupancy across all rooms" />

      <div className="mb-4 max-w-xs">
        <Select label="Branch" value={activeBranch} onChange={(e) => setBranchId(e.target.value)}>
          {branches.data?.map((b) => (
            <option key={b.id} value={b.id}>{b.name} ({b.branch_code})</option>
          ))}
        </Select>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Total"     value={stats.total}     tone="slate" />
        <StatCard label="Available" value={stats.available} tone="green" />
        <StatCard label="Occupied"  value={stats.occupied}  tone="red" />
        <StatCard label="Inactive"  value={stats.inactive}  tone="slate" />
      </div>

      {beds.isLoading && <div className="flex justify-center py-12"><Spinner size={28} /></div>}
      {beds.isError && <Alert tone="error">Failed to load beds.</Alert>}

      {beds.data?.length === 0 && (
        <EmptyState
          title="No beds configured"
          description="Create a Facility > Floor > Ward > Room > Bed hierarchy from the Locations page."
          action={<Link to="/ipd/locations" className="text-sm text-brand-600 hover:underline">Go to Locations</Link>}
        />
      )}

      <div className="space-y-6">
        {Object.entries(grouped).map(([group, list]) => (
          <Card key={group}>
            <CardBody>
              <h3 className="mb-3 text-sm font-semibold text-slate-700">{group}</h3>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
                {list?.map((b) => (
                  <Link
                    key={b.bed_id}
                    to={b.current_admission_id ? `/ipd/admissions/${b.current_admission_id}` : '#'}
                    className={`flex flex-col items-center justify-center rounded-lg border-2 p-4 transition-all ${statusColor[b.bed_status]}`}
                  >
                    {b.bed_status === 'OCCUPIED' ? <UserCheck size={22} /> : <Bed size={22} />}
                    <div className="mt-1 text-xs font-semibold">{b.bed_name}</div>
                    <div className="text-[10px] uppercase tracking-wide opacity-70">
                      {b.bed_status}
                    </div>
                  </Link>
                ))}
              </div>
            </CardBody>
          </Card>
        ))}
      </div>
    </>
  );
}

function StatCard({ label, value, tone }: { label: string; value: number; tone: 'slate' | 'green' | 'red' }) {
  const colors = {
    slate: 'text-slate-700 bg-slate-100',
    green: 'text-green-700 bg-green-100',
    red:   'text-red-700 bg-red-100',
  };
  return (
    <Card>
      <CardBody className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
        </div>
        <span className={`flex h-10 w-10 items-center justify-center rounded-lg ${colors[tone]}`}>
          <Bed size={18} />
        </span>
      </CardBody>
    </Card>
  );
}

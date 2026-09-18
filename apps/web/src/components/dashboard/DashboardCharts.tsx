import {
  ResponsiveContainer, LineChart, Line, AreaChart, Area, BarChart, Bar,
  PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import type { TrendPoint, DoctorLoad, StatusBucket } from '@/hooks/useDashboardData';

const BRAND   = '#2563eb';
const ACCENT  = '#16a34a';
const ALERT   = '#d97706';
const PURPLE  = '#7c3aed';
const RED     = '#dc2626';
const SLATE   = '#64748b';

const STATUS_COLORS: Record<string, string> = {
  SCHEDULED:   BRAND,
  CHECKED_IN:  ALERT,
  IN_PROGRESS: PURPLE,
  COMPLETED:   ACCENT,
  CANCELLED:   SLATE,
  NO_SHOW:     RED,
};

function fmtDay(d: string): string {
  const dt = new Date(d + 'T00:00:00');
  return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

function ChartShell({
  title, subtitle, loading, error, children, empty,
}: {
  title: string;
  subtitle?: string;
  loading: boolean;
  error?: boolean;
  empty: boolean;
  children: React.ReactNode;
}) {
  return (
    <Card className="overflow-hidden">
      <CardHeader title={title} subtitle={subtitle} />
      <CardBody className="h-[280px] w-full md:h-[300px]">
        {loading && (
          <div className="flex h-full items-center justify-center"><Spinner size={24} /></div>
        )}
        {!loading && error && (
          <div className="flex h-full items-center justify-center text-sm text-slate-500">
            Failed to load
          </div>
        )}
        {!loading && !error && empty && (
          <div className="flex h-full items-center justify-center text-sm text-slate-400">
            No data yet
          </div>
        )}
        {!loading && !error && !empty && children}
      </CardBody>
    </Card>
  );
}

const tooltipStyle = {
  contentStyle: {
    borderRadius: 8,
    border: '1px solid #e2e8f0',
    boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
    fontSize: 12,
  },
  labelStyle: { color: '#475569', fontWeight: 600 },
};

export function AppointmentsTrendChart({
  data, loading, error,
}: { data: TrendPoint[]; loading: boolean; error?: boolean }) {
  const empty = data.every((p) => p.value === 0);
  return (
    <ChartShell
      title="Appointment volume"
      subtitle="Last 14 days"
      loading={loading}
      error={error}
      empty={empty}
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
          <defs>
            <linearGradient id="apptGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor={BRAND} stopOpacity={0.35} />
              <stop offset="100%" stopColor={BRAND} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis dataKey="date" tickFormatter={fmtDay} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
          <Tooltip {...tooltipStyle} labelFormatter={fmtDay} />
          <Area type="monotone" dataKey="value" name="Appointments" stroke={BRAND} strokeWidth={2} fill="url(#apptGrad)" />
        </AreaChart>
      </ResponsiveContainer>
    </ChartShell>
  );
}

export function PatientGrowthChart({
  data, loading, error,
}: { data: TrendPoint[]; loading: boolean; error?: boolean }) {
  const empty = data.every((p) => p.value === 0);
  return (
    <ChartShell
      title="New patient registrations"
      subtitle="Last 30 days"
      loading={loading}
      error={error}
      empty={empty}
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={fmtDay}
            tick={{ fontSize: 11, fill: '#94a3b8' }}
            axisLine={false}
            tickLine={false}
            interval={Math.max(0, Math.floor(data.length / 8))}
          />
          <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
          <Tooltip {...tooltipStyle} labelFormatter={fmtDay} />
          <Line
            type="monotone"
            dataKey="value"
            name="New patients"
            stroke={ACCENT}
            strokeWidth={2}
            dot={{ r: 2.5, fill: ACCENT }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartShell>
  );
}

export function DoctorWorkloadChart({
  data, loading, error,
}: { data: DoctorLoad[]; loading: boolean; error?: boolean }) {
  const empty = data.length === 0;
  return (
    <ChartShell
      title="Doctor workload"
      subtitle="Consultations in the last 30 days"
      loading={loading}
      error={error}
      empty={empty}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fontSize: 11, fill: '#475569' }}
            axisLine={false}
            tickLine={false}
            width={70}
          />
          <Tooltip {...tooltipStyle} />
          <Bar dataKey="count" name="Consultations" fill={PURPLE} radius={[0, 6, 6, 0]} barSize={14} />
        </BarChart>
      </ResponsiveContainer>
    </ChartShell>
  );
}

export function AppointmentStatusChart({
  data, loading, error,
}: { data: StatusBucket[]; loading: boolean; error?: boolean }) {
  const empty = data.length === 0;
  return (
    <ChartShell
      title="Appointment status"
      subtitle="All-time distribution"
      loading={loading}
      error={error}
      empty={empty}
    >
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={55}
            outerRadius={90}
            paddingAngle={2}
          >
            {data.map((entry) => (
              <Cell key={entry.name} fill={STATUS_COLORS[entry.name] ?? SLATE} />
            ))}
          </Pie>
          <Tooltip {...tooltipStyle} />
          <Legend
            verticalAlign="bottom"
            iconType="circle"
            wrapperStyle={{ fontSize: 11, color: '#475569' }}
          />
        </PieChart>
      </ResponsiveContainer>
    </ChartShell>
  );
}
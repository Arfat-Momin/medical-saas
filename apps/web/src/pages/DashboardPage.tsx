import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity, Heart, Calendar, RefreshCw, Package, FlaskConical,
  Receipt, CheckCircle2, Boxes, BedDouble, Stethoscope,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth.store';
import { usePermissions } from '@/hooks/useAuth';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatTile } from '@/components/ui/StatTile';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import {
  AppointmentsTrendChart, PatientGrowthChart,
  DoctorWorkloadChart, AppointmentStatusChart,
} from '@/components/dashboard/DashboardCharts';
import { useDashboardData } from '@/hooks/useDashboardData';
import { useLowStock } from '@/hooks/usePharmacy';
import { useLabOrders } from '@/hooks/useLaboratory';
import { triggerSyncNow } from '@/sync/listeners';
import { PERMISSIONS } from '@medical/shared';
import { pharmacyQueueRepository } from '@/repositories/pharmacy-queue.repository';
import { billingRepository } from '@/repositories/billing.repository';

export function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const roles = useAuthStore((s) => s.roles);
  const isPlatformAdmin = user?.isPlatformAdmin ?? false;
  const { can } = usePermissions();
  const isDoctor = roles.includes('DOCTOR');

  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [online, setOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

  // Local, tenant-scoped, offline-first
  const local = useDashboardData(!isPlatformAdmin);

  // Permission-gated server KPIs — nothing is fetched unless the user is allowed.
  const canPharmacyRead = can(PERMISSIONS.PHARMACY_READ);
  const canPharmacyStock = can(PERMISSIONS.PHARMACY_STOCK);
  const canLabRead = can(PERMISSIONS.LAB_READ);
  const canBillingRead = can(PERMISSIONS.BILLING_READ);

  const pharmacyQueue = useQuery({
    queryKey: ['dashboard', 'pharmacy-queue'],
    queryFn: () => pharmacyQueueRepository.list({ status: 'PENDING', pageSize: 1 }),
    enabled: !isPlatformAdmin && canPharmacyRead,
    staleTime: 30_000,
    refetchInterval: 30_000,
  });

  const lowStock = useLowStock();
  const labOrders = useLabOrders({ status: 'ORDERED', pageSize: 1 });
  const unpaidInvoices = useQuery({
    queryKey: ['dashboard', 'unpaid-invoices'],
    queryFn: () => billingRepository.listInvoices({ status: 'UNPAID', pageSize: 1 }),
    enabled: !isPlatformAdmin && canBillingRead,
    staleTime: 30_000,
  });

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  async function onSync() {
    setSyncing(true);
    try {
      const r = await triggerSyncNow();
      await local.refetch();
      setLastSync(
        `Synced · pushed ${r.pushed}, pulled ${r.pulled}${r.failed ? `, failed ${r.failed}` : ''}`,
      );
    } catch (e: any) {
      setLastSync(`Sync failed: ${e?.message ?? 'unknown'}`);
    } finally {
      setSyncing(false);
    }
  }

  // ── Platform admin view stays unchanged ──────────────────────────────
  if (isPlatformAdmin) {
    return (
      <>
        <PageHeader
          title={`Welcome back, ${(user?.fullName ?? 'Admin').split(' ')[0]}`}
          subtitle="Platform overview — tenants and subscriptions"
        />
        <Card>
          <CardBody>
            <p className="text-base text-slate-600">
              Open <strong className="text-slate-900">Tenants</strong> in the sidebar to manage
              subscriptions, plans, and tenant status.
            </p>
          </CardBody>
        </Card>
      </>
    );
  }

  // ── KPI tiles: permission-gated, real tenant data ────────────────────
  const tiles = useMemo(() => {
    type Tile = {
      key: string; label: string; value: number | string;
      icon: any; tone: 'brand' | 'accent' | 'alert' | 'danger' | 'neutral';
      hint?: string; to?: string;
    };
    const arr: Tile[] = [];
    const d = local.data;

    if (can(PERMISSIONS.APPOINTMENT_READ)) {
      arr.push({
        key: 'appts',
        label: isDoctor ? "Today's visits" : 'Appointments today',
        value: d?.appointmentsToday ?? 0,
        icon: Calendar, tone: 'brand', to: '/appointments',
        hint: d ? `${d.appointments7d} this week` : undefined,
      });
    }

    if (can(PERMISSIONS.PATIENT_READ)) {
      arr.push({
        key: 'patients', label: 'Patients',
        value: d?.totalPatients ?? 0,
        icon: Heart, tone: 'brand', to: '/patients',
        hint: d ? `+${d.newPatients30d} in 30 days` : undefined,
      });
    }

    if (can(PERMISSIONS.CONSULTATION_READ)) {
      arr.push({
        key: 'consults', label: 'Consultations',
        value: d?.encountersToday ?? 0,
        icon: Stethoscope, tone: 'brand', to: '/appointments',
        hint: d ? `${d.encounters7d} this week` : undefined,
      });
    }

    if (canPharmacyRead) {
      arr.push({
        key: 'pharmacy-queue', label: 'Pharmacy queue',
        value: pharmacyQueue.data?.total ?? 0,
        icon: Package, tone: 'alert',
        hint: 'Waiting to dispense',
        to: '/pharmacy/queue',
      });
    }

    if (canPharmacyStock) {
      const count = lowStock.data?.length ?? 0;
      arr.push({
        key: 'low-stock', label: 'Low stock',
        value: count,
        icon: Boxes, tone: count > 0 ? 'alert' : 'accent',
        to: '/pharmacy/stock',
      });
    }

    if (canLabRead) {
      arr.push({
        key: 'lab-pending', label: 'Lab pending',
        value: labOrders.data?.total ?? 0,
        icon: FlaskConical, tone: 'alert',
        to: '/laboratory/orders',
      });
    }

    if (canBillingRead) {
      arr.push({
        key: 'unpaid', label: 'Unpaid invoices',
        value: unpaidInvoices.data?.total ?? 0,
        icon: Receipt, tone: 'alert',
        to: '/billing/invoices',
      });
    }

    if (can(PERMISSIONS.IPD_READ)) {
      arr.push({
        key: 'ipd', label: 'Admissions',
        value: '—',
        icon: BedDouble, tone: 'neutral',
        to: '/ipd/admissions',
      });
    }

    return arr;
  }, [
    local.data, isDoctor, can,
    canPharmacyRead, canPharmacyStock, canLabRead, canBillingRead,
    pharmacyQueue.data, lowStock.data, labOrders.data, unpaidInvoices.data,
  ]);

  const loading = local.isLoading;
  const error = local.isError;

  return (
    <>
      <PageHeader
        title={`Welcome back, ${(user?.fullName ?? 'there').split(' ')[0]}`}
        subtitle={isDoctor ? 'Your clinic today' : "Here's what's happening across your hospital"}
        action={
          <div className="flex items-center gap-2">
            {online ? <Badge tone="green" dot>Online</Badge> : <Badge tone="yellow" dot>Offline</Badge>}
            <Button onClick={onSync} loading={syncing} size="sm" leftIcon={<RefreshCw size={14} />}>
              Sync now
            </Button>
          </div>
        }
      />

      {lastSync && (
        <div className="mb-5 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-600">
          {lastSync}
        </div>
      )}

      {/* KPI grid — never renders empty */}
      {tiles.length > 0 && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 xl:grid-cols-4">
          {tiles.map((t) => {
            const inner = (
              <StatTile
                icon={<t.icon size={18} />}
                label={t.label}
                value={loading ? '—' : t.value}
                hint={t.hint}
                tone={t.tone}
              />
            );
            return t.to ? (
              <Link key={t.key} to={t.to} className="block">{inner}</Link>
            ) : (
              <div key={t.key} className="pointer-events-none">{inner}</div>
            );
          })}
        </div>
      )}

      {/* Charts — each individually permission-gated */}
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {can(PERMISSIONS.APPOINTMENT_READ) && (
          <AppointmentsTrendChart
            data={local.data?.appointmentsTrend ?? []}
            loading={loading}
            error={error}
          />
        )}
        {can(PERMISSIONS.PATIENT_READ) && (
          <PatientGrowthChart
            data={local.data?.patientGrowthTrend ?? []}
            loading={loading}
            error={error}
          />
        )}
        {can(PERMISSIONS.CONSULTATION_READ) && (
          <DoctorWorkloadChart
            data={local.data?.doctorWorkload ?? []}
            loading={loading}
            error={error}
          />
        )}
        {can(PERMISSIONS.APPOINTMENT_READ) && (
          <AppointmentStatusChart
            data={local.data?.appointmentStatusBuckets ?? []}
            loading={loading}
            error={error}
          />
        )}
      </div>

      <div className="mt-6">
        <Card>
          <CardBody className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
              <Activity size={16} />
            </div>
            <div className="text-sm text-slate-600">
              <p className="font-medium text-slate-900">Offline-first</p>
              <p className="mt-0.5">
                Every patient, appointment, and consultation is saved on this device first.
                Charts update from local data instantly and reconcile with the server on sync.
              </p>
            </div>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
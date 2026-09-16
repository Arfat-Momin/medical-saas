import { useQuery } from '@tanstack/react-query';
import { db } from '@/db';

export interface TrendPoint    { date: string; value: number; }
export interface DoctorLoad    { id: string; name: string; count: number; }
export interface StatusBucket  { name: string; value: number; }

export interface DashboardLocalData {
  totalPatients: number;
  newPatients30d: number;
  appointmentsToday: number;
  appointments7d: number;
  encountersToday: number;
  encounters7d: number;
  appointmentsTrend: TrendPoint[];
  patientGrowthTrend: TrendPoint[];
  consultationTrend: TrendPoint[];
  doctorWorkload: DoctorLoad[];
  appointmentStatusBuckets: StatusBucket[];
}

function dayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function lastNDays(n: number): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    out.push(dayKey(d));
  }
  return out;
}

export function useDashboardData(enabled = true) {
  return useQuery<DashboardLocalData>({
    queryKey: ['dashboard', 'local'],
    enabled,
    staleTime: 2_000,
    refetchInterval: 5_000,
    refetchOnWindowFocus: true,
    refetchOnMount: 'always',
    queryFn: async () => {
      const [patients, appointments, encounters, doctors] = await Promise.all([
        db.patients.where('deleted').equals(0).toArray(),
        db.appointments.where('deleted').equals(0).toArray(),
        db.encounters.where('deleted').equals(0).toArray(),
        db.doctors.where('is_active').equals(1).toArray(),
      ]);

      const today  = dayKey(new Date());
      const last14 = lastNDays(14);
      const last30 = lastNDays(30);
      const last7  = new Set(lastNDays(7));
      const last30Set = new Set(last30);

      const patientByDay = new Map<string, number>();
      for (const p of patients) {
        const k = dayKey(new Date(p.created_at));
        patientByDay.set(k, (patientByDay.get(k) ?? 0) + 1);
      }

      const apptByDay = new Map<string, number>();
      for (const a of appointments) {
        apptByDay.set(a.appointment_date, (apptByDay.get(a.appointment_date) ?? 0) + 1);
      }

      const encByDay = new Map<string, number>();
      for (const e of encounters) {
        encByDay.set(e.encounter_date, (encByDay.get(e.encounter_date) ?? 0) + 1);
      }

      const doctorNameById = new Map<string, string>();
      for (const d of doctors) {
        const key = d.server_id ?? d.local_id;
        doctorNameById.set(key, d.full_name);
      }

      const workload = new Map<string, number>();
      for (const e of encounters) {
        if (!last30Set.has(e.encounter_date)) continue;
        const id = e.doctor_id ?? 'unassigned';
        workload.set(id, (workload.get(id) ?? 0) + 1);
      }
      const doctorWorkload: DoctorLoad[] = Array.from(workload.entries())
        .map(([id, count]) => ({
          id,
          name: doctorNameById.get(id) ?? (id === 'unassigned' ? 'Unassigned' : 'Unknown'),
          count,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 6);

      const statusMap = new Map<string, number>();
      for (const a of appointments) {
        statusMap.set(a.status, (statusMap.get(a.status) ?? 0) + 1);
      }
      const appointmentStatusBuckets: StatusBucket[] = Array.from(statusMap.entries())
        .map(([name, value]) => ({ name, value }));

      return {
        totalPatients: patients.length,
        newPatients30d: patients.filter((p) => last30Set.has(dayKey(new Date(p.created_at)))).length,
        appointmentsToday: apptByDay.get(today) ?? 0,
        appointments7d: appointments.filter((a) => last7.has(a.appointment_date)).length,
        encountersToday: encByDay.get(today) ?? 0,
        encounters7d: encounters.filter((e) => last7.has(e.encounter_date)).length,
        appointmentsTrend: last14.map((d) => ({ date: d, value: apptByDay.get(d) ?? 0 })),
        patientGrowthTrend: last30.map((d) => ({ date: d, value: patientByDay.get(d) ?? 0 })),
        consultationTrend: last14.map((d) => ({ date: d, value: encByDay.get(d) ?? 0 })),
        doctorWorkload,
        appointmentStatusBuckets,
      };
    },
  });
}
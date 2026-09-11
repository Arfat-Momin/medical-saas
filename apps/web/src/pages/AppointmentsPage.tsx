import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { Calendar, Plus, Play, UserCheck } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Card } from '@/components/ui/Card';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { Alert } from '@/components/ui/Alert';
import { Spinner } from '@/components/ui/Spinner';
import {
  useAppointments, useCreateAppointment, useCheckIn, useStartEncounter,
} from '@/hooks/useAppointments';
import { usePatients } from '@/hooks/usePatients';
import { useUsers } from '@/hooks/useUsers';
import { usePermissions } from '@/hooks/useAuth';
import { PERMISSIONS, formatQueueToken } from '@medical/shared';

interface FormValues {
  patientId: string;
  doctorId: string;
  appointmentDate: string;
  slotTime: string;
  chiefComplaint: string;
}

const today = new Date().toISOString().slice(0, 10);

const statusTone: Record<string, BadgeTone> = {
  SCHEDULED: 'blue', CHECKED_IN: 'yellow', IN_PROGRESS: 'purple',
  COMPLETED: 'green', CANCELLED: 'gray', NO_SHOW: 'red',
};

export function AppointmentsPage() {
  const navigate = useNavigate();
  const { can } = usePermissions();
  const [date, setDate] = useState(today);
  const list = useAppointments({ date, pageSize: 100 });

  const patients = usePatients({ page: 1, pageSize: 50 });
  const doctors = useUsers({ page: 1, pageSize: 50, roleCode: 'DOCTOR' });

  const create = useCreateAppointment();
  const checkIn = useCheckIn();
  const startEnc = useStartEncounter();

  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [startingId, setStartingId] = useState<string | null>(null);

  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm<FormValues>({
    defaultValues: { patientId: '', doctorId: '', appointmentDate: today, slotTime: '', chiefComplaint: '' },
  });

  const canManage = can(PERMISSIONS.APPOINTMENT_MANAGE);
  const canStart  = can(PERMISSIONS.CONSULTATION_WRITE);

  async function onSubmit(values: FormValues) {
    setError(null);
    try {
      await create.mutateAsync({
        patientId: values.patientId,
        doctorId: values.doctorId,
        appointmentDate: values.appointmentDate,
        slotTime: values.slotTime || undefined,
        chiefComplaint: values.chiefComplaint || null,
      });
      reset({ patientId: '', doctorId: '', appointmentDate: today, slotTime: '', chiefComplaint: '' });
      setOpen(false);
    } catch (e: any) { setError(e?.message ?? 'Failed to book appointment'); }
  }

  async function handleCheckIn(id: string) {
    try { await checkIn.mutateAsync(id); }
    catch (e: any) { alert(e?.message ?? 'Check-in failed'); }
  }

  async function handleStart(id: string) {
    setStartingId(id);
    try {
      const res = await startEnc.mutateAsync(id);
      navigate(`/consultation/${res.id}`);
    } catch (e: any) { alert(e?.message ?? 'Failed to start'); }
    finally { setStartingId(null); }
  }

  return (
    <>
      <PageHeader
        title="Appointments"
        subtitle="Book and manage patient appointments"
        action={canManage && (
          <Button onClick={() => setOpen(true)}><Plus size={16} /> New appointment</Button>
        )}
      />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="w-48">
          <Input
            label="Date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <div className="text-sm text-slate-500 pt-6">
          <Calendar size={14} className="inline mr-1" />
          {list.data?.total ?? 0} appointment{list.data?.total === 1 ? '' : 's'}
        </div>
      </div>

      {list.isLoading && <div className="flex justify-center py-12"><Spinner size={28} /></div>}
      {list.isError && <Alert tone="error">Failed to load appointments.</Alert>}

      {list.data?.rows.length === 0 && (
        <EmptyState
          title="No appointments"
          description={`Nothing booked for ${date}.`}
          action={canManage && <Button onClick={() => setOpen(true)}><Plus size={16} /> New appointment</Button>}
        />
      )}

      {list.data && list.data.rows.length > 0 && (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3">Token</th>
                  <th className="px-5 py-3">Time</th>
                  <th className="px-5 py-3">Patient</th>
                  <th className="px-5 py-3">Doctor</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {list.data.rows.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3 font-mono text-sm text-slate-700">
                      {a.queue_token ? formatQueueToken(a.queue_token) : <span className="text-slate-400">-</span>}
                    </td>
                    <td className="px-5 py-3 text-slate-600">{a.slot_time ?? '-'}</td>
                    <td className="px-5 py-3">
                      <div className="font-medium text-slate-900">{a.patients?.full_name}</div>
                      <div className="font-mono text-xs text-brand-700">{a.patients?.uhid}</div>
                    </td>
                    <td className="px-5 py-3 text-slate-700">{a.doctors?.full_name}</td>
                    <td className="px-5 py-3">
                      <Badge tone={statusTone[a.status] ?? 'gray'}>{a.status.replace('_',' ')}</Badge>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        {a.status === 'SCHEDULED' && canManage && (
                          <Button size="sm" variant="secondary" onClick={() => handleCheckIn(a.id)}>
                            <UserCheck size={14} /> Check-in
                          </Button>
                        )}
                        {canStart && (a.status === 'CHECKED_IN' || a.status === 'IN_PROGRESS' || a.status === 'SCHEDULED') && (
                          <Button
                            size="sm"
                            onClick={() => handleStart(a.id)}
                            loading={startingId === a.id}
                          >
                            <Play size={14} /> Start
                          </Button>
                        )}
                        {a.status === 'COMPLETED' && (
                          <Link to={`/patients/${a.patient_id}`} className="text-xs text-brand-600 hover:underline">
                            View patient
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Modal
        open={open}
        onClose={() => { setOpen(false); reset(); setError(null); }}
        title="New appointment"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => { setOpen(false); reset(); }}>Cancel</Button>
            <Button form="appt-form" type="submit" loading={isSubmitting}>Book</Button>
          </>
        }
      >
        <form id="appt-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {error && <Alert tone="error">{error}</Alert>}

          <Select label="Patient *" {...register('patientId', { required: true })}>
            <option value="">- Select patient -</option>
            {patients.data?.rows.map((p) => (
              <option key={p.id} value={p.id}>{p.uhid} | {p.full_name}</option>
            ))}
          </Select>

          <Select label="Doctor *" {...register('doctorId', { required: true })}>
            <option value="">- Select doctor -</option>
            {doctors.data?.rows.map((r) => (
              <option key={r.user_id} value={r.user_id}>{r.users.full_name}</option>
            ))}
          </Select>

          <div className="grid grid-cols-2 gap-4">
            <Input label="Date *" type="date" {...register('appointmentDate', { required: true })} />
            <Input label="Slot time" type="time" {...register('slotTime')} />
          </div>

          <Input label="Chief complaint" placeholder="Fever, cough since 3 days" {...register('chiefComplaint')} />
        </form>
      </Modal>
    </>
  );
}
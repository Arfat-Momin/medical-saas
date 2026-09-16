import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Calendar, Plus, Play, UserCheck, RefreshCw, Wifi, WifiOff, Receipt } from 'lucide-react';
import { useForm } from 'react-hook-form';
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
import { useAppointments, useCreateAppointment, useCheckIn } from '@/hooks/useAppointments';
import { usePatients } from '@/hooks/usePatients';
import { doctorsRepository, type Doctor } from '@/repositories/doctors.repository';
import { encountersRepository } from '@/repositories/encounters.repository';
import { usePermissions } from '@/hooks/useAuth';
import { triggerSyncNow } from '@/sync/listeners';
import { PERMISSIONS, formatQueueToken } from '@medical/shared';

const today = new Date().toISOString().slice(0, 10);

const statusTone: Record<string, BadgeTone> = {
  SCHEDULED:   'blue',
  CHECKED_IN:  'yellow',
  IN_PROGRESS: 'purple',
  COMPLETED:   'green',
  CANCELLED:   'gray',
  NO_SHOW:     'red',
};

interface FormValues {
  patientId: string;
  doctorId: string;
  appointmentDate: string;
  slotTime: string;
  chiefComplaint: string;
}

export function AppointmentsPage() {
  const { can } = usePermissions();
  const [date, setDate] = useState(today);
  const [status, setStatus] = useState('');
  const [online, setOnline] = useState(navigator.onLine);
  const [syncing, setSyncing] = useState(false);

  const list = useAppointments({ date, status: status || undefined, pageSize: 300 });
  const patients = usePatients({ pageSize: 200 });
  const [doctors, setDoctors] = useState<Doctor[]>([]);

  const create = useCreateAppointment();
  const checkIn = useCheckIn();

  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm<FormValues>({
    defaultValues: { patientId: '', doctorId: '', appointmentDate: today, slotTime: '', chiefComplaint: '' },
  });

  const canManage = can(PERMISSIONS.APPOINTMENT_MANAGE);
  const navigate = useNavigate();

  useEffect(() => {
    void triggerSyncNow().catch(() => {});
    doctorsRepository.list().then(setDoctors);
    const iv = setInterval(() => {
      doctorsRepository.list().then(setDoctors);
    }, 3000);
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      clearInterval(iv);
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  async function onSync() {
    setSyncing(true);
    try {
      await triggerSyncNow();
      doctorsRepository.list().then(setDoctors);
    } finally {
      setSyncing(false);
    }
  }

  async function onSubmit(values: FormValues) {
    setError(null);
    try {
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Save took too long - please retry.')), 10_000),
      );

      await Promise.race([
        create.mutateAsync({
          patientId: values.patientId,
          doctorId: values.doctorId,
          appointmentDate: values.appointmentDate,
          slotTime: values.slotTime || undefined,
          chiefComplaint: values.chiefComplaint || null,
        }),
        timeoutPromise,
      ]);

      reset({ patientId: '', doctorId: '', appointmentDate: today, slotTime: '', chiefComplaint: '' });
      setOpen(false);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to create appointment');
    }
  }

  async function handleCheckIn(id: string) {
    try { await checkIn.mutateAsync(id); }
    catch (e: any) { alert(e?.message ?? 'Check-in failed'); }
  }

  async function handleStartConsultation(a: any) {
    try {
      // Reuse existing encounter for this appointment, or create a fresh one
      let enc = await encountersRepository.findByAppointment(a.local_id);

      if (!enc) {
        enc = await encountersRepository.create({
          patientLocalId: a.patient_id,
          doctorId: a.doctor_id ?? '',
          appointmentLocalId: a.local_id,
          chiefComplaint: a.chief_complaint ?? null,
        });
      }

      // Navigate to the encounter by its LOCAL id
      navigate(`/consultation/${enc.local_id}`);
    } catch (e: any) {
      alert(e?.message ?? 'Cannot start consultation');
    }
  }

  const doctorName = (doctorId: string | null) =>
    doctors.find((d) => d.server_id === doctorId)?.full_name ?? '-';

  return (
    <>
      <PageHeader
        title="Appointments"
        subtitle="Book and manage patient appointments"
        action={
          <div className="flex items-center gap-2">
            {online ? (
              <Badge tone="green">
                <Wifi size={10} className="mr-1 inline" />Online
              </Badge>
            ) : (
              <Badge tone="yellow">
                <WifiOff size={10} className="mr-1 inline" />Offline
              </Badge>
            )}
            <Button variant="secondary" size="sm" onClick={onSync} loading={syncing} title="Sync">
              <RefreshCw size={14} />
            </Button>
            {canManage && (
              <Button onClick={() => setOpen(true)} size="sm">
                <Plus size={16} />
                <span className="hidden sm:inline">New appointment</span>
                <span className="sm:hidden">New</span>
              </Button>
            )}
          </div>
        }
      />

      {/* Filters - unchanged */}
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="w-40">
          <Input
            label="Date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <div className="w-44">
          <Select label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            <option value="SCHEDULED">Scheduled</option>
            <option value="CHECKED_IN">Checked-in</option>
            <option value="IN_PROGRESS">In progress</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
            <option value="NO_SHOW">No show</option>
          </Select>
        </div>
        <div className="pb-2 text-sm text-slate-500">
          <Calendar size={14} className="inline mr-1" />
          {list.data?.total ?? 0} appointment{(list.data?.total ?? 0) === 1 ? '' : 's'}
        </div>
      </div>

      {list.isLoading && (
        <div className="flex justify-center py-12">
          <Spinner size={28} />
        </div>
      )}

      {list.data?.rows.length === 0 && !list.isLoading && (
        <EmptyState
          title="No appointments"
          description={`Nothing booked for ${date}.`}
          action={
            canManage && (
              <Button onClick={() => setOpen(true)}>
                <Plus size={16} /> New appointment
              </Button>
            )
          }
        />
      )}

      {/*  */}
      {/* MOBILE: card list (hidden on md+)                */}
      {/*  */}
      {list.data && list.data.rows.length > 0 && (
        <div className="space-y-2 md:hidden">
          {list.data.rows.map((a) => (
            <Card key={a.id} className="p-3">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                {a.queue_token != null && (
                  <span className="rounded bg-purple-100 px-2 py-0.5 font-mono text-[11px] font-semibold text-purple-700">
                    {formatQueueToken(a.queue_token)}
                  </span>
                )}
                <span className="font-mono text-xs text-slate-500">
                  {a.slot_time ?? '-'}
                </span>
                {a.sync_status === 'pending' && (
                  <span className="text-[10px] text-amber-600">* syncing</span>
                )}
              </div>

              <div className="mb-1">
                <p className="truncate text-sm font-semibold text-slate-900">
                  {a.patient_name ?? 'Unknown patient'}
                </p>
                <p className="truncate font-mono text-xs text-brand-700">
                  {a.patient_uhid ?? 'PENDING'}
                </p>
              </div>

              <p className="truncate text-xs text-slate-600">
                <span className="text-slate-400">Doctor:</span> {doctorName(a.doctor_id)}
              </p>

              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge tone={statusTone[a.status] ?? 'gray'}>
                  {a.status.replace('_', ' ')}
                </Badge>
                {a.status === 'COMPLETED' && a.doctor_invoice && (
                  <Link
                    to={`/billing/invoices/${a.doctor_invoice.id}`}
                    className="inline-flex items-center gap-1 rounded-md border border-brand-200 bg-brand-50 px-2 py-0.5 font-mono text-[11px] font-semibold text-brand-700 hover:bg-brand-100"
                  >
                    <Receipt size={11} />
                    {a.doctor_invoice.invoice_no}
                    <span className="text-slate-500">Rs.{a.doctor_invoice.total_amount.toFixed(2)}</span>
                  </Link>
                )}
                {a.status === 'COMPLETED' && !a.doctor_invoice && (
                  <span className="text-[10px] italic text-slate-400">no invoice</span>
                )}
              </div>

              {a.chief_complaint && (
                <p className="mt-2 line-clamp-2 text-xs italic text-slate-600">
                  {a.chief_complaint}
                </p>
              )}

              <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                {a.status === 'SCHEDULED' && canManage && (
                  <Button size="sm" variant="secondary" onClick={() => handleCheckIn(a.id)}>
                    <UserCheck size={12} /> Check-in
                  </Button>
                )}
                {canManage && a.status !== 'COMPLETED' && a.status !== 'CANCELLED' && (
                  <Button size="sm" onClick={() => handleStartConsultation(a)}>
                    <Play size={12} />{' '}
                    {a.status === 'IN_PROGRESS' ? 'Continue' : 'Start'}
                  </Button>
                )}
                <Link to={`/patients/${a.patient_id}`}>
                  <Button size="sm" variant="secondary">
                    View patient
                  </Button>
                </Link>
              </div>

              {a.doctor_invoice && (
                <div className="mt-2 flex items-center gap-2 border-t border-slate-100 pt-2 text-xs">
                  <span className="text-slate-500">Invoice:</span>
                  <Link
                    to={`/billing/invoices/${a.doctor_invoice.id}`}
                    className="font-mono text-brand-600 hover:underline"
                  >
                    {a.doctor_invoice.invoice_no}
                  </Link>
                  <span className="text-slate-500">
                    Rs.{a.doctor_invoice.total_amount.toFixed(2)}
                  </span>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/*  */}
      {/* DESKTOP: table (hidden below md)                 */}
      {/*  */}
      {list.data && list.data.rows.length > 0 && (
        <Card className="hidden overflow-hidden md:block">
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
                    <td className="px-5 py-3 font-mono text-sm">
                      {a.queue_token ? (
                        formatQueueToken(a.queue_token)
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-slate-600">{a.slot_time ?? '-'}</td>
                    <td className="px-5 py-3">
                      <div className="font-medium text-slate-900">
                        {a.patient_name ?? 'Unknown'}
                      </div>
                      <div className="font-mono text-xs text-brand-700">
                        {a.patient_uhid ?? 'PENDING'}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-slate-700">{doctorName(a.doctor_id)}</td>
                    <td className="px-5 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={statusTone[a.status] ?? 'gray'}>
                          {a.status.replace('_', ' ')}
                        </Badge>
                        {a.sync_status === 'pending' && (
                          <span className="text-[10px] text-amber-600">*</span>
                        )}
                        {a.status === 'COMPLETED' && a.doctor_invoice && (
                          <Link
                            to={`/billing/invoices/${a.doctor_invoice.id}`}
                            className="inline-flex items-center gap-1 rounded-md border border-brand-200 bg-brand-50 px-2 py-0.5 font-mono text-[11px] font-semibold text-brand-700 hover:bg-brand-100"
                            title={`Doctor invoice — Rs.${a.doctor_invoice.total_amount.toFixed(2)} (${a.doctor_invoice.status})`}
                          >
                            <Receipt size={11} />
                            {a.doctor_invoice.invoice_no}
                          </Link>
                        )}
                        {a.status === 'COMPLETED' && !a.doctor_invoice && (
                          <span className="text-[10px] italic text-slate-400">no invoice</span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        {a.status === 'SCHEDULED' && canManage && (
                          <Button size="sm" variant="secondary" onClick={() => handleCheckIn(a.id)}>
                            <UserCheck size={12} />
                          </Button>
                        )}
                        {canManage && a.status !== 'COMPLETED' && a.status !== 'CANCELLED' && (
                          <Button size="sm" onClick={() => handleStartConsultation(a)} title="Start consultation">
                            <Play size={12} />
                          </Button>
                        )}
                        <Link to={`/patients/${a.patient_id}`}>
                          <Button size="sm" variant="secondary">
                            View
                          </Button>
                        </Link>
                        {a.doctor_invoice && (
                          <Link
                            to={`/billing/invoices/${a.doctor_invoice.id}`}
                            className="inline-flex items-center rounded px-2 py-1 font-mono text-xs text-brand-600 hover:bg-brand-50"
                            title={`Doctor invoice Rs.${a.doctor_invoice.total_amount.toFixed(2)}`}
                          >
                            {a.doctor_invoice.invoice_no}
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

      {/* New appointment modal */}
      <Modal
        open={open}
        onClose={() => { setOpen(false); reset(); setError(null); }}
        title="New appointment"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => { setOpen(false); reset(); }}>
              Cancel
            </Button>
            <Button form="appt-form" type="submit" loading={isSubmitting}>
              Book
            </Button>
          </>
        }
      >
        <form id="appt-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {error && <Alert tone="error">{error}</Alert>}

          <Select label="Patient *" {...register('patientId', { required: true })}>
            <option value="">- Select patient -</option>
            {patients.data?.rows.map((p) => (
              <option key={p.local_id} value={p.local_id}>
                {p.uhid} - {p.full_name}
              </option>
            ))}
          </Select>

          <Select label="Doctor *" {...register('doctorId', { required: true })}>
            <option value="">- Select doctor -</option>
            {doctors.map((d) => (
              <option key={d.local_id} value={d.server_id ?? ''}>
                {d.full_name}
              </option>
            ))}
          </Select>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label="Date *" type="date" {...register('appointmentDate', { required: true })} />
            <Input label="Slot time" type="time" {...register('slotTime')} />
          </div>

          <Input
            label="Chief complaint"
            placeholder="Fever, cough since 3 days"
            {...register('chiefComplaint')}
          />
        </form>
      </Modal>
    </>
  );
}

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
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
import { useAdmissions, useAdmit, useBeds } from '@/hooks/useIpd';
import { usePatients } from '@/hooks/usePatients';
import { useUsers } from '@/hooks/useUsers';
import { usePermissions } from '@/hooks/useAuth';
import { PERMISSIONS } from '@medical/shared';

const statusTone: Record<string, BadgeTone> = {
  ADMITTED: 'green', TRANSFERRED: 'yellow', DISCHARGED: 'gray', CANCELLED: 'gray',
};

export function AdmissionsPage() {
  const { can } = usePermissions();
  const [status, setStatus] = useState('ADMITTED');
  const [page, setPage] = useState(1);
  const list = useAdmissions({ status: status || undefined, page, pageSize: 20 });

  const patients = usePatients({ page: 1, pageSize: 200 });
  const doctors = useUsers({ page: 1, pageSize: 100, roleCode: 'DOCTOR' });
  const beds = useBeds();

  const admit = useAdmit();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [patientId, setPatientId] = useState('');
  const [doctorId, setDoctorId] = useState('');
  const [bedId, setBedId] = useState('');
  const [reason, setReason] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [expectedDischarge, setExpectedDischarge] = useState('');

  const canManage = can(PERMISSIONS.IPD_MANAGE);
  const availableBeds = (beds.data ?? []).filter((b) => b.bed_status === 'AVAILABLE');

  function reset() {
    setPatientId(''); setDoctorId(''); setBedId('');
    setReason(''); setDiagnosis(''); setExpectedDischarge('');
    setError(null);
  }

  async function onAdmit() {
    setError(null);
    if (!patientId || !doctorId || !bedId) { setError('Patient, doctor and bed are required'); return; }
    try {
      await admit.mutateAsync({
        patientId, bedId, admittingDoctor: doctorId,
        reason: reason || null, diagnosis: diagnosis || null,
        expectedDischarge: expectedDischarge || null,
      });
      setOpen(false); reset();
    } catch (e: any) { setError(e?.message ?? 'Failed to admit'); }
  }

  const totalPages = list.data ? Math.max(1, Math.ceil(list.data.total / (list.data.pageSize || 20))) : 1;

  return (
    <>
      <PageHeader title="Admissions" subtitle="Inpatient admissions and current occupants"
        action={canManage && <Button onClick={() => setOpen(true)}><Plus size={16} /> Admit patient</Button>} />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="w-48">
          <Select label="Status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="">All</option>
            <option value="ADMITTED">Currently admitted</option>
            <option value="DISCHARGED">Discharged</option>
            <option value="CANCELLED">Cancelled</option>
          </Select>
        </div>
      </div>

      {list.isLoading && <div className="flex justify-center py-12"><Spinner size={28} /></div>}
      {list.isError && <Alert tone="error">Failed to load admissions.</Alert>}

      {list.data?.rows.length === 0 && (
        <EmptyState title="No admissions" description="Admitted patients will appear here."
          action={canManage && <Button onClick={() => setOpen(true)}><Plus size={16} /> Admit patient</Button>} />
      )}

      {list.data && list.data.rows.length > 0 && (
        <>
          <Card className="overflow-x-auto overflow-y-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3">Patient</th>
                  <th className="px-5 py-3">Doctor</th>
                  <th className="px-5 py-3">Admitted</th>
                  <th className="px-5 py-3">Expected discharge</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {list.data.rows.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3">
                      <div className="font-medium text-slate-900">{a.patients?.full_name}</div>
                      <div className="font-mono text-xs text-brand-700">{a.patients?.uhid}</div>
                    </td>
                    <td className="px-5 py-3 text-slate-600">{a.doctors?.full_name ?? '-'}</td>
                    <td className="px-5 py-3 text-slate-600 text-xs">
                      {new Date(a.admitted_at).toLocaleString()}
                    </td>
                    <td className="px-5 py-3 text-slate-600 text-xs">{a.expected_discharge ?? '-'}</td>
                    <td className="px-5 py-3"><Badge tone={statusTone[a.status] ?? 'gray'}>{a.status}</Badge></td>
                    <td className="px-5 py-3 text-right">
                      <Link to={`/ipd/admissions/${a.id}`} className="text-sm text-brand-600 hover:underline">Open</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
            <span>{list.data.total} admission{list.data.total === 1 ? '' : 's'} - page {page} of {totalPages}</span>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
              <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          </div>
        </>
      )}

      <Modal open={open} onClose={() => { setOpen(false); reset(); }} title="Admit patient" size="lg"
        footer={<><Button variant="secondary" onClick={() => { setOpen(false); reset(); }}>Cancel</Button>
          <Button onClick={onAdmit} loading={admit.isPending}>Admit</Button></>}>
        <div className="space-y-4">
          {error && <Alert tone="error">{error}</Alert>}

          <Select label="Patient *" value={patientId} onChange={(e) => setPatientId(e.target.value)}>
            <option value="">
              {patients.isLoading ? 'Loading...' : patients.isError ? 'Failed to load' : '- select patient -'}
            </option>
            {patients.data?.rows.map((p) => (
              <option key={p.id} value={p.id}>{p.uhid} - {p.full_name}</option>
            ))}
          </Select>

          <Select label="Admitting doctor *" value={doctorId} onChange={(e) => setDoctorId(e.target.value)}>
            <option value="">- select doctor -</option>
            {doctors.data?.rows.map((r) => (
              <option key={r.user_id} value={r.user_id}>{r.users.full_name}</option>
            ))}
          </Select>

          <Select label="Bed *" value={bedId} onChange={(e) => setBedId(e.target.value)}>
            <option value="">
              {beds.isLoading ? 'Loading...' : availableBeds.length === 0 ? 'No available beds' : `- ${availableBeds.length} available -`}
            </option>
            {availableBeds.map((b) => (
              <option key={b.bed_id} value={b.bed_id}>
                {b.ward_name ?? '-'} / {b.room_name ?? '-'} / {b.bed_name}
              </option>
            ))}
          </Select>

          <Input label="Reason for admission" value={reason} onChange={(e) => setReason(e.target.value)}
            placeholder="High fever, observation" />
          <Input label="Provisional diagnosis" value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)}
            placeholder="Viral fever" />
          <Input label="Expected discharge date" type="date" value={expectedDischarge}
            onChange={(e) => setExpectedDischarge(e.target.value)} />
        </div>
      </Modal>
    </>
  );
}

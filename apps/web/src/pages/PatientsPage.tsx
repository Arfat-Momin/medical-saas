import { useState } from 'react';
import { Search, UserPlus, AlertTriangle } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { Alert } from '@/components/ui/Alert';
import { Spinner } from '@/components/ui/Spinner';
import { usePatients, useCreatePatient } from '@/hooks/usePatients';
import { usePermissions } from '@/hooks/useAuth';
import { patientsRepository, type DuplicateMatch } from '@/repositories/patients.repository';
import { PERMISSIONS } from '@medical/shared';

interface FormValues {
  fullName: string;
  dateOfBirth: string;
  gender: '' | 'MALE' | 'FEMALE' | 'OTHER';
  mobile: string;
  address: string;
  bloodGroup: string;
  allergies: string;
  medicalHistory: string;
  emergencyContact: string;
}

const emptyForm: FormValues = {
  fullName: '', dateOfBirth: '', gender: '', mobile: '', address: '',
  bloodGroup: '', allergies: '', medicalHistory: '', emergencyContact: '',
};

const BLOOD_GROUPS = ['A+','A-','B+','B-','AB+','AB-','O+','O-'];

export function PatientsPage() {
  const { can } = usePermissions();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const patients = usePatients({ page, pageSize: 10, search });
  const create = useCreatePatient();

  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicates, setDuplicates] = useState<DuplicateMatch[] | null>(null);
  const [pendingValues, setPendingValues] = useState<FormValues | null>(null);

  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm<FormValues>({
    defaultValues: emptyForm,
  });

  const canCreate = can(PERMISSIONS.PATIENT_CREATE);

  async function onSubmit(values: FormValues) {
    setError(null);
    setDuplicates(null);

    try {
      // Step 1 - check for duplicates first
      const dup = await patientsRepository.checkDuplicate({
        mobile: values.mobile || undefined,
        fullName: values.fullName,
        dateOfBirth: values.dateOfBirth || undefined,
      });

      if (dup.hasDuplicates) {
        setDuplicates(dup.matches);
        setPendingValues(values);
        return;
      }

      await commitCreate(values, false);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to register patient');
    }
  }

  async function commitCreate(values: FormValues, skipDuplicateCheck: boolean) {
    try {
      await create.mutateAsync({
        fullName: values.fullName,
        dateOfBirth: values.dateOfBirth || null,
        gender: values.gender || null,
        mobile: values.mobile || null,
        address: values.address || null,
        bloodGroup: values.bloodGroup || null,
        allergies: values.allergies || null,
        medicalHistory: values.medicalHistory || null,
        emergencyContact: values.emergencyContact || null,
        skipDuplicateCheck,
      });
      reset(emptyForm);
      setOpen(false);
      setDuplicates(null);
      setPendingValues(null);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to register patient');
    }
  }

  function closeModal() {
    setOpen(false);
    reset(emptyForm);
    setError(null);
    setDuplicates(null);
    setPendingValues(null);
  }

  const totalPages = patients.data ? Math.max(1, Math.ceil(patients.data.total / (patients.data.pageSize || 10))) : 1;

  return (
    <>
      <PageHeader
        title="Patients"
        subtitle="Registry of all patients in your organization"
        action={
          canCreate && (
            <Button onClick={() => setOpen(true)}>
              <UserPlus size={16} /> Register patient
            </Button>
          )
        }
      />

      <div className="mb-4 max-w-md">
        <Input
          placeholder="Search by name, mobile or UHID"
          leftIcon={<Search size={14} />}
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        />
      </div>

      {patients.isLoading && <div className="flex justify-center py-12"><Spinner size={28} /></div>}
      {patients.isError && <Alert tone="error">Failed to load patients.</Alert>}

      {patients.data?.rows.length === 0 && (
        <EmptyState
          title="No patients yet"
          description="Register your first patient to get started."
          action={canCreate && <Button onClick={() => setOpen(true)}><UserPlus size={16} /> Register patient</Button>}
        />
      )}

      {patients.data && patients.data.rows.length > 0 && (
        <>
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-3">UHID</th>
                    <th className="px-5 py-3">Name</th>
                    <th className="px-5 py-3">Age / Gender</th>
                    <th className="px-5 py-3">Mobile</th>
                    <th className="px-5 py-3">Blood</th>
                    <th className="px-5 py-3">Registered</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {patients.data.rows.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <td className="px-5 py-3 font-mono text-xs text-brand-700">{p.uhid}</td>
                      <td className="px-5 py-3 font-medium text-slate-900">{p.full_name}</td>
                      <td className="px-5 py-3 text-slate-600">
                        {p.date_of_birth ? `${ageFromDOB(p.date_of_birth)}y` : '-'}
                        {p.gender ? ` | ${p.gender.charAt(0)}` : ''}
                      </td>
                      <td className="px-5 py-3 text-slate-600">{p.mobile ?? '-'}</td>
                      <td className="px-5 py-3">
                        {p.blood_group ? <Badge tone="red">{p.blood_group}</Badge> : <span className="text-slate-400">-</span>}
                      </td>
                      <td className="px-5 py-3 text-xs text-slate-500">
                        {new Date(p.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
            <span>{patients.data.total} patient{patients.data.total === 1 ? '' : 's'} | page {patients.data.page} of {totalPages}</span>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
              <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          </div>
        </>
      )}

      <Modal
        open={open}
        onClose={closeModal}
        title="Register patient"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={closeModal}>Cancel</Button>
            <Button form="patient-form" type="submit" loading={isSubmitting}>Register</Button>
          </>
        }
      >
        <form id="patient-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {error && <Alert tone="error">{error}</Alert>}

          {duplicates && pendingValues && (
            <Alert tone="error">
              <div className="space-y-2">
                <div className="flex items-center gap-2 font-semibold">
                  <AlertTriangle size={16} />
                  Possible duplicate patient found
                </div>
                <ul className="space-y-1 text-xs">
                  {duplicates.map((d) => (
                    <li key={d.id}>
                      <span className="font-mono text-brand-700">{d.uhid}</span> - {d.full_name}
                      {d.mobile ? ` | ${d.mobile}` : ''}
                      <span className="ml-1 text-slate-500">({d.reason === 'same_mobile' ? 'same mobile' : 'same name & DOB'})</span>
                    </li>
                  ))}
                </ul>
                <div className="flex gap-2 pt-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setDuplicates(null);
                      setPendingValues(null);
                    }}
                  >
                    Review details
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="danger"
                    onClick={() => commitCreate(pendingValues, true)}
                  >
                    Register anyway
                  </Button>
                </div>
              </div>
            </Alert>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Input label="Full name *" placeholder="Rahul Sharma" {...register('fullName', { required: true })} />
            <Input label="Date of birth" type="date" {...register('dateOfBirth')} />
            <Select label="Gender" {...register('gender')}>
              <option value="">-</option>
              <option value="MALE">Male</option>
              <option value="FEMALE">Female</option>
              <option value="OTHER">Other</option>
            </Select>
            <Input label="Mobile" placeholder="9876543210" {...register('mobile')} />
            <Select label="Blood group" {...register('bloodGroup')}>
              <option value="">-</option>
              {BLOOD_GROUPS.map((b) => <option key={b} value={b}>{b}</option>)}
            </Select>
            <Input label="Emergency contact" placeholder="Name & phone" {...register('emergencyContact')} />
            <Input label="Address" className="md:col-span-2" {...register('address')} />
            <Input label="Allergies" className="md:col-span-2" placeholder="Penicillin, peanuts, ..." {...register('allergies')} />
            <Input label="Medical history" className="md:col-span-2" placeholder="Diabetes, hypertension, ..." {...register('medicalHistory')} />
          </div>
        </form>
      </Modal>
    </>
  );
}

function ageFromDOB(dob: string): number {
  const d = new Date(dob);
  const diff = Date.now() - d.getTime();
  return Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000));
}
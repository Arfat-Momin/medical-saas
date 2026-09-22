import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, UserPlus, AlertTriangle, Users } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { Alert } from '@/components/ui/Alert';
import { ListCard } from '@/components/ui/ListCard';
import { CardListSkeleton, TableSkeleton } from '@/components/ui/Skeleton';
import { usePatients, useCreatePatient } from '@/hooks/usePatients';
import { usePermissions } from '@/hooks/useAuth';
import { useAuthStore } from '@/stores/auth.store';
import { patientsRepository, type Patient, type DuplicateMatch } from '@/repositories/patients.repository';
import { triggerSyncNow } from '@/sync/listeners';
import { PERMISSIONS } from '@medical/shared';
import { EditPatientModal } from '@/pages/patients/EditPatientModal';
import { Avatar } from '@/components/ui/Avatar';

interface FormValues {
  fullName: string; dateOfBirth: string; gender: '' | 'MALE' | 'FEMALE' | 'OTHER';
  mobile: string; address: string; bloodGroup: string;
  allergies: string; medicalHistory: string; emergencyContact: string;
}

const emptyForm: FormValues = {
  fullName: '', dateOfBirth: '', gender: '', mobile: '', address: '',
  bloodGroup: '', allergies: '', medicalHistory: '', emergencyContact: '',
};

const BLOOD_GROUPS = ['A+','A-','B+','B-','AB+','AB-','O+','O-'];

function ageFromDOB(dob: string): number {
  const diff = Date.now() - new Date(dob).getTime();
  return Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000));
}

export function PatientsPage() {
  const { can } = usePermissions();
  const navigate = useNavigate();
  const roles = useAuthStore((s) => s.roles);
  const isHospitalAdmin = roles.includes('HOSPITAL_ADMIN');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const [page, setPage] = useState(1);
  const patients = usePatients({ page, pageSize: 10, search: debouncedSearch });
  const create = useCreatePatient();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicates, setDuplicates] = useState<DuplicateMatch[] | null>(null);
  const [pendingValues, setPendingValues] = useState<FormValues | null>(null);
  const [editTarget, setEditTarget] = useState<Patient | null>(null);
  const [reviewingDuplicates, setReviewingDuplicates] = useState(false);

  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm<FormValues>({ defaultValues: emptyForm });
  const canCreate = can(PERMISSIONS.PATIENT_CREATE);

  useEffect(() => { void triggerSyncNow().catch(() => {}); }, []);

  async function onSubmit(values: FormValues) {
    setError(null); setDuplicates(null);
    try {
      const dup = await patientsRepository.checkDuplicate({
        mobile: values.mobile || undefined,
        fullName: values.fullName,
        dateOfBirth: values.dateOfBirth || undefined,
      });
      if (dup.hasDuplicates) { setDuplicates(dup.matches); setPendingValues(values); return; }
      await commitCreate(values, false);
    } catch (e: any) { setError(e?.message ?? 'Failed to register patient'); }
  }

  async function commitCreate(values: FormValues, skipDuplicateCheck: boolean) {
    try {
      await create.mutateAsync({
        fullName: values.fullName, dateOfBirth: values.dateOfBirth || null,
        gender: values.gender || null, mobile: values.mobile || null,
        address: values.address || null, bloodGroup: values.bloodGroup || null,
        allergies: values.allergies || null, medicalHistory: values.medicalHistory || null,
        emergencyContact: values.emergencyContact || null, skipDuplicateCheck,
      });
      reset(emptyForm); setOpen(false); setDuplicates(null); setPendingValues(null);
    } catch (e: any) { setError(e?.message ?? 'Failed to register patient'); }
  }

  function closeModal() {
    setOpen(false); reset(emptyForm); setError(null); setDuplicates(null); setPendingValues(null);
  }

  const totalPages = patients.data ? Math.max(1, Math.ceil(patients.data.total / (patients.data.pageSize || 10))) : 1;
  const rows = patients.data?.rows ?? [];

  return (
    <>
      <PageHeader
        title="Patients"
        subtitle={`${patients.data?.total ?? 0} patient${(patients.data?.total ?? 0) === 1 ? '' : 's'} in your registry`}
        action={
          canCreate && (
            <Button onClick={() => setOpen(true)} size="md" leftIcon={<UserPlus size={16} />}>
              <span className="hidden sm:inline">Register patient</span>
              <span className="sm:hidden">New</span>
            </Button>
          )
        }
      />

      <div className="mb-5 max-w-md">
        <Input
          placeholder="Search by name, mobile or UHID"
          leftIcon={<Search size={16} />}
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        />
      </div>

      {patients.isLoading && (
        <>
          <div className="hidden md:block"><TableSkeleton rows={6} cols={5} /></div>
          <div className="md:hidden"><CardListSkeleton rows={4} /></div>
        </>
      )}

      {patients.isError && <Alert tone="error">Failed to load patients.</Alert>}

      {!patients.isLoading && rows.length === 0 && (
        <EmptyState
          icon={<Users size={22} />}
          title="No patients yet"
          description={search ? `No matches for "${search}".` : 'Register your first patient to get started.'}
          action={canCreate && !search && (
            <Button onClick={() => setOpen(true)} leftIcon={<UserPlus size={16} />}>Register patient</Button>
          )}
        />
      )}

      {/* Mobile — card list */}
      {!patients.isLoading && rows.length > 0 && (
        <div className="space-y-3 md:hidden">
          {rows.map((p) => (
            <ListCard
              key={p.id}
              onClick={() => navigate(`/patients/${p.id}`)}
              actions={
                <>
                  <Button size="sm" variant="secondary" onClick={() => navigate(`/patients/${p.id}`)}>View</Button>
                  {isHospitalAdmin && <Button size="sm" onClick={() => setEditTarget(p)}>Edit</Button>}
                </>
              }
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-base font-semibold text-slate-900">{p.full_name}</p>
                    {p.blood_group && (
                      <span className="shrink-0 rounded border border-red-200 bg-red-50 px-1.5 py-0.5 text-2xs font-bold text-red-700">
                        {p.blood_group}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 font-mono text-xs text-brand-700">{p.uhid}</p>
                </div>
                <Avatar name={p.full_name} size={36} />
              </div>
              <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-600">
                {p.mobile && <div><span className="text-slate-400">Mobile </span>{p.mobile}</div>}
                {(p.date_of_birth || p.gender) && (
                  <div className="col-span-2">
                    <span className="text-slate-400">Age / Gender </span>
                    {p.date_of_birth ? `${ageFromDOB(p.date_of_birth)}y` : '-'}
                    {p.gender ? ` · ${p.gender.charAt(0)}` : ''}
                  </div>
                )}
              </div>
            </ListCard>
          ))}
        </div>
      )}

      {/* Desktop — table */}
      {!patients.isLoading && rows.length > 0 && (
        <div className="hidden md:block">
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-card">
            <div className="overflow-x-auto">
              <table className="w-full text-base">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/60 text-left text-2xs font-medium uppercase tracking-wider text-slate-500">
                    <th className="px-5 py-3">UHID</th>
                    <th className="px-5 py-3">Name</th>
                    <th className="px-5 py-3">Age / Gender</th>
                    <th className="px-5 py-3">Mobile</th>
                    <th className="px-5 py-3">Blood</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((p) => (
                    <tr key={p.id} className="transition-colors hover:bg-slate-50/60">
                      <td className="px-5 py-3.5 font-mono text-xs text-brand-700">{p.uhid}</td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <Avatar name={p.full_name} size={32} />
                          <span className="font-medium text-slate-900">{p.full_name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-slate-600">
                        {p.date_of_birth ? `${ageFromDOB(p.date_of_birth)}y` : '-'}
                        {p.gender ? ` · ${p.gender.charAt(0)}` : ''}
                      </td>
                      <td className="px-5 py-3.5 text-slate-600">{p.mobile ?? '-'}</td>
                      <td className="px-5 py-3.5">
                        {p.blood_group ? <Badge tone="red">{p.blood_group}</Badge> : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex justify-end gap-1.5">
                          <button
                            onClick={() => navigate(`/patients/${p.id}`)}
                            className="rounded-md px-3 py-1 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
                          >
                            View
                          </button>
                          {isHospitalAdmin && (
                            <button
                              onClick={() => setEditTarget(p)}
                              className="rounded-md px-3 py-1 text-sm font-medium text-brand-600 transition-colors hover:bg-brand-50"
                            >
                              Edit
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Pagination */}
      {patients.data && patients.data.total > 10 && (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
          <span className="tabular-nums">
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
            <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
          </div>
        </div>
      )}

      {/* Register modal */}
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
            <Alert tone="warning">
              <div className="flex items-center gap-2 font-semibold">
                <AlertTriangle size={15} /> Possible duplicate found
              </div>
              <ul className="mt-2 space-y-1 text-xs">
                {duplicates.map((d) => (
                  <li key={d.id} className="flex flex-wrap items-center gap-1.5">
                    <span className="font-mono text-brand-700">{d.uhid}</span>
                    <span>·</span>
                    <span>{d.full_name}</span>
                    {d.mobile && <><span>·</span><span>{d.mobile}</span></>}
                    <span className="text-slate-500">
                      ({d.reason === 'same_mobile' ? 'same mobile' : 'same name & DOB'})
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex gap-2">
                <Button type="button" size="sm" variant="secondary" onClick={() => setReviewingDuplicates(true)}>
                  Review details
                </Button>
                <Button type="button" size="sm" variant="danger" onClick={() => commitCreate(pendingValues, true)}>
                  Register anyway
                </Button>
              </div>
            </Alert>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label="Full name *" placeholder="Rahul Sharma" {...register('fullName', { required: true })} />
            <Input label="Date of birth" type="date" {...register('dateOfBirth')} />
            <Select label="Gender" {...register('gender')}>
              <option value="">—</option>
              <option value="MALE">Male</option>
              <option value="FEMALE">Female</option>
              <option value="OTHER">Other</option>
            </Select>
            <Input label="Mobile" placeholder="9876543210" {...register('mobile')} />
            <Select label="Blood group" {...register('bloodGroup')}>
              <option value="">—</option>
              {BLOOD_GROUPS.map((b) => <option key={b} value={b}>{b}</option>)}
            </Select>
            <Input label="Emergency contact" placeholder="Name & phone" {...register('emergencyContact')} />
            <Input label="Address" className="sm:col-span-2" {...register('address')} />
            <Input label="Allergies" className="sm:col-span-2" placeholder="Penicillin, peanuts…" {...register('allergies')} />
            <Input label="Medical history" className="sm:col-span-2" placeholder="Diabetes, hypertension…" {...register('medicalHistory')} />
          </div>
        </form>
      </Modal>

      <Modal
        open={reviewingDuplicates && !!duplicates}
        onClose={() => setReviewingDuplicates(false)}
        title="Possible duplicate patients"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setReviewingDuplicates(false)}>
              Back to form
            </Button>
            {pendingValues && (
              <Button
                variant="danger"
                onClick={() => {
                  setReviewingDuplicates(false);
                  void commitCreate(pendingValues, true);
                }}
              >
                Register anyway
              </Button>
            )}
          </>
        }
      >
        <div className="space-y-3">
          <Alert tone="warning">
            <div className="flex items-start gap-2">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <p className="text-sm">
                We found existing patients with matching details. Review them
                before registering a new patient to avoid creating a duplicate record.
              </p>
            </div>
          </Alert>

          {(duplicates ?? []).map((d) => (
            <div key={d.id} className="rounded-lg border border-amber-200 bg-amber-50/40 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-base font-semibold text-slate-900">
                      {d.full_name}
                    </p>
                    <Badge tone="yellow">
                      {d.reason === 'same_mobile' ? 'Same mobile' : 'Same name & DOB'}
                    </Badge>
                  </div>
                  <p className="mt-0.5 font-mono text-xs text-brand-700">{d.uhid}</p>
                </div>
              </div>

              <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2 text-xs sm:grid-cols-2">
                <div>
                  <dt className="text-slate-500">Mobile</dt>
                  <dd className="text-slate-800">{d.mobile ?? '\u2014'}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Date of birth</dt>
                  <dd className="text-slate-800">{d.date_of_birth ?? '\u2014'}</dd>
                </div>
              </dl>

              <div className="mt-3 flex justify-end border-t border-amber-200 pt-3">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setReviewingDuplicates(false);
                    closeModal();
                    navigate(`/patients/${d.id}`);
                  }}
                >
                  View full profile
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Modal>

      <EditPatientModal
        open={editTarget !== null}
        patient={editTarget}
        onClose={() => setEditTarget(null)}
        onSaved={() => patients.refetch()}
      />
    </>
  );
}
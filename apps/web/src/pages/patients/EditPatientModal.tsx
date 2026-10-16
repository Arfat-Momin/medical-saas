import { useEffect, useState } from 'react';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { Alert } from '@/components/ui/Alert';
import { patientsRepository, type Patient } from '@/repositories/patients.repository';
import { useUpdatePatient } from '@/hooks/usePatients';
import { useAuthStore } from '@/stores/auth.store';
import { ApiError } from '@/lib/api';

interface Props {
  open: boolean;
  patient: Patient | null;
  onClose: () => void;
  onSaved?: () => void;
}

const BLOOD_GROUPS = ['A+','A-','B+','B-','AB+','AB-','O+','O-'];

interface FormState {
  fullName: string;
  dateOfBirth: string;
  gender: '' | 'MALE' | 'FEMALE' | 'OTHER';
  mobile: string;
  address: string;
  bloodGroup: string;
  allergies: string;
  medicalHistory: string;
  emergencyContact: string;
  registrationAmount: string;
  regPaymentMode: string;
  regPaymentDate: string;
  regReceiptNo: string;
  coverageType: string;
  coverageProvider: string;
  policyNumber: string;
  coverageValidity: string;
  coverageNotes: string;
}

const empty: FormState = {
  fullName: '', dateOfBirth: '', gender: '', mobile: '', address: '',
  bloodGroup: '', allergies: '', medicalHistory: '', emergencyContact: '',
  registrationAmount: '', regPaymentMode: '', regPaymentDate: '', regReceiptNo: '',
  coverageType: 'NONE', coverageProvider: '', policyNumber: '', coverageValidity: '', coverageNotes: '',
};

export function EditPatientModal({ open, patient, onClose, onSaved }: Props) {
  const update = useUpdatePatient();
  const [form, setForm] = useState<FormState>(empty);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Hydrate form when patient changes
  useEffect(() => {
    if (!patient) {
      setForm(empty);
      return;
    }
    setForm({
      fullName: patient.full_name ?? '',
      dateOfBirth: patient.date_of_birth ?? '',
      gender: (patient.gender ?? '') as FormState['gender'],
      mobile: patient.mobile ?? '',
      address: patient.address ?? '',
      bloodGroup: patient.blood_group ?? '',
      allergies: patient.allergies ?? '',
      medicalHistory: patient.medical_history ?? '',
      emergencyContact: patient.emergency_contact ?? '',
      registrationAmount: patient.registration_amount ? String(patient.registration_amount) : '',
      regPaymentMode: patient.reg_payment_mode ?? '',
      regPaymentDate: patient.reg_payment_date ? new Date(patient.reg_payment_date).toISOString().slice(0, 16) : '',
      regReceiptNo: patient.reg_receipt_no ?? '',
      coverageType: patient.coverage_type ?? 'NONE',
      coverageProvider: patient.coverage_provider ?? '',
      policyNumber: patient.policy_number ?? '',
      coverageValidity: patient.coverage_validity ?? '',
      coverageNotes: patient.coverage_notes ?? '',
    });
    setError(null);
    setSaved(false);
  }, [patient]);

  const dirty = patient && (
    form.fullName !== (patient.full_name ?? '') ||
    form.dateOfBirth !== (patient.date_of_birth ?? '') ||
    form.gender !== (patient.gender ?? '') ||
    form.mobile !== (patient.mobile ?? '') ||
    form.address !== (patient.address ?? '') ||
    form.bloodGroup !== (patient.blood_group ?? '') ||
    form.allergies !== (patient.allergies ?? '') ||
    form.medicalHistory !== (patient.medical_history ?? '') ||
    form.emergencyContact !== (patient.emergency_contact ?? '') ||
    form.registrationAmount !== (patient.registration_amount ? String(patient.registration_amount) : '') ||
    form.regPaymentMode !== (patient.reg_payment_mode ?? '') ||
    form.regPaymentDate !== (patient.reg_payment_date ? new Date(patient.reg_payment_date).toISOString().slice(0, 16) : '') ||
    form.regReceiptNo !== (patient.reg_receipt_no ?? '') ||
    form.coverageType !== (patient.coverage_type ?? 'NONE') ||
    form.coverageProvider !== (patient.coverage_provider ?? '') ||
    form.policyNumber !== (patient.policy_number ?? '') ||
    form.coverageValidity !== (patient.coverage_validity ?? '') ||
    form.coverageNotes !== (patient.coverage_notes ?? '')
  );

  const onChange = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    if (!patient) return;
    setError(null);
    setSaved(false);

    if (!form.fullName.trim()) {
      setError('Patient name is required');
      return;
    }

    try {
      await update.mutateAsync({
        id: patient.id,
        patch: {
          fullName: form.fullName.trim(),
          dateOfBirth: form.dateOfBirth || null,
          gender: (form.gender || null) as any,
          mobile: form.mobile || null,
          address: form.address || null,
          bloodGroup: form.bloodGroup || null,
          allergies: form.allergies || null,
          medicalHistory: form.medicalHistory || null,
          emergencyContact: form.emergencyContact || null,
          registrationAmount: form.registrationAmount ? Number(form.registrationAmount) : null,
          regPaymentMode: form.regPaymentMode || null,
          regPaymentDate: form.regPaymentDate ? new Date(form.regPaymentDate).toISOString() : null,
          regReceiptNo: form.regReceiptNo || null,
          coverageType: form.coverageType || 'NONE',
          coverageProvider: form.coverageProvider || null,
          policyNumber: form.policyNumber || null,
          coverageValidity: form.coverageValidity || null,
          coverageNotes: form.coverageNotes || null,
        },
      });
      setSaved(true);
      setTimeout(() => {
        onSaved?.();
        onClose();
      }, 500);
    } catch (err: any) {
      setError(err instanceof ApiError ? err.message : 'Save failed');
    }
  }

  async function onDelete() {
    if (!patient) return;
    setDeleting(true);
    try {
      await patientsRepository.remove(patient.id);
      setDeleteConfirmOpen(false);
      onSaved?.();
      onClose();
    } catch (err: any) {
      setError(err instanceof ApiError ? err.message : 'Delete failed');
      setDeleting(false);
    }
  }

  const roles = useAuthStore((s) => s.roles);
  const isHospitalAdmin = roles.includes('HOSPITAL_ADMIN');

  if (!isHospitalAdmin) {
    return (
      <Modal
        open={open}
        onClose={onClose}
        title="Not allowed"
        size="sm"
        footer={<Button variant="secondary" onClick={onClose}>Close</Button>}
      >
        <Alert tone="error">
          Only the Hospital Admin can edit or delete patient records.
        </Alert>
      </Modal>
    );
  }

  if (!patient) return null;

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title={`Edit patient - ${patient.uhid}`}
        size="lg"
        footer={
          <>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setDeleteConfirmOpen(true)}
              className="mr-auto text-red-600 hover:bg-red-50"
            >
              <Trash2 size={14} /> Delete
            </Button>
            <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
            <Button
              form="edit-patient-form"
              type="submit"
              loading={update.isPending}
              disabled={!dirty}
            >
              Save changes
            </Button>
          </>
        }
      >
        <form id="edit-patient-form" onSubmit={onSave} className="space-y-4">
          {error && <Alert tone="error">{error}</Alert>}
          {saved && <Alert tone="success">Saved.</Alert>}

          <div className="rounded-md bg-brand-50 px-3 py-2 text-sm">
            <span className="font-mono font-semibold text-brand-700">{patient.uhid}</span>
            {patient.created_at && (
              <span className="ml-3 text-xs text-brand-700/70">
                Registered {new Date(patient.created_at).toLocaleDateString()}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Input
              label="Full name *"
              value={form.fullName}
              onChange={onChange('fullName')}
              placeholder="Rahul Sharma"
            />
            <Input
              label="Date of birth"
              type="date"
              value={form.dateOfBirth}
              onChange={onChange('dateOfBirth')}
            />
            <Select label="Gender" value={form.gender} onChange={onChange('gender')}>
              <option value="">-</option>
              <option value="MALE">Male</option>
              <option value="FEMALE">Female</option>
              <option value="OTHER">Other</option>
            </Select>
            <Input
              label="Mobile"
              value={form.mobile}
              onChange={onChange('mobile')}
              placeholder="9876543210"
            />
            <Select label="Blood group" value={form.bloodGroup} onChange={onChange('bloodGroup')}>
              <option value="">-</option>
              {BLOOD_GROUPS.map((b) => <option key={b} value={b}>{b}</option>)}
            </Select>
            <Input
              label="Emergency contact"
              value={form.emergencyContact}
              onChange={onChange('emergencyContact')}
              placeholder="Name & phone"
            />
            <Input
              label="Address"
              className="md:col-span-2"
              value={form.address}
              onChange={onChange('address')}
            />
            <Input
              label="Allergies"
              className="md:col-span-2"
              value={form.allergies}
              onChange={onChange('allergies')}
              placeholder="Penicillin, peanuts, ..."
            />
            <Input
              label="Medical history"
              className="md:col-span-2"
              value={form.medicalHistory}
              onChange={onChange('medicalHistory')}
              placeholder="Diabetes, hypertension, ..."
            />
          </div>

          <div className="mt-6 border-t border-slate-100 pt-6">
            <h3 className="mb-4 text-sm font-semibold text-slate-800">Registration & Coverage</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input label="Registration amount (₹)" type="number" value={form.registrationAmount} onChange={onChange('registrationAmount')} />
              <Select label="Payment mode" value={form.regPaymentMode} onChange={onChange('regPaymentMode')}>
                <option value="">—</option>
                <option value="CASH">Cash</option>
                <option value="CARD">Card</option>
                <option value="UPI">UPI</option>
                <option value="CHEQUE">Cheque</option>
                <option value="NEFT_RTGS">NEFT/RTGS</option>
              </Select>
              <Input label="Payment date" type="datetime-local" value={form.regPaymentDate} onChange={onChange('regPaymentDate')} />
              <Input label="Receipt/Transaction No" value={form.regReceiptNo} onChange={onChange('regReceiptNo')} />

              <Select label="Coverage type" value={form.coverageType} onChange={onChange('coverageType')} className="sm:col-span-2">
                <option value="NONE">None (Self-pay)</option>
                <option value="GOVERNMENT_POLICY">Government Policy</option>
                <option value="MEDICLAIM_INSURANCE">Mediclaim / Insurance</option>
                <option value="PACKAGE">Package</option>
                <option value="SWASTHYA_SATHI">Swasthya Sathi</option>
                <option value="OTHER">Other</option>
              </Select>
              
              <Input label="Provider / Scheme name" value={form.coverageProvider} onChange={onChange('coverageProvider')} />
              <Input label="Policy number" value={form.policyNumber} onChange={onChange('policyNumber')} />
              <Input label="Validity date" type="date" value={form.coverageValidity} onChange={onChange('coverageValidity')} />
              <Input label="Coverage notes" value={form.coverageNotes} onChange={onChange('coverageNotes')} />
            </div>
          </div>
        </form>
      </Modal>

      {/* Delete confirmation */}
      <Modal
        open={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        title="Delete patient?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteConfirmOpen(false)}>Cancel</Button>
            <Button variant="danger" onClick={onDelete} loading={deleting}>
              Delete permanently
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Alert tone="error">
            <div className="flex items-start gap-2">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <div>
                <strong>{patient.full_name}</strong> ({patient.uhid}) will be removed.
                <p className="mt-1 text-xs">
                  Historical invoices and clinical records that reference this patient
                  are preserved for compliance.
                </p>
              </div>
            </div>
          </Alert>
          <p className="text-sm text-slate-600">
            This action cannot be undone from the UI. Contact platform support if this
            was a mistake.
          </p>
        </div>
      </Modal>
    </>
  );
}

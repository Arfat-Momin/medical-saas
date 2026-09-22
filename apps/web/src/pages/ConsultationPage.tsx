import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Plus, Save, Trash2, Activity, FileText, Stethoscope, Pill, CheckCircle2, FlaskConical, Printer,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Alert } from '@/components/ui/Alert';
import { Spinner } from '@/components/ui/Spinner';
import { useEncounter, useSaveEncounter } from '@/hooks/useEncounter';
import { doctorsRepository } from '@/repositories/doctors.repository';
import { useOrganization } from '@/hooks/useOrganization';
import { LabTestPicker } from '@/components/LabTestPicker';
import { MedicinePicker } from '@/components/MedicinePicker';
import { PrintPreviewModal } from '@/components/PrintPreviewModal';
import { PrescriptionPrint } from '@/components/print/PrescriptionPrint';
import type { VitalsData, DiagnosisData, PrescriptionItemData, LabTestData } from '@/db/schema';

const emptyVitals: VitalsData = {
  temperatureC: '',
  bpSystolic: '',
  bpDiastolic: '',
  pulse: '',
  respRate: '',
  spo2: '',
  weightKg: '',
  heightCm: '',
};

const emptyDiagnosis = (isPrimary = false): DiagnosisData => ({
  diagnosisText: '',
  icdCode: null,
  notes: null,
  isPrimary,
});

const emptyItem = (): PrescriptionItemData => ({
  medicineName: '',
  dosage: null,
  frequency: null,
  duration: null,
  route: 'Oral',
  instructions: null,
  quantity: null,
});

const FREQUENCIES = [
  { value: '1-0-0', label: '1-0-0 (Morning)' },
  { value: '0-1-0', label: '0-1-0 (Afternoon)' },
  { value: '0-0-1', label: '0-0-1 (Night)' },
  { value: '1-0-1', label: '1-0-1 (Morning + Night)' },
  { value: '1-1-1', label: '1-1-1 (Three times)' },
  { value: '1-1-1-1', label: '1-1-1-1 (Four times)' },
  { value: 'SOS', label: 'SOS (As needed)' },
  { value: 'STAT', label: 'STAT (Immediately)' },
  { value: 'Weekly', label: 'Weekly' },
  { value: 'Alternate', label: 'Alternate days' },
];

export function ConsultationPage() {
  const { encounterId } = useParams<{ encounterId: string }>();
  const navigate = useNavigate();
  const enc = useEncounter(encounterId);
  const save = useSaveEncounter(encounterId ?? '');

  const [chiefComplaint, setChiefComplaint] = useState('');
  const [history, setHistory] = useState('');
  const [examination, setExamination] = useState('');
  const [notes, setNotes] = useState('');
  const [vitals, setVitals] = useState<VitalsData>(emptyVitals);
  const [diagnoses, setDiagnoses] = useState<DiagnosisData[]>([emptyDiagnosis(true)]);
  const [items, setItems] = useState<PrescriptionItemData[]>([emptyItem()]);
  const [rxNotes, setRxNotes] = useState('');
  const [labTests, setLabTests] = useState<LabTestData[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const organization = useOrganization();
  const [printOpen, setPrintOpen] = useState(false);
  const [loadedEncounterId, setLoadedEncounterId] = useState<string | null>(null);
  const [doctorName, setDoctorName] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  useEffect(() => {
    if (!enc.data) return;
    // Only hydrate once per encounter; a background refetch must not
    // overwrite the doctor's in-progress edits.
    if (loadedEncounterId === enc.data.local_id) return;
    setLoadedEncounterId(enc.data.local_id);
    const e = enc.data;
    setChiefComplaint(e.chief_complaint ?? '');
    setHistory(e.history ?? '');
    setExamination(e.examination ?? '');
    setNotes(e.notes ?? '');
    setVitals(e.vitals ?? emptyVitals);
    setDiagnoses(e.diagnoses.length > 0 ? e.diagnoses : [emptyDiagnosis(true)]);
    setItems(
      e.prescription?.items && e.prescription.items.length > 0
        ? e.prescription.items
        : [emptyItem()],
    );
    setRxNotes(e.prescription?.notes ?? '');
    setLabTests(e.lab_tests ?? []);
  }, [enc.data, loadedEncounterId]);

  // Resolve the prescriber's name from the local doctors mirror for the print.
  useEffect(() => {
    const doctorId = enc.data?.doctor_id;
    if (!doctorId) { setDoctorName(null); return; }
    let cancelled = false;
    doctorsRepository
      .list()
      .then((list) => {
        if (cancelled) return;
        const match = list.find((d) => d.server_id === doctorId);
        setDoctorName(match?.full_name ?? null);
      })
      .catch(() => { if (!cancelled) setDoctorName(null); });
    return () => { cancelled = true; };
  }, [enc.data?.doctor_id]);

  const bmi = useMemo(() => {
    const w = parseFloat(vitals.weightKg ?? '');
    const h = parseFloat(vitals.heightCm ?? '');
    if (w > 0 && h > 0) return (w / Math.pow(h / 100, 2)).toFixed(1);
    return null;
  }, [vitals.weightKg, vitals.heightCm]);

  useEffect(() => {
    if (!saved) return;
    const t = setTimeout(() => setSaved(false), 2500);
    return () => clearTimeout(t);
  }, [saved]);

  async function onSave(complete: boolean) {
    setError(null);
    setSaved(false);
    try {
      const cleanDiagnoses = diagnoses
        .filter((d) => d.diagnosisText.trim())
        .map((d, i) => ({ ...d, isPrimary: i === 0 || d.isPrimary }));

      const cleanItems = items.filter((it) => it.medicineName.trim());
      if (items.length > 0 && cleanItems.length === 0 && items.some((it) => it.dosage || it.frequency || it.duration)) {
        setError('Some prescription rows have details but no medicine name. Please fill in the medicine name or remove the row.');
        return;
      }

      await save.mutateAsync({
        chiefComplaint: chiefComplaint || null,
        history: history || null,
        examination: examination || null,
        notes: notes || null,
        vitals: hasAnyVital(vitals) ? vitals : null,
        diagnoses: cleanDiagnoses,
        prescription:
          cleanItems.length > 0 ? { notes: rxNotes || null, items: cleanItems } : null,
        labTests: labTests.length > 0 ? labTests : null,
        complete,
      });
      setSaved(true);
      setDirty(false);
      if (complete) {
        setTimeout(() => navigate('/appointments'), 800);
      }
    } catch (err: any) {
      setError(err?.message ?? 'Save failed');
    }
  }

  function updateDiagnosis(i: number, patch: Partial<DiagnosisData>) {
    setDirty(true);
    setDiagnoses(diagnoses.map((d, j) => (j === i ? { ...d, ...patch } : d)));
  }
  function updateItem(i: number, patch: Partial<PrescriptionItemData>) {
    setDirty(true);
    setItems(items.map((it, j) => (j === i ? { ...it, ...patch } : it)));
  }

  if (enc.isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size={32} />
      </div>
    );
  }

  if (enc.isError || !enc.data) {
    return (
      <div className="space-y-4">
        <Alert tone="error">Failed to load encounter.</Alert>
        <Button variant="secondary" onClick={() => navigate('/appointments')}>
          <ArrowLeft size={14} /> Back
        </Button>
      </div>
    );
  }

  const e = enc.data;
  const isCompleted = e.status === 'COMPLETED';

  return (
    <>
      <div className="mb-4">
        <button
          onClick={() => {
            if (dirty && !window.confirm('You have unsaved changes. Leave anyway?')) return;
            navigate(-1);
          }}
          className="inline-flex items-center gap-1 text-sm text-brand-600 hover:underline"
        >
          <ArrowLeft size={14} /> Back
        </button>
      </div>

      {/* Patient header */}
      <Card className="mb-6">
        <CardBody className="flex flex-wrap items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-600">
            <Stethoscope size={22} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-lg font-semibold text-slate-900">
                {e.patient_name ?? 'Patient'}
              </h2>
              <Badge tone={isCompleted ? 'green' : 'yellow'}>{e.status}</Badge>
              {e.sync_status === 'pending' && (
                <span className="text-xs text-amber-600">- syncing</span>
              )}
            </div>
            <p className="mt-0.5 truncate text-sm text-slate-500">
              <span className="font-mono text-brand-700">{e.patient_uhid ?? 'PENDING'}</span>
              {' - '}
              {e.encounter_date}
            </p>
          </div>
        </CardBody>
      </Card>

      {error && <div className="mb-4"><Alert tone="error">{error}</Alert></div>}
      {saved && (
        <div className="mb-4">
          <Alert tone="success">Saved locally - syncing.</Alert>
        </div>
      )}

      <fieldset disabled={isCompleted} className="space-y-6" onChange={() => setDirty(true)}>
        {/* SYMPTOMS */}
        <Card>
          <CardHeader title="Symptoms & Complaint" subtitle="Chief complaint, history and examination" />
          <CardBody className="space-y-4">
            <Input
              label="Chief complaint"
              value={chiefComplaint}
              onChange={(ev) => setChiefComplaint(ev.target.value)}
              placeholder="Fever, cough since 3 days"
            />
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Input
                label="History"
                value={history}
                onChange={(ev) => setHistory(ev.target.value)}
                placeholder="Past medical history, medications"
              />
              <Input
                label="Examination"
                value={examination}
                onChange={(ev) => setExamination(ev.target.value)}
                placeholder="General exam findings"
              />
            </div>
          </CardBody>
        </Card>

        {/* VITALS */}
        <Card>
          <CardHeader
            title="Vital Signs"
            subtitle="Recorded at time of consultation"
            action={<Activity size={16} className="text-slate-400" />}
          />
          <CardBody>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <Input label="Temp (C)" type="number" min="30" max="45" step="0.1" value={vitals.temperatureC ?? ''} onChange={(ev) => setVitals({ ...vitals, temperatureC: ev.target.value })} />
              <Input label="Pulse" type="number" min="20" max="300" value={vitals.pulse ?? ''} onChange={(ev) => setVitals({ ...vitals, pulse: ev.target.value })} />
              <Input label="BP sys" type="number" min="50" max="300" value={vitals.bpSystolic ?? ''} onChange={(ev) => setVitals({ ...vitals, bpSystolic: ev.target.value })} />
              <Input label="BP dia" type="number" min="30" max="200" value={vitals.bpDiastolic ?? ''} onChange={(ev) => setVitals({ ...vitals, bpDiastolic: ev.target.value })} />
              <Input label="Resp" type="number" min="5" max="60" value={vitals.respRate ?? ''} onChange={(ev) => setVitals({ ...vitals, respRate: ev.target.value })} />
              <Input label="SpO2" type="number" min="50" max="100" value={vitals.spo2 ?? ''} onChange={(ev) => setVitals({ ...vitals, spo2: ev.target.value })} />
              <Input label="Weight" type="number" min="0.5" max="500" step="0.1" value={vitals.weightKg ?? ''} onChange={(ev) => setVitals({ ...vitals, weightKg: ev.target.value })} />
              <Input label="Height" type="number" min="20" max="250" step="0.1" value={vitals.heightCm ?? ''} onChange={(ev) => setVitals({ ...vitals, heightCm: ev.target.value })} />
            </div>
            <p className="mt-3 text-xs text-slate-500">
              BMI: <span className="font-mono text-slate-700">{bmi ?? '-'}</span>
            </p>
          </CardBody>
        </Card>

        {/* DIAGNOSIS */}
        <Card>
          <CardHeader
            title="Diagnosis"
            subtitle="Primary and secondary diagnoses"
            action={
              <Button
                size="sm"
                variant="secondary"
                onClick={() => { setDirty(true); setDiagnoses([...diagnoses, emptyDiagnosis()]); }}
              >
                <Plus size={14} /> Add
              </Button>
            }
          />
          <CardBody className="space-y-3">
            {diagnoses.map((d, i) => (
              <div key={i} className="rounded-md border border-slate-200 p-3">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
                  <div className="md:col-span-5">
                    <Input
                      label="Diagnosis"
                      value={d.diagnosisText}
                      onChange={(ev) => updateDiagnosis(i, { diagnosisText: ev.target.value })}
                      placeholder="Acute viral fever"
                    />
                  </div>
                  <div className="md:col-span-3">
                    <Input
                      label="ICD code"
                      value={d.icdCode ?? ''}
                      onChange={(ev) => updateDiagnosis(i, { icdCode: ev.target.value || null })}
                      placeholder="J02.9"
                    />
                  </div>
                  <div className="md:col-span-4">
                    <Input
                      label="Notes"
                      value={d.notes ?? ''}
                      onChange={(ev) => updateDiagnosis(i, { notes: ev.target.value || null })}
                    />
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <label className="flex items-center gap-1 text-xs text-slate-600">
                    <input
                      type="radio"
                      checked={d.isPrimary}
                      onChange={() => setDiagnoses(diagnoses.map((x, j) => ({ ...x, isPrimary: i === j })))}
                    />
                    Primary
                  </label>
                  {diagnoses.length > 1 && (
                    <button
                      onClick={() => { setDirty(true); setDiagnoses(diagnoses.filter((_, j) => j !== i)); }}
                      className="text-slate-400 hover:text-red-500"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </CardBody>
        </Card>

        {/* PRESCRIPTION */}
        <Card>
          <CardHeader
            title="Prescription"
            subtitle="Medicines, dosage and instructions"
            action={
              <div className="flex items-center gap-2">
                <Pill size={16} className="text-slate-400" />
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => { setDirty(true); setItems([...items, emptyItem()]); }}
                >
                  <Plus size={14} /> Add
                </Button>
              </div>
            }
          />
          <CardBody className="space-y-3">
            {items.map((it, i) => (
              <div key={i} className="rounded-md border border-slate-200 p-3">
                {/* Row 1: Medicine + Dose + Frequency + Duration + Route */}
                <div className="grid grid-cols-2 gap-3 md:grid-cols-12">
                  <div className="col-span-2 md:col-span-4">
                    <MedicinePicker
                      value={it.medicineName}
                      onChange={(name) => updateItem(i, { medicineName: name })}
                      placeholder="Search medicine..."
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Input
                      label="Dose"
                      value={it.dosage ?? ''}
                      onChange={(ev) => updateItem(i, { dosage: ev.target.value || null })}
                      placeholder="1 tab"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Select
                      label="Frequency"
                      value={it.frequency ?? ''}
                      onChange={(ev) => updateItem(i, { frequency: ev.target.value || null })}
                    >
                      <option value="">-</option>
                      {FREQUENCIES.map((f) => (
                        <option key={f.value} value={f.value}>{f.label}</option>
                      ))}
                    </Select>
                  </div>
                  <div className="md:col-span-2">
                    <Input
                      label="Duration"
                      value={it.duration ?? ''}
                      onChange={(ev) => updateItem(i, { duration: ev.target.value || null })}
                      placeholder="5 days"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Select
                      label="Route"
                      value={it.route ?? 'Oral'}
                      onChange={(ev) => updateItem(i, { route: ev.target.value })}
                    >
                      <option>Oral</option>
                      <option>IV</option>
                      <option>IM</option>
                      <option>Topical</option>
                      <option>Inhalation</option>
                      <option>Sublingual</option>
                      <option>Rectal</option>
                    </Select>
                  </div>
                </div>

                {/* Row 2: Instructions + Remove */}
                <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-12">
                  <div className="md:col-span-10">
                    <Input
                      label="Instructions"
                      value={it.instructions ?? ''}
                      onChange={(ev) => updateItem(i, { instructions: ev.target.value || null })}
                      placeholder="After food"
                    />
                  </div>
                  <div className="md:col-span-2 flex items-end">
                    {items.length > 1 && (
                      <button
                        onClick={() => { setDirty(true); setItems(items.filter((_, j) => j !== i)); }}
                        className="rounded p-2 text-slate-400 hover:bg-red-50 hover:text-red-500"
                        title="Remove medicine"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
            <Input
              label="Prescription notes"
              value={rxNotes}
              onChange={(ev) => setRxNotes(ev.target.value)}
              placeholder="Any additional instructions"
            />
          </CardBody>
        </Card>

        {/* LAB TESTS */}
        <Card>
          <CardHeader
            title="Lab Tests"
            subtitle="Order tests - sent to lab automatically on completion"
            action={<FlaskConical size={16} className="text-slate-400" />}
          />
          <CardBody>
            <LabTestPicker value={labTests} onChange={(val) => { setDirty(true); setLabTests(val); }} disabled={isCompleted} />
          </CardBody>
        </Card>

        {/* NOTES */}
        <Card>
          <CardHeader
            title="Notes"
            subtitle="Internal clinical notes"
            action={<FileText size={16} className="text-slate-400" />}
          />
          <CardBody>
            <textarea
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              rows={3}
              value={notes}
              onChange={(ev) => setNotes(ev.target.value)}
              placeholder="Free-text notes"
            />
          </CardBody>
        </Card>
      </fieldset>

      {/* Actions */}
      <div className="mt-6 flex flex-wrap justify-end gap-3">
        <Button variant="secondary" onClick={() => navigate('/appointments')}>
          Back
        </Button>
        <Button variant="secondary" onClick={() => setPrintOpen(true)}>
          <Printer size={14} /> Print prescription
        </Button>
        {!isCompleted && (
          <>
            <Button
              variant="secondary"
              onClick={() => onSave(false)}
              loading={save.isPending}
            >
              <Save size={14} /> Save draft
            </Button>
            <Button onClick={() => onSave(true)} loading={save.isPending}>
              <CheckCircle2 size={14} /> Complete
            </Button>
          </>
        )}
        {isCompleted && (
          <Badge tone="green" className="px-3 py-1.5 text-sm">
            <CheckCircle2 size={14} className="mr-1 inline" /> Completed
          </Badge>
        )}
      </div>
    
      {/* Print preview modal */}
      <PrintPreviewModal
        open={printOpen}
        onClose={() => setPrintOpen(false)}
        title={`Prescription - ${e.patient_name ?? ''}`}
      >
        <PrescriptionPrint
          organization={organization.data}
          patient={{
            full_name: e.patient_name ?? 'Patient',
            uhid: e.patient_uhid ?? 'PENDING',
            date_of_birth: null,
            gender: null,
            mobile: null,
            allergies: null,
          }}
          doctor={{ full_name: doctorName }}
          encounter={{
            encounter_date: e.encounter_date,
            // Print what is currently on screen, not the last-saved snapshot.
            chief_complaint: chiefComplaint || null,
            history:         history        || null,
            examination:     examination    || null,
            notes:           notes          || null,
            vitals: hasAnyVital(vitals)
              ? {
                  temperature_c: numOrNull(vitals.temperatureC),
                  bp_systolic:   numOrNull(vitals.bpSystolic),
                  bp_diastolic:  numOrNull(vitals.bpDiastolic),
                  pulse:         numOrNull(vitals.pulse),
                  resp_rate:     numOrNull(vitals.respRate),
                  spo2:          numOrNull(vitals.spo2),
                  weight_kg:     numOrNull(vitals.weightKg),
                  height_cm:     numOrNull(vitals.heightCm),
                }
              : null,
            diagnoses: diagnoses
              .filter((d) => d.diagnosisText.trim())
              .map((d) => ({
                diagnosis_text: d.diagnosisText,
                icd_code: d.icdCode ?? null,
                is_primary: d.isPrimary,
              })),
            prescription: items.some((it) => it.medicineName.trim())
              ? {
                  notes: rxNotes || null,
                  items: items
                    .filter((it) => it.medicineName.trim())
                    .map((it) => ({
                      medicine_name: it.medicineName,
                      dosage:        it.dosage,
                      frequency:     it.frequency,
                      duration:      it.duration,
                      route:         it.route,
                      instructions:  it.instructions,
                    })),
                }
              : null,
            lab_tests: labTests.map((t) => ({
              testName:   t.testName,
              sampleType: t.sampleType,
            })),
          }}
        />
      </PrintPreviewModal>
    </>
  );
}

function hasAnyVital(v: VitalsData): boolean {
  return Object.values(v).some((x) => x != null && String(x).trim() !== '');
}

function numOrNull(v: string | null | undefined): number | null {
  if (v == null || String(v).trim() === '') return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}
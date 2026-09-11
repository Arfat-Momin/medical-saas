import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, Save, Trash2, Activity, FileText, Stethoscope, Pill, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Alert } from '@/components/ui/Alert';
import { Spinner } from '@/components/ui/Spinner';
import { useEncounter, useSaveEncounter } from '@/hooks/useEncounter';
import { formatQueueToken } from '@medical/shared';

interface VitalForm {
  temperatureC: string; bpSystolic: string; bpDiastolic: string;
  pulse: string; respRate: string; spo2: string;
  weightKg: string; heightCm: string;
}

interface DiagForm { diagnosisText: string; icdCode: string; notes: string; isPrimary: boolean }
interface ItemForm { medicineName: string; dosage: string; frequency: string; duration: string; route: string; instructions: string; quantity: string }

const emptyVitals: VitalForm = {
  temperatureC: '', bpSystolic: '', bpDiastolic: '', pulse: '', respRate: '', spo2: '', weightKg: '', heightCm: '',
};

export function ConsultationPage() {
  const { encounterId } = useParams<{ encounterId: string }>();
  const navigate = useNavigate();
  const enc = useEncounter(encounterId);
  const save = useSaveEncounter(encounterId ?? '');

  const [chiefComplaint, setChiefComplaint] = useState('');
  const [history, setHistory] = useState('');
  const [examination, setExamination] = useState('');
  const [notes, setNotes] = useState('');
  const [vitals, setVitals] = useState<VitalForm>(emptyVitals);
  const [diagnoses, setDiagnoses] = useState<DiagForm[]>([{ diagnosisText: '', icdCode: '', notes: '', isPrimary: true }]);
  const [items, setItems] = useState<ItemForm[]>([{ medicineName: '', dosage: '', frequency: '', duration: '', route: 'Oral', instructions: '', quantity: '' }]);
  const [rxNotes, setRxNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Hydrate once encounter loads
  useEffect(() => {
    if (!enc.data) return;
    const e = enc.data;
    setChiefComplaint(e.chief_complaint ?? '');
    setHistory(e.history ?? '');
    setExamination(e.examination ?? '');
    setNotes(e.notes ?? '');

    if (e.vitals) {
      setVitals({
        temperatureC: e.vitals.temperature_c?.toString() ?? '',
        bpSystolic:   e.vitals.bp_systolic?.toString()   ?? '',
        bpDiastolic:  e.vitals.bp_diastolic?.toString()  ?? '',
        pulse:        e.vitals.pulse?.toString()         ?? '',
        respRate:     e.vitals.resp_rate?.toString()     ?? '',
        spo2:         e.vitals.spo2?.toString()          ?? '',
        weightKg:     e.vitals.weight_kg?.toString()     ?? '',
        heightCm:     e.vitals.height_cm?.toString()     ?? '',
      });
    }
    if (e.diagnoses?.length) {
      setDiagnoses(e.diagnoses.map((d) => ({
        diagnosisText: d.diagnosis_text,
        icdCode: d.icd_code ?? '',
        notes: d.notes ?? '',
        isPrimary: d.is_primary,
      })));
    }
    if (e.prescription?.items?.length) {
      setItems(e.prescription.items.map((it) => ({
        medicineName: it.medicine_name,
        dosage: it.dosage ?? '',
        frequency: it.frequency ?? '',
        duration: it.duration ?? '',
        route: it.route ?? 'Oral',
        instructions: it.instructions ?? '',
        quantity: it.quantity?.toString() ?? '',
      })));
      setRxNotes(e.prescription.notes ?? '');
    }
  }, [enc.data]);

  if (enc.isLoading) return <div className="flex justify-center py-20"><Spinner size={32} /></div>;
  if (enc.isError || !enc.data) return <Alert tone="error">Failed to load encounter.</Alert>;

  const e = enc.data;
  const isCompleted = e.status === 'COMPLETED';

  // Auto-calc BMI
  useEffect(() => {
    const w = parseFloat(vitals.weightKg);
    const h = parseFloat(vitals.heightCm);
    if (w > 0 && h > 0) {
      const bmi = (w / Math.pow(h / 100, 2)).toFixed(1);
      // Only set if different to avoid loops
      const el = document.getElementById('bmi-display');
      if (el) el.textContent = bmi;
    }
  }, [vitals.weightKg, vitals.heightCm]);

  async function onSave(complete: boolean) {
    setError(null);
    setSaved(false);
    try {
      await save.mutateAsync({
        chiefComplaint: chiefComplaint || null,
        history: history || null,
        examination: examination || null,
        notes: notes || null,
        vitals: {
          temperatureC: vitals.temperatureC || null,
          bpSystolic:   vitals.bpSystolic   || null,
          bpDiastolic:  vitals.bpDiastolic  || null,
          pulse:        vitals.pulse        || null,
          respRate:     vitals.respRate     || null,
          spo2:         vitals.spo2         || null,
          weightKg:     vitals.weightKg     || null,
          heightCm:     vitals.heightCm     || null,
        },
        diagnoses: diagnoses.filter((d) => d.diagnosisText.trim()).map((d, i) => ({
          diagnosisText: d.diagnosisText,
          icdCode: d.icdCode || null,
          notes: d.notes || null,
          isPrimary: d.isPrimary || i === 0,
        })),
        prescription: {
          notes: rxNotes || null,
          items: items.filter((it) => it.medicineName.trim()).map((it) => ({
            medicineName: it.medicineName,
            dosage: it.dosage || null,
            frequency: it.frequency || null,
            duration: it.duration || null,
            route: it.route || null,
            instructions: it.instructions || null,
            quantity: it.quantity || null,
          })),
        },
        complete,
      });
      setSaved(true);
      if (complete) {
        setTimeout(() => navigate('/appointments'), 900);
      } else {
        setTimeout(() => setSaved(false), 2500);
      }
    } catch (err: any) {
      setError(err?.message ?? 'Save failed');
    }
  }

  return (
    <>
      {/* Patient header */}
      <Card className="mb-6">
        <CardBody className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-600">
              <Stethoscope size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-slate-900">{e.patients.full_name}</h2>
                {e.appointments?.queue_token && (
                  <Badge tone="purple">{formatQueueToken(e.appointments.queue_token)}</Badge>
                )}
                <Badge tone={isCompleted ? 'green' : 'yellow'}>{e.status}</Badge>
              </div>
              <p className="text-sm text-slate-500">
                <span className="font-mono text-brand-700">{e.patients.uhid}</span>
                {e.patients.date_of_birth && ` | ${age(e.patients.date_of_birth)}y`}
                {e.patients.gender && ` | ${e.patients.gender.charAt(0)}`}
                {e.patients.blood_group && ` | ${e.patients.blood_group}`}
              </p>
            </div>
          </div>
          <div className="text-right text-sm text-slate-500">
            <p>{new Date(e.encounter_date).toLocaleDateString()}</p>
            <p>{e.branches?.name}</p>
          </div>
        </CardBody>
      </Card>

      {e.patients.allergies && (
        <div className="mb-4">
          <Alert tone="error">
            <strong>Allergies:</strong> {e.patients.allergies}
          </Alert>
        </div>
      )}
      {e.patients.medical_history && (
        <div className="mb-4">
          <Alert tone="info">
            <strong>Medical history:</strong> {e.patients.medical_history}
          </Alert>
        </div>
      )}

      {error && <div className="mb-4"><Alert tone="error">{error}</Alert></div>}
      {saved && <div className="mb-4"><Alert tone="success">Saved.</Alert></div>}

      <fieldset disabled={isCompleted} className="space-y-6">

        {/* Chief complaint + Symptoms */}
        <Card>
          <CardHeader title="Symptoms & Complaint" subtitle="Chief complaint, history and examination" />
          <CardBody className="space-y-4">
            <Input label="Chief complaint" value={chiefComplaint} onChange={(ev) => setChiefComplaint(ev.target.value)} placeholder="Fever, cough since 3 days" />
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Input label="History" value={history} onChange={(ev) => setHistory(ev.target.value)} placeholder="Past history, medications..." />
              <Input label="Examination" value={examination} onChange={(ev) => setExamination(ev.target.value)} placeholder="General exam findings..." />
            </div>
          </CardBody>
        </Card>

        {/* Vitals */}
        <Card>
          <CardHeader
            title="Vital Signs"
            subtitle="Recorded at time of consultation"
            action={<Activity size={16} className="text-slate-400" />}
          />
          <CardBody>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <Input label="Temp (C)"      value={vitals.temperatureC} onChange={(ev) => setVitals({ ...vitals, temperatureC: ev.target.value })} />
              <Input label="Pulse (bpm)"    value={vitals.pulse}        onChange={(ev) => setVitals({ ...vitals, pulse: ev.target.value })} />
              <Input label="BP systolic"    value={vitals.bpSystolic}   onChange={(ev) => setVitals({ ...vitals, bpSystolic: ev.target.value })} />
              <Input label="BP diastolic"   value={vitals.bpDiastolic}  onChange={(ev) => setVitals({ ...vitals, bpDiastolic: ev.target.value })} />
              <Input label="Resp rate"      value={vitals.respRate}     onChange={(ev) => setVitals({ ...vitals, respRate: ev.target.value })} />
              <Input label="SpO (%)"       value={vitals.spo2}         onChange={(ev) => setVitals({ ...vitals, spo2: ev.target.value })} />
              <Input label="Weight (kg)"    value={vitals.weightKg}     onChange={(ev) => setVitals({ ...vitals, weightKg: ev.target.value })} />
              <Input label="Height (cm)"    value={vitals.heightCm}     onChange={(ev) => setVitals({ ...vitals, heightCm: ev.target.value })} />
            </div>
            <div className="mt-3 text-xs text-slate-500">
              BMI: <span id="bmi-display" className="font-mono text-slate-700">-</span>
            </div>
          </CardBody>
        </Card>

        {/* Diagnoses */}
        <Card>
          <CardHeader
            title="Diagnosis"
            subtitle="Primary and secondary diagnoses"
            action={<Button size="sm" variant="secondary" onClick={() => setDiagnoses([...diagnoses, { diagnosisText: '', icdCode: '', notes: '', isPrimary: false }])}>
              <Plus size={14} /> Add
            </Button>}
          />
          <CardBody className="space-y-3">
            {diagnoses.map((d, i) => (
              <div key={i} className="grid grid-cols-1 gap-3 rounded-md border border-slate-200 p-3 md:grid-cols-12">
                <div className="md:col-span-5">
                  <Input label="Diagnosis" value={d.diagnosisText} onChange={(ev) => updateDiagnosis(i, { diagnosisText: ev.target.value })} placeholder="Acute viral pharyngitis" />
                </div>
                <div className="md:col-span-2">
                  <Input label="ICD code" value={d.icdCode} onChange={(ev) => updateDiagnosis(i, { icdCode: ev.target.value })} placeholder="J02.9" />
                </div>
                <div className="md:col-span-3">
                  <Input label="Notes" value={d.notes} onChange={(ev) => updateDiagnosis(i, { notes: ev.target.value })} />
                </div>
                <div className="flex items-end gap-2 md:col-span-2">
                  <label className="flex items-center gap-1 text-xs text-slate-600">
                    <input type="radio" checked={d.isPrimary} onChange={() => setDiagnoses(diagnoses.map((x, j) => ({ ...x, isPrimary: i === j })))} />
                    Primary
                  </label>
                  {diagnoses.length > 1 && (
                    <button onClick={() => setDiagnoses(diagnoses.filter((_, j) => j !== i))} className="text-slate-400 hover:text-red-500">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </CardBody>
        </Card>

        {/* Prescription */}
        <Card>
          <CardHeader
            title="Prescription"
            subtitle="Medicines, dosage and instructions"
            action={
              <div className="flex items-center gap-2">
                <Pill size={16} className="text-slate-400" />
                <Button size="sm" variant="secondary" onClick={() => setItems([...items, { medicineName: '', dosage: '', frequency: '', duration: '', route: 'Oral', instructions: '', quantity: '' }])}>
                  <Plus size={14} /> Add medicine
                </Button>
              </div>
            }
          />
          <CardBody className="space-y-3">
            {items.map((it, i) => (
              <div key={i} className="grid grid-cols-2 gap-3 rounded-md border border-slate-200 p-3 md:grid-cols-12">
                <div className="md:col-span-3"><Input label="Medicine" value={it.medicineName} onChange={(ev) => updateItem(i, { medicineName: ev.target.value })} placeholder="Paracetamol 500mg" /></div>
                <div className="md:col-span-1"><Input label="Dose" value={it.dosage} onChange={(ev) => updateItem(i, { dosage: ev.target.value })} placeholder="1 tab" /></div>
                <div className="md:col-span-2"><Input label="Frequency" value={it.frequency} onChange={(ev) => updateItem(i, { frequency: ev.target.value })} placeholder="1-0-1" /></div>
                <div className="md:col-span-2"><Input label="Duration" value={it.duration} onChange={(ev) => updateItem(i, { duration: ev.target.value })} placeholder="5 days" /></div>
                <div className="md:col-span-1">
                  <Select label="Route" value={it.route} onChange={(ev) => updateItem(i, { route: ev.target.value })}>
                    <option>Oral</option><option>IV</option><option>IM</option><option>Topical</option><option>Inhalation</option>
                  </Select>
                </div>
                <div className="md:col-span-1"><Input label="Qty" value={it.quantity} onChange={(ev) => updateItem(i, { quantity: ev.target.value })} placeholder="10" /></div>
                <div className="md:col-span-1 flex items-end">
                  {items.length > 1 && (
                    <button onClick={() => setItems(items.filter((_, j) => j !== i))} className="text-slate-400 hover:text-red-500">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
                <div className="md:col-span-12">
                  <Input label="Instructions" value={it.instructions} onChange={(ev) => updateItem(i, { instructions: ev.target.value })} placeholder="After food" />
                </div>
              </div>
            ))}
            <Input label="Prescription notes" value={rxNotes} onChange={(ev) => setRxNotes(ev.target.value)} placeholder="Any additional instructions" />
          </CardBody>
        </Card>

        {/* Notes */}
        <Card>
          <CardHeader title="Notes" subtitle="Internal clinical notes" action={<FileText size={16} className="text-slate-400" />} />
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
        <Button variant="secondary" onClick={() => navigate('/appointments')}>Back</Button>
        {!isCompleted && (
          <>
            <Button variant="secondary" onClick={() => onSave(false)} loading={save.isPending}>
              <Save size={14} /> Save draft
            </Button>
            <Button onClick={() => onSave(true)} loading={save.isPending}>
              <CheckCircle2 size={14} /> Complete consultation
            </Button>
          </>
        )}
        {isCompleted && (
          <Badge tone="green" className="px-3 py-1.5 text-sm">
            <CheckCircle2 size={14} className="mr-1 inline" /> Consultation completed
          </Badge>
        )}
      </div>
    </>
  );

  function updateDiagnosis(i: number, patch: Partial<DiagForm>) {
    setDiagnoses(diagnoses.map((d, j) => (j === i ? { ...d, ...patch } : d)));
  }
  function updateItem(i: number, patch: Partial<ItemForm>) {
    setItems(items.map((it, j) => (j === i ? { ...it, ...patch } : it)));
  }
}

function age(dob: string): number {
  return Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
}
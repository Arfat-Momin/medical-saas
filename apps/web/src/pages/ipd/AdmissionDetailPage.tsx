import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, BedDouble, Check, ClipboardList, FileText, Pill, Stethoscope, UserCog } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { PageHeader } from '@/components/ui/PageHeader';
import { Alert } from '@/components/ui/Alert';
import { Spinner } from '@/components/ui/Spinner';
import {
  useAdmission, useTransferBed, useDischarge,
  useAddNursingNote, useAddDoctorRound, useAddMar, useMarkMar, useBeds,
} from '@/hooks/useIpd';
import { usePermissions } from '@/hooks/useAuth';
import { PERMISSIONS } from '@medical/shared';

const statusTone: Record<string, BadgeTone> = {
  ADMITTED: 'green', TRANSFERRED: 'yellow', DISCHARGED: 'gray', CANCELLED: 'gray',
};
const marTone: Record<string, BadgeTone> = {
  SCHEDULED: 'blue', ADMINISTERED: 'green', HELD: 'yellow', REFUSED: 'red', MISSED: 'red',
};

type Tab = 'overview' | 'notes' | 'rounds' | 'mar' | 'transfers';

export function AdmissionDetailPage() {
  const { admissionId } = useParams<{ admissionId: string }>();
  const adm = useAdmission(admissionId);
  const beds = useBeds();
  const { can } = usePermissions();

  const transfer = useTransferBed(admissionId ?? '');
  const discharge = useDischarge(admissionId ?? '');
  const addNote = useAddNursingNote(admissionId ?? '');
  const addRound = useAddDoctorRound(admissionId ?? '');
  const addMar = useAddMar(admissionId ?? '');
  const markMar = useMarkMar(admissionId ?? '');

  const [tab, setTab] = useState<Tab>('overview');
  const [error, setError] = useState<string | null>(null);

  // Transfer
  const [transferOpen, setTransferOpen] = useState(false);
  const [toBedId, setToBedId] = useState('');
  const [transferReason, setTransferReason] = useState('');

  // Discharge
  const [dischargeOpen, setDischargeOpen] = useState(false);
  const [dischargeType, setDischargeType] = useState('NORMAL');
  const [dischargeSummary, setDischargeSummary] = useState('');

  // Note / Round / MAR forms
  const [noteType, setNoteType] = useState('GENERAL');
  const [note, setNote] = useState('');
  const [roundNotes, setRoundNotes] = useState('');
  const [roundAssessment, setRoundAssessment] = useState('');
  const [roundPlan, setRoundPlan] = useState('');
  const [marName, setMarName] = useState('');
  const [marDose, setMarDose] = useState('');
  const [marRoute, setMarRoute] = useState('Oral');
  const [marTime, setMarTime] = useState('');

  if (adm.isLoading) return <div className="flex justify-center py-20"><Spinner size={32} /></div>;
  if (adm.isError || !adm.data) return <Alert tone="error">Failed to load admission.</Alert>;

  const a = adm.data;
  const canManage = can(PERMISSIONS.IPD_MANAGE);
  const canMar = can(PERMISSIONS.MAR_WRITE);
  const isActive = a.status === 'ADMITTED';
  const availableBeds = (beds.data ?? []).filter((b) => b.bed_status === 'AVAILABLE' && b.bed_id !== a.bed_id);

  async function onTransfer() {
    setError(null);
    if (!toBedId) { setError('Select a bed'); return; }
    try {
      await transfer.mutateAsync({ toBedId, reason: transferReason || 'Transfer' });
      setTransferOpen(false); setToBedId(''); setTransferReason('');
    } catch (e: any) { setError(e?.message ?? 'Transfer failed'); }
  }

  async function onDischarge() {
    setError(null);
    try {
      await discharge.mutateAsync({ dischargeType, dischargeSummary: dischargeSummary || null });
      setDischargeOpen(false);
    } catch (e: any) { setError(e?.message ?? 'Discharge failed'); }
  }

  async function onAddNote() {
    if (!note.trim()) return;
    await addNote.mutateAsync({ noteType, note });
    setNote('');
  }

  async function onAddRound() {
    await addRound.mutateAsync({
      clinicalNotes: roundNotes || null,
      assessment: roundAssessment || null,
      plan: roundPlan || null,
    });
    setRoundNotes(''); setRoundAssessment(''); setRoundPlan('');
  }

  async function onAddMar() {
    if (!marName.trim() || !marTime) return;
    await addMar.mutateAsync({
      medicationName: marName,
      dose: marDose || null,
      route: marRoute || null,
      scheduledAt: new Date(marTime).toISOString(),
    });
    setMarName(''); setMarDose(''); setMarTime('');
  }

  return (
    <>
      <div className="mb-4">
        <Link to="/ipd/admissions" className="inline-flex items-center gap-1 text-sm text-brand-600 hover:underline">
          <ArrowLeft size={14} /> Back to admissions
        </Link>
      </div>

      <PageHeader
        title={a.patients?.full_name ?? 'Admission'}
        subtitle={`${a.patients?.uhid} - Admitted ${new Date(a.admitted_at).toLocaleString()}`}
        action={
          <div className="flex items-center gap-2">
            <Badge tone={statusTone[a.status] ?? 'gray'} className="px-3 py-1.5 text-sm">{a.status}</Badge>
            {isActive && canManage && (
              <>
                <Button variant="secondary" size="sm" onClick={() => setTransferOpen(true)}>
                  <BedDouble size={14} /> Transfer
                </Button>
                <Button variant="danger" size="sm" onClick={() => setDischargeOpen(true)}>
                  Discharge
                </Button>
              </>
            )}
          </div>
        }
      />

      {error && <div className="mb-4"><Alert tone="error">{error}</Alert></div>}

      {/* Summary card */}
      <Card className="mb-6">
        <CardBody className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <Info label="Patient" value={a.patients?.full_name} sub={a.patients?.uhid} />
          <Info label="Bed" value={a.bed?.name} sub={a.bed?.code ?? undefined} />
          <Info label="Admitting doctor" value={a.doctors?.full_name} />
          <Info label="Expected discharge" value={a.expected_discharge ?? '-'} />
        </CardBody>
      </Card>

      {/* Tabs */}
      <div className="mb-4 border-b border-slate-200">
        <nav className="-mb-px flex gap-6">
          {([
            ['overview', 'Overview', FileText],
            ['notes', 'Nursing notes', ClipboardList],
            ['rounds', 'Doctor rounds', Stethoscope],
            ['mar', 'MAR', Pill],
            ['transfers', 'Transfers', UserCog],
          ] as [Tab, string, any][]).map(([key, label, Icon]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex items-center gap-2 border-b-2 px-1 py-3 text-sm font-medium transition-colors ${
                tab === key ? 'border-brand-500 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <Icon size={14} /> {label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab: Overview */}
      {tab === 'overview' && (
        <Card>
          <CardBody className="space-y-4">
            <Field label="Reason for admission" value={a.reason} />
            <Field label="Provisional diagnosis" value={a.diagnosis} />
            {a.discharge_summary && (
              <div className="rounded-md bg-green-50 p-3">
                <div className="mb-1 text-xs font-semibold uppercase text-green-700">
                  Discharged ({a.discharge_type}) - {a.discharged_at && new Date(a.discharged_at).toLocaleString()}
                </div>
                <p className="text-sm text-green-900 whitespace-pre-wrap">{a.discharge_summary}</p>
              </div>
            )}
          </CardBody>
        </Card>
      )}

      {/* Tab: Notes */}
      {tab === 'notes' && (
        <div className="space-y-4">
          {isActive && canManage && (
            <Card>
              <CardHeader title="Add nursing note" />
              <CardBody className="space-y-3">
                <Select label="Type" value={noteType} onChange={(e) => setNoteType(e.target.value)}>
                  <option value="GENERAL">General</option>
                  <option value="VITALS">Vitals</option>
                  <option value="MEDICATION">Medication</option>
                  <option value="OBSERVATION">Observation</option>
                  <option value="INCIDENT">Incident</option>
                  <option value="HANDOVER">Handover</option>
                </Select>
                <textarea
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  rows={3}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Patient observations, vitals, interventions..."
                />
                <div className="flex justify-end">
                  <Button onClick={onAddNote} loading={addNote.isPending} disabled={!note.trim()}>Add note</Button>
                </div>
              </CardBody>
            </Card>
          )}

          <Card>
            <CardHeader title="Note history" subtitle={`${a.nursing_notes.length} note(s)`} />
            <CardBody>
              {a.nursing_notes.length === 0 && <p className="text-sm text-slate-500">No notes yet.</p>}
              <ul className="space-y-3">
                {a.nursing_notes.map((n) => (
                  <li key={n.id} className="border-l-2 border-brand-200 pl-3">
                    <div className="flex items-center gap-2">
                      <Badge tone="blue">{n.note_type}</Badge>
                      <span className="text-xs text-slate-500">{new Date(n.recorded_at).toLocaleString()}</span>
                      {n.by?.full_name && <span className="text-xs text-slate-500">- {n.by.full_name}</span>}
                    </div>
                    <p className="mt-1 text-sm text-slate-700 whitespace-pre-wrap">{n.note}</p>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        </div>
      )}

      {/* Tab: Rounds */}
      {tab === 'rounds' && (
        <div className="space-y-4">
          {isActive && canManage && (
            <Card>
              <CardHeader title="Add doctor round" />
              <CardBody className="space-y-3">
                <textarea className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  rows={2} value={roundNotes} onChange={(e) => setRoundNotes(e.target.value)}
                  placeholder="Clinical notes (subjective, objective)" />
                <Input label="Assessment" value={roundAssessment} onChange={(e) => setRoundAssessment(e.target.value)} />
                <Input label="Plan" value={roundPlan} onChange={(e) => setRoundPlan(e.target.value)} />
                <div className="flex justify-end">
                  <Button onClick={onAddRound} loading={addRound.isPending}>Save round</Button>
                </div>
              </CardBody>
            </Card>
          )}

          <Card>
            <CardHeader title="Round history" subtitle={`${a.rounds.length} round(s)`} />
            <CardBody>
              {a.rounds.length === 0 && <p className="text-sm text-slate-500">No rounds yet.</p>}
              <ul className="space-y-4">
                {a.rounds.map((r) => (
                  <li key={r.id} className="border-l-2 border-purple-200 pl-3">
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span>{new Date(r.round_at).toLocaleString()}</span>
                      {r.doctor?.full_name && <span>- {r.doctor.full_name}</span>}
                    </div>
                    {r.clinical_notes && <p className="mt-1 text-sm"><strong>Notes:</strong> {r.clinical_notes}</p>}
                    {r.assessment && <p className="text-sm"><strong>Assessment:</strong> {r.assessment}</p>}
                    {r.plan && <p className="text-sm"><strong>Plan:</strong> {r.plan}</p>}
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        </div>
      )}

      {/* Tab: MAR */}
      {tab === 'mar' && (
        <div className="space-y-4">
          {isActive && canMar && (
            <Card>
              <CardHeader title="Add medication" />
              <CardBody className="grid grid-cols-1 gap-3 md:grid-cols-4">
                <div className="md:col-span-2"><Input label="Medication" value={marName} onChange={(e) => setMarName(e.target.value)} placeholder="Paracetamol 500mg" /></div>
                <Input label="Dose" value={marDose} onChange={(e) => setMarDose(e.target.value)} placeholder="1 tab" />
                <Select label="Route" value={marRoute} onChange={(e) => setMarRoute(e.target.value)}>
                  <option>Oral</option><option>IV</option><option>IM</option><option>Topical</option><option>Inhalation</option>
                </Select>
                <Input label="Scheduled at" type="datetime-local" value={marTime} onChange={(e) => setMarTime(e.target.value)} />
                <div className="flex items-end md:col-span-3 md:justify-end">
                  <Button onClick={onAddMar} loading={addMar.isPending} disabled={!marName.trim() || !marTime}>Schedule</Button>
                </div>
              </CardBody>
            </Card>
          )}

          <Card>
            <CardHeader title="Medication schedule" subtitle={`${a.mar.length} record(s)`} />
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-3">Medication</th>
                    <th className="px-5 py-3">Dose / Route</th>
                    <th className="px-5 py-3">Scheduled</th>
                    <th className="px-5 py-3">Administered</th>
                    <th className="px-5 py-3">Status</th>
                    {isActive && canMar && <th className="px-5 py-3 text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {a.mar.length === 0 && (
                    <tr><td colSpan={6} className="px-5 py-6 text-center text-slate-400">No medication scheduled.</td></tr>
                  )}
                  {a.mar.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-50">
                      <td className="px-5 py-3 font-medium text-slate-900">{m.medication_name}</td>
                      <td className="px-5 py-3 text-slate-600">{[m.dose, m.route].filter(Boolean).join(' / ') || '-'}</td>
                      <td className="px-5 py-3 text-slate-600 text-xs">{new Date(m.scheduled_at).toLocaleString()}</td>
                      <td className="px-5 py-3 text-slate-600 text-xs">
                        {m.administered_at ? new Date(m.administered_at).toLocaleString() : '-'}
                        {m.by?.full_name && <div className="text-xs text-slate-400">{m.by.full_name}</div>}
                      </td>
                      <td className="px-5 py-3"><Badge tone={marTone[m.status] ?? 'gray'}>{m.status}</Badge></td>
                      {isActive && canMar && (
                        <td className="px-5 py-3 text-right">
                          {m.status === 'SCHEDULED' && (
                            <div className="flex justify-end gap-1">
                              <button onClick={() => markMar.mutate({ marId: m.id, status: 'ADMINISTERED' })}
                                className="rounded p-1.5 text-green-600 hover:bg-green-50" title="Mark given">
                                <Check size={14} />
                              </button>
                              <button onClick={() => markMar.mutate({ marId: m.id, status: 'HELD' })}
                                className="rounded px-2 py-1 text-xs text-amber-600 hover:bg-amber-50">Hold</button>
                              <button onClick={() => markMar.mutate({ marId: m.id, status: 'REFUSED' })}
                                className="rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50">Refused</button>
                            </div>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* Tab: Transfers */}
      {tab === 'transfers' && (
        <Card>
          <CardHeader title="Bed transfer history" subtitle={`${a.transfers.length} transfer(s)`} />
          <CardBody>
            {a.transfers.length === 0 && <p className="text-sm text-slate-500">No transfers.</p>}
            <ul className="space-y-3">
              {a.transfers.map((t) => (
                <li key={t.id} className="flex items-start gap-3 border-l-2 border-slate-200 pl-3">
                  <div className="flex-1">
                    <div className="text-sm">
                      <span className="font-medium">{t.from_bed?.name ?? 'Initial'}</span>
                      <span className="mx-2 text-slate-400">-&gt;</span>
                      <span className="font-medium">{t.to_bed?.name}</span>
                    </div>
                    <p className="text-xs text-slate-500">{t.reason}</p>
                    <p className="text-xs text-slate-400">
                      {new Date(t.transferred_at).toLocaleString()}
                      {t.by?.full_name && <> - {t.by.full_name}</>}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}

      {/* Transfer modal */}
      <Modal open={transferOpen} onClose={() => setTransferOpen(false)} title="Transfer bed"
        footer={<><Button variant="secondary" onClick={() => setTransferOpen(false)}>Cancel</Button>
          <Button onClick={onTransfer} loading={transfer.isPending}>Transfer</Button></>}>
        <div className="space-y-4">
          <Select label="New bed *" value={toBedId} onChange={(e) => setToBedId(e.target.value)}>
            <option value="">- {availableBeds.length} bed(s) available -</option>
            {availableBeds.map((b) => (
              <option key={b.bed_id} value={b.bed_id}>
                {b.ward_name ?? '-'} / {b.room_name ?? '-'} / {b.bed_name}
              </option>
            ))}
          </Select>
          <Input label="Reason" value={transferReason} onChange={(e) => setTransferReason(e.target.value)}
            placeholder="Patient request / clinical need" />
        </div>
      </Modal>

      {/* Discharge modal */}
      <Modal open={dischargeOpen} onClose={() => setDischargeOpen(false)} title="Discharge patient"
        footer={<><Button variant="secondary" onClick={() => setDischargeOpen(false)}>Cancel</Button>
          <Button onClick={onDischarge} loading={discharge.isPending} variant="danger">Confirm discharge</Button></>}>
        <div className="space-y-4">
          <Select label="Discharge type *" value={dischargeType} onChange={(e) => setDischargeType(e.target.value)}>
            <option value="NORMAL">Normal</option>
            <option value="AGAINST_ADVICE">Against medical advice</option>
            <option value="TRANSFER">Transfer to another facility</option>
            <option value="DEATH">Death</option>
            <option value="ABSCONDED">Absconded</option>
          </Select>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Discharge summary</label>
            <textarea
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              rows={4} value={dischargeSummary}
              onChange={(e) => setDischargeSummary(e.target.value)}
              placeholder="Treatment given, condition at discharge, follow-up advice..."
            />
          </div>
        </div>
      </Modal>
    </>
  );
}

function Info({ label, value, sub }: { label: string; value?: string | null; sub?: string | null }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-slate-900">{value ?? '-'}</p>
      {sub && <p className="font-mono text-xs text-slate-500">{sub}</p>}
    </div>
  );
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-sm text-slate-700 whitespace-pre-wrap">{value ?? '-'}</p>
    </div>
  );
}

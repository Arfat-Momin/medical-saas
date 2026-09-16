import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, Plus, Printer, Save, ShieldAlert, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Alert } from '@/components/ui/Alert';
import { Spinner } from '@/components/ui/Spinner';
import { MedicinePicker } from '@/components/MedicinePicker';
import { useAdminEncounter, useAdminEditPrescription } from '@/hooks/useEncounter';
import { useAuthStore } from '@/stores/auth.store';
import type { PrescriptionItemData } from '@/db/schema';

const FREQUENCIES = [
  { value: '1-0-0',     label: '1-0-0 (Morning)' },
  { value: '0-1-0',     label: '0-1-0 (Afternoon)' },
  { value: '0-0-1',     label: '0-0-1 (Night)' },
  { value: '1-0-1',     label: '1-0-1 (Morning + Night)' },
  { value: '1-1-1',     label: '1-1-1 (Three times)' },
  { value: '1-1-1-1',   label: '1-1-1-1 (Four times)' },
  { value: 'SOS',       label: 'SOS (As needed)' },
  { value: 'STAT',      label: 'STAT (Immediately)' },
  { value: 'Weekly',    label: 'Weekly' },
  { value: 'Alternate', label: 'Alternate days' },
];

const emptyItem = (): PrescriptionItemData => ({
  medicineName: '',
  dosage: null,
  frequency: null,
  duration: null,
  route: 'Oral',
  instructions: null,
  quantity: null,
});

export function EditPrescriptionPage() {
  const { encounterServerId } = useParams<{ encounterServerId: string }>();
  const navigate = useNavigate();
  const roles = useAuthStore((s) => s.roles);
  const isHospitalAdmin = roles.includes('HOSPITAL_ADMIN');

  const enc = useAdminEncounter(encounterServerId);
  const save = useAdminEditPrescription(encounterServerId ?? '');

  const [items, setItems] = useState<PrescriptionItemData[]>([emptyItem()]);
  const [rxNotes, setRxNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [loadedServerId, setLoadedServerId] = useState<string | null>(null);

  // Hydrate form once per encounter.
  useEffect(() => {
    if (!enc.data) return;
    if (loadedServerId === enc.data.id) return;
    setLoadedServerId(enc.data.id);

    const rx = (enc.data as any).prescription;
    if (rx?.items && rx.items.length > 0) {
      setItems(
        rx.items.map((it: any) => ({
          medicineName: it.medicine_name ?? '',
          dosage:       it.dosage ?? null,
          frequency:    it.frequency ?? null,
          duration:     it.duration ?? null,
          route:        it.route ?? 'Oral',
          instructions: it.instructions ?? null,
          quantity:     it.quantity != null ? String(it.quantity) : null,
        })),
      );
    } else {
      setItems([emptyItem()]);
    }
    setRxNotes(rx?.notes ?? '');
  }, [enc.data, loadedServerId]);

  // Auto-clear the "saved" banner.
  useEffect(() => {
    if (!saved) return;
    const t = setTimeout(() => setSaved(false), 3000);
    return () => clearTimeout(t);
  }, [saved]);

  function updateItem(i: number, patch: Partial<PrescriptionItemData>) {
    setItems((arr) => arr.map((it, j) => (j === i ? { ...it, ...patch } : it)));
  }

  async function onSave() {
    setError(null);
    const cleanItems = items
      .filter((it) => it.medicineName.trim())
      .map((it) => ({
        medicineName: it.medicineName,
        dosage:       it.dosage,
        frequency:    it.frequency,
        duration:     it.duration,
        route:        it.route,
        instructions: it.instructions,
        quantity:     it.quantity,
      }));

    try {
      await save.mutateAsync({
        prescription: cleanItems.length > 0
          ? { notes: rxNotes || null, items: cleanItems }
          : null,
      });
      setSaved(true);
    } catch (e: any) {
      setError(e?.message ?? 'Save failed');
    }
  }

  // ---- Gates ----

  if (!isHospitalAdmin) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="mb-4">
          <Link to="/" className="inline-flex items-center gap-1 text-sm text-brand-600 hover:underline">
            <ArrowLeft size={14} /> Back
          </Link>
        </div>
        <Alert tone="error">
          <div className="flex items-start gap-2">
            <ShieldAlert size={16} className="mt-0.5 shrink-0" />
            <div>
              <strong>Not allowed.</strong>
              <p className="mt-0.5 text-xs">
                Only the Hospital Admin can edit a prescription after it has been saved.
              </p>
            </div>
          </div>
        </Alert>
      </div>
    );
  }

  if (!encounterServerId) {
    return <Alert tone="error">Missing encounter reference.</Alert>;
  }

  if (enc.isLoading) {
    return <div className="flex justify-center py-20"><Spinner size={32} /></div>;
  }

  if (enc.isError || !enc.data) {
    return (
      <div className="space-y-4">
        <Alert tone="error">Failed to load encounter from the server.</Alert>
        <Button variant="secondary" onClick={() => navigate(-1)}>
          <ArrowLeft size={14} /> Back
        </Button>
      </div>
    );
  }

  const e = enc.data as any;
  const isCompleted = e.status === 'COMPLETED';

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <Link to="/patients" className="inline-flex items-center gap-1 text-sm text-brand-600 hover:underline">
          <ArrowLeft size={14} /> Back
        </Link>
        <Badge tone="purple">Admin edit</Badge>
      </div>

      <Card className="mb-6">
        <CardBody className="flex flex-wrap items-center gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-semibold text-slate-900">
              {e.patients?.full_name ?? 'Patient'}
            </h1>
            <p className="mt-0.5 text-sm text-slate-500">
              <span className="font-mono text-brand-700">{e.patients?.uhid ?? '-'}</span>
              {' - '}
              {e.encounter_date}
            </p>
          </div>
          <Badge tone={isCompleted ? 'green' : 'yellow'}>{e.status}</Badge>
        </CardBody>
      </Card>

      <div className="mb-4">
        <Alert tone="info">
          <div className="flex items-start gap-2">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <div>
              You are editing a {isCompleted ? 'completed' : 'draft'} consultation.
              Changes are logged with your name and a timestamp.
            </div>
          </div>
        </Alert>
      </div>

      {error && <div className="mb-4"><Alert tone="error">{error}</Alert></div>}
      {saved && <div className="mb-4"><Alert tone="success">Prescription updated.</Alert></div>}

      <Card>
        <CardHeader
          title="Prescription"
          subtitle="Edit or correct the medicines on this consultation"
        />
        <CardBody className="space-y-3">
          {items.map((it, i) => (
            <div key={i} className="rounded-md border border-slate-200 bg-slate-50/40 p-3">
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
                      onClick={() => setItems(items.filter((_, j) => j !== i))}
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

          <div className="flex justify-between">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setItems([...items, emptyItem()])}
            >
              <Plus size={14} /> Add medicine
            </Button>
          </div>

          <Input
            label="Prescription notes"
            value={rxNotes}
            onChange={(ev) => setRxNotes(ev.target.value)}
            placeholder="Any additional instructions"
          />
        </CardBody>
      </Card>

      <div className="mt-6 flex flex-wrap justify-end gap-3">
        <Button variant="secondary" onClick={() => navigate(-1)}>Cancel</Button>
        <Button onClick={onSave} loading={save.isPending}>
          <Save size={14} /> Save changes
        </Button>
      </div>
    </>
  );
}
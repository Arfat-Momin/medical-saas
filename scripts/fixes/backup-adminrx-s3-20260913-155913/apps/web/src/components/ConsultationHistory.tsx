import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Calendar, ChevronDown, ChevronUp, Stethoscope, Pill, FlaskConical, Activity, Pencil,
} from 'lucide-react';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { usePatientEncounters, useServerEncounter } from '@/hooks/usePatientEncounters';
import { useAuthStore } from '@/stores/auth.store';

interface Props {
  patientId: string;
}

export function ConsultationHistory({ patientId }: Props) {
  const encounters = usePatientEncounters(patientId);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (encounters.isLoading) {
    return (
      <Card>
        <CardHeader title="Consultation History" />
        <CardBody>
          <div className="flex justify-center py-8">
            <Spinner size={24} />
          </div>
        </CardBody>
      </Card>
    );
  }

  const rows = encounters.data?.rows ?? [];

  return (
    <Card>
      <CardHeader
        title="Consultation History"
        subtitle={`${rows.length} visit${rows.length === 1 ? '' : 's'} on record`}
      />
      <CardBody>
        {rows.length === 0 ? (
          <EmptyState
            title="No consultations yet"
            description="This patient has no consultation history."
          />
        ) : (
          <div className="space-y-3">
            {rows.map((enc: any) => (
              <EncounterRow
                key={enc.id}
                summary={enc}
                isOpen={expandedId === enc.id}
                onToggle={() => setExpandedId(expandedId === enc.id ? null : enc.id)}
              />
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  );
}

function EncounterRow({
  summary, isOpen, onToggle,
}: { summary: any; isOpen: boolean; onToggle: () => void }) {
  // Fetch full details only when expanded
  const detail = useServerEncounter(isOpen ? summary.id : undefined);
  const enc = detail.data ?? summary;
  const roles = useAuthStore((s) => s.roles);
  const isHospitalAdmin = roles.includes('HOSPITAL_ADMIN');

  const dxCount = (enc.diagnoses ?? summary.diagnoses ?? []).length;
  const rxCount = (enc.prescription?.items ?? summary.prescription?.items ?? []).length;
  const labCount = (enc.lab_tests ?? summary.lab_tests ?? []).length;

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      {/* Header row */}
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-3 py-3 text-left hover:bg-slate-50 md:px-4"
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600">
          <Stethoscope size={18} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm text-slate-700">
              {summary.encounter_date}
            </span>
            <Badge tone={summary.status === 'COMPLETED' ? 'green' : 'yellow'}>
              {summary.status}
            </Badge>
          </div>
          <p className="mt-0.5 truncate text-sm font-medium text-slate-900">
            {summary.doctors?.full_name ?? 'Unknown doctor'}
          </p>
          {summary.chief_complaint && (
            <p className="mt-0.5 truncate text-xs italic text-slate-500">
              {summary.chief_complaint}
            </p>
          )}
        </div>

        {/* Counts */}
        <div className="hidden shrink-0 items-center gap-3 text-xs text-slate-500 md:flex">
          {dxCount > 0 && (
            <span className="flex items-center gap-1">
              <Stethoscope size={12} /> {dxCount}
            </span>
          )}
          {rxCount > 0 && (
            <span className="flex items-center gap-1">
              <Pill size={12} /> {rxCount}
            </span>
          )}
          {labCount > 0 && (
            <span className="flex items-center gap-1">
              <FlaskConical size={12} /> {labCount}
            </span>
          )}
        </div>

        <div className="shrink-0 text-slate-400">
          {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </button>

      {/* Expanded content */}
      {isOpen && (
        <div className="border-t border-slate-100 bg-slate-50 px-3 py-4 md:px-4">
          {detail.isLoading && (
            <div className="flex justify-center py-4">
              <Spinner size={18} />
            </div>
          )}

          {!detail.isLoading && (
            <>
              {/* Symptoms */}
              {(enc.chief_complaint || enc.history || enc.examination) && (
                <Section title="Symptoms & Examination">
                  {enc.chief_complaint && <Row label="Chief complaint" value={enc.chief_complaint} />}
                  {enc.history && <Row label="History" value={enc.history} />}
                  {enc.examination && <Row label="Examination" value={enc.examination} />}
                </Section>
              )}

              {/* Vitals */}
              {enc.vitals && hasVitals(enc.vitals) && (
                <Section title="Vital Signs" icon={<Activity size={12} />}>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                    {enc.vitals.temperature_c != null && <Vital label="Temp" value={`${enc.vitals.temperature_c} °C`} />}
                    {enc.vitals.pulse != null && <Vital label="Pulse" value={`${enc.vitals.pulse} bpm`} />}
                    {enc.vitals.bp_systolic != null && enc.vitals.bp_diastolic != null && (
                      <Vital label="BP" value={`${enc.vitals.bp_systolic}/${enc.vitals.bp_diastolic}`} />
                    )}
                    {enc.vitals.spo2 != null && <Vital label="SpO2" value={`${enc.vitals.spo2}%`} />}
                    {enc.vitals.resp_rate != null && <Vital label="Resp" value={`${enc.vitals.resp_rate}`} />}
                    {enc.vitals.weight_kg != null && <Vital label="Weight" value={`${enc.vitals.weight_kg} kg`} />}
                    {enc.vitals.height_cm != null && <Vital label="Height" value={`${enc.vitals.height_cm} cm`} />}
                    {enc.vitals.bmi != null && <Vital label="BMI" value={`${enc.vitals.bmi}`} />}
                  </div>
                </Section>
              )}

              {/* Diagnoses */}
              {(enc.diagnoses ?? []).length > 0 && (
                <Section title="Diagnoses">
                  <ul className="space-y-1.5">
                    {enc.diagnoses.map((d: any) => (
                      <li key={d.id} className="flex items-start gap-2 text-sm">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" />
                        <span className="text-slate-800">
                          {d.diagnosis_text}
                          {d.icd_code && (
                            <span className="ml-2 font-mono text-xs text-slate-500">{d.icd_code}</span>
                          )}
                          {d.is_primary && <Badge tone="blue" className="ml-2">Primary</Badge>}
                        </span>
                      </li>
                    ))}
                  </ul>
                </Section>
              )}

              {/* Prescription */}
              {enc.prescription?.items && enc.prescription.items.length > 0 && (
                <Section title="Prescription" icon={<Pill size={12} />}>
                  <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
                    <table className="w-full text-xs">
                      <thead className="border-b border-slate-100 bg-slate-50 text-left text-slate-500">
                        <tr>
                          <th className="px-3 py-2">Medicine</th>
                          <th className="px-3 py-2">Dose</th>
                          <th className="px-3 py-2">Frequency</th>
                          <th className="px-3 py-2">Duration</th>
                          <th className="px-3 py-2">Route</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {enc.prescription.items.map((item: any) => (
                          <tr key={item.id}>
                            <td className="px-3 py-2 font-medium text-slate-800">{item.medicine_name}</td>
                            <td className="px-3 py-2 text-slate-600">{item.dosage ?? '-'}</td>
                            <td className="px-3 py-2 text-slate-600">{item.frequency ?? '-'}</td>
                            <td className="px-3 py-2 text-slate-600">{item.duration ?? '-'}</td>
                            <td className="px-3 py-2 text-slate-600">{item.route ?? '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {enc.prescription.notes && (
                    <p className="mt-2 text-xs italic text-slate-500">{enc.prescription.notes}</p>
                  )}
                </Section>
              )}

              {/* Lab tests */}
              {(enc.lab_tests ?? []).length > 0 && (
                <Section title="Lab Tests Ordered" icon={<FlaskConical size={12} />}>
                  <ul className="space-y-1">
                    {enc.lab_tests.map((t: any, i: number) => (
                      <li key={i} className="flex items-center gap-2 text-sm">
                        <FlaskConical size={12} className="shrink-0 text-brand-500" />
                        <span className="text-slate-800">{t.testName}</span>
                        {t.sampleType && (
                          <span className="text-xs text-slate-500">({t.sampleType})</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </Section>
              )}

              {/* Clinical notes */}
              {enc.notes && (
                <Section title="Clinical Notes">
                  <p className="whitespace-pre-wrap text-sm text-slate-700">{enc.notes}</p>
                </Section>
              )}

              {/* Admin-only correction entry point */}
              {isHospitalAdmin && (
                <div className="mt-4 flex justify-end border-t border-slate-200 pt-3">
                  <Link to={`/admin/prescriptions/${summary.id}/edit`}>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      <Pencil size={12} /> Edit prescription (admin)
                    </button>
                  </Link>
                </div>
              )}

              {/* Empty state if nothing in this visit */}
              {!enc.chief_complaint &&
                !enc.history &&
                !enc.examination &&
                !enc.vitals &&
                (enc.diagnoses ?? []).length === 0 &&
                (!enc.prescription?.items || enc.prescription.items.length === 0) &&
                (enc.lab_tests ?? []).length === 0 &&
                !enc.notes && (
                  <p className="py-4 text-center text-xs italic text-slate-500">
                    No clinical details were recorded for this visit.
                  </p>
                )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Section({
  title, icon, children,
}: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="mb-4 last:mb-0">
      <div className="mb-2 flex items-center gap-1.5">
        {icon}
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          {title}
        </p>
      </div>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="mb-1 text-sm">
      <span className="text-slate-500">{label}: </span>
      <span className="text-slate-800">{value}</span>
    </div>
  );
}

function Vital({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-white px-2 py-1.5 shadow-sm">
      <p className="text-[10px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className="font-mono text-sm text-slate-800">{value}</p>
    </div>
  );
}

function hasVitals(v: any): boolean {
  return v && Object.values(v).some((x) => x != null);
}

import { PrintHeader } from './PrintHeader';

interface VitalsData {
  temperature_c?: number | null; bp_systolic?: number | null; bp_diastolic?: number | null;
  pulse?: number | null; resp_rate?: number | null; spo2?: number | null;
  weight_kg?: number | null; height_cm?: number | null; bmi?: number | null;
}

interface Props {
  organization?: any;
  patient: {
    full_name: string; uhid: string;
    date_of_birth?: string | null; gender?: string | null;
    mobile?: string | null; allergies?: string | null;
  };
  doctor?: { full_name?: string | null } | null;
  encounter: {
    encounter_date: string;
    chief_complaint?: string | null;
    history?: string | null;
    examination?: string | null;
    notes?: string | null;
    vitals?: VitalsData | null;
    diagnoses: Array<{ diagnosis_text: string; icd_code?: string | null; is_primary?: boolean }>;
    prescription?: {
      notes?: string | null;
      items: Array<{
        medicine_name: string; dosage?: string | null; frequency?: string | null;
        duration?: string | null; route?: string | null; instructions?: string | null;
      }>;
    } | null;
    lab_tests?: Array<{ testName: string; sampleType?: string | null }>;
  };
}

export function PrescriptionPrint({ organization, patient, doctor, encounter }: Props) {
  const hasVitals = encounter.vitals && Object.values(encounter.vitals).some((v) => v != null);
  const rxItems = encounter.prescription?.items ?? [];

  return (
    <div className="text-ink-900">
      <PrintHeader organization={organization} title="Prescription" subtitle={`Date: ${encounter.encounter_date}`} />

      <div className="mb-6 grid grid-cols-1 gap-4 text-[12px] md:grid-cols-2 md:gap-10">
        <div>
          <p className="mb-2 text-[11px] font-bold text-ink-800">Patient</p>
          <p className="text-ink-900">{patient.full_name}</p>
          <p className="font-mono text-ink-600">{patient.uhid}</p>
          <p className="text-ink-600">
            {patient.date_of_birth && `${age(patient.date_of_birth)}y`}
            {patient.date_of_birth && patient.gender && ' · '}
            {patient.gender}
          </p>
          {patient.mobile && <p className="text-ink-600">Mobile: {patient.mobile}</p>}
          {patient.allergies && (
            <p className="mt-2 text-red-700"><span className="font-semibold">Allergies:</span> {patient.allergies}</p>
          )}
        </div>
        <div className="text-right">
          <p className="mb-2 text-[11px] font-bold text-ink-800">Prescribed by</p>
          <p className="text-ink-900">{doctor?.full_name ?? '-'}</p>
          <p className="text-ink-600">Date: {encounter.encounter_date}</p>
        </div>
      </div>

      {encounter.chief_complaint && (
        <Section title="Chief complaint"><p className="text-[12px]">{encounter.chief_complaint}</p></Section>
      )}

      {hasVitals && (
        <Section title="Vitals">
          <div className="grid grid-cols-2 gap-3 text-[11px] sm:grid-cols-3 md:grid-cols-4">
            {encounter.vitals?.temperature_c != null && <Vital label="Temp" value={`${encounter.vitals.temperature_c}°C`} />}
            {encounter.vitals?.pulse != null && <Vital label="Pulse" value={`${encounter.vitals.pulse} bpm`} />}
            {encounter.vitals?.bp_systolic != null && encounter.vitals?.bp_diastolic != null && (
              <Vital label="BP" value={`${encounter.vitals.bp_systolic}/${encounter.vitals.bp_diastolic}`} />
            )}
            {encounter.vitals?.spo2 != null && <Vital label="SpO2" value={`${encounter.vitals.spo2}%`} />}
            {encounter.vitals?.resp_rate != null && <Vital label="Resp" value={`${encounter.vitals.resp_rate}`} />}
            {encounter.vitals?.weight_kg != null && <Vital label="Weight" value={`${encounter.vitals.weight_kg} kg`} />}
            {encounter.vitals?.height_cm != null && <Vital label="Height" value={`${encounter.vitals.height_cm} cm`} />}
            {encounter.vitals?.bmi != null && <Vital label="BMI" value={`${encounter.vitals.bmi}`} />}
          </div>
        </Section>
      )}

      {encounter.diagnoses.length > 0 && (
        <Section title="Diagnosis">
          <ol className="ml-4 list-decimal space-y-0.5 text-[12px]">
            {encounter.diagnoses.map((d, i) => (
              <li key={i}>
                {d.diagnosis_text}
                {d.icd_code && <span className="ml-2 font-mono text-[10px] text-ink-500">({d.icd_code})</span>}
                {d.is_primary && <span className="ml-2 rounded bg-ink-100 px-1.5 py-0.5 text-[9px] font-bold uppercase">Primary</span>}
              </li>
            ))}
          </ol>
        </Section>
      )}

      <Section title="Rx">
        {rxItems.length === 0 ? (
          <p className="text-[12px] text-ink-500">No medicines prescribed.</p>
        ) : (
          <div className="overflow-x-auto"><table className="w-full border-collapse text-[12px]">
            <thead>
              <tr className="border-y border-ink-900 text-left">
                <th className="w-[6%] py-3 text-[11px] font-bold uppercase">#</th>
                <th className="w-[42%] py-3 text-[11px] font-bold uppercase">Medicine</th>
                <th className="w-[12%] py-3 text-[11px] font-bold uppercase">Dose</th>
                <th className="w-[14%] py-3 text-[11px] font-bold uppercase">Frequency</th>
                <th className="w-[13%] py-3 text-[11px] font-bold uppercase">Duration</th>
                <th className="w-[13%] py-3 text-[11px] font-bold uppercase">Route</th>
              </tr>
            </thead>
            <tbody>
              {rxItems.map((item, i) => (
                <tr key={i} className="border-b border-ink-200">
                  <td className="py-3 align-top">{i + 1}.</td>
                  <td className="py-3 align-top">
                    <p className="font-medium">{item.medicine_name}</p>
                    {item.instructions && <p className="text-[10px] italic text-ink-500">{item.instructions}</p>}
                  </td>
                  <td className="py-3 align-top tabular-nums">{item.dosage ?? '-'}</td>
                  <td className="py-3 align-top">{item.frequency ?? '-'}</td>
                  <td className="py-3 align-top">{item.duration ?? '-'}</td>
                  <td className="py-3 align-top">{item.route ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
        {encounter.prescription?.notes && (
          <p className="mt-3 text-[10px] italic text-ink-500">Notes: {encounter.prescription.notes}</p>
        )}
      </Section>

      {encounter.lab_tests && encounter.lab_tests.length > 0 && (
        <Section title="Lab tests ordered">
          <ul className="ml-4 list-disc space-y-0.5 text-[12px]">
            {encounter.lab_tests.map((t, i) => (
              <li key={i}>{t.testName}{t.sampleType && <span className="ml-2 text-[10px] text-ink-500">({t.sampleType})</span>}</li>
            ))}
          </ul>
        </Section>
      )}

      {encounter.notes && (
        <Section title="Advice / Notes">
          <p className="whitespace-pre-wrap text-[12px]">{encounter.notes}</p>
        </Section>
      )}

      <div className="mt-16 flex justify-end">
        <div className="text-center">
          <div className="mb-1 h-12 w-48 border-b border-ink-900" />
          <p className="text-[11px] font-semibold">{doctor?.full_name ?? 'Doctor'}</p>
          <p className="text-[9px] text-ink-500">Signature</p>
        </div>
      </div>

      <div className="mt-12 border-t border-ink-300 pt-3 text-center text-[10px] text-ink-500">
        This is a computer-generated prescription. Please consult a doctor before making any medical decisions.
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-ink-700">{title}</p>
      {children}
    </div>
  );
}
function Vital({ label, value }: { label: string; value: string }) {
  return <div><span className="text-ink-500">{label}: </span><span className="font-medium">{value}</span></div>;
}
function age(dob: string): number {
  return Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
}
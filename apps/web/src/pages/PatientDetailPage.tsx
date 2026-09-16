import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Heart, Phone, MapPin, AlertTriangle } from 'lucide-react';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { usePatient } from '@/hooks/usePatients';
import { ConsultationHistory } from '@/components/ConsultationHistory';

export function PatientDetailPage() {
  const { patientId } = useParams<{ patientId: string }>();
  const p = usePatient(patientId);

  if (p.isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size={32} />
      </div>
    );
  }

  if (p.isError || !p.data) {
    return (
      <div className="space-y-4">
        <Alert tone="error">Patient not found.</Alert>
        <Link to="/patients">
          <Button variant="secondary">
            <ArrowLeft size={14} /> Back to patients
          </Button>
        </Link>
      </div>
    );
  }

  const pt = p.data;

  return (
    <>
      <div className="mb-4">
        <Link
          to="/patients"
          className="inline-flex items-center gap-1 text-sm text-brand-600 hover:underline"
        >
          <ArrowLeft size={14} /> Back to patients
        </Link>
      </div>

      <Card className="mb-6">
        <CardBody className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-brand-600">
              <Heart size={24} />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-slate-900">{pt.full_name}</h1>
              <p className="text-sm text-slate-500">
                <span className="font-mono text-brand-700">{pt.uhid}</span>
                {pt.date_of_birth && ` - ${age(pt.date_of_birth)}y`}
                {pt.gender && ` - ${pt.gender}`}
                {pt.blood_group && ` - ${pt.blood_group}`}
              </p>
            </div>
          </div>
          {pt.blood_group && (
            <Badge tone="red" className="px-3 py-1.5 text-sm">{pt.blood_group}</Badge>
          )}
        </CardBody>
      </Card>

      {pt.allergies && (
        <div className="mb-6">
          <Alert tone="error"><strong>Allergies:</strong> {pt.allergies}</Alert>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Contact" />
          <CardBody className="space-y-3 text-sm">
            <Row icon={<Phone size={14} />} label="Mobile" value={pt.mobile ?? '-'} />
            <Row icon={<MapPin size={14} />} label="Address" value={pt.address ?? '-'} />
            <Row icon={<AlertTriangle size={14} />} label="Emergency contact" value={pt.emergency_contact ?? '-'} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Medical" />
          <CardBody className="space-y-3 text-sm">
            <Field label="Blood group" value={pt.blood_group ?? '-'} />
            <Field label="Allergies" value={pt.allergies ?? 'None recorded'} />
            <Field label="Medical history" value={pt.medical_history ?? 'None recorded'} />
          </CardBody>
        </Card>
      </div>

      {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      {/* CONSULTATION HISTORY - this was missing             */}
      {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      <div className="mt-6">
        {pt.server_id ? (
          <ConsultationHistory patientId={pt.server_id} />
        ) : (
          <Card>
            <CardBody className="text-sm text-slate-500">
              Consultation history becomes available once this patient has synced to the server.
            </CardBody>
          </Card>
        )}
      </div>
    </>
  );
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 text-slate-400">{icon}</span>
      <div>
        <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
        <p className="text-slate-800">{value}</p>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="text-slate-800 whitespace-pre-wrap">{value}</p>
    </div>
  );
}

function age(dob: string): number {
  return Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
}

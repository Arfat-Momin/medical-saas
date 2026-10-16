import { useState } from 'react';
import { Printer, CheckCircle, PenTool, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { SignaturePad } from '@/components/ui/SignaturePad';
import { PrintPreviewModal } from '@/components/PrintPreviewModal';
import { useSignConsent } from '@/hooks/useIpd';
import type { AdmissionFull } from '@/repositories/ipd.repository';

interface Props {
  admission: AdmissionFull;
  canManage: boolean;
}

export function AdmissionConsentForm({ admission, canManage }: Props) {
  const [printOpen, setPrintOpen] = useState(false);
  const [isEditingSignature, setIsEditingSignature] = useState(false);
  const [pendingSignature, setPendingSignature] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const signConsent = useSignConsent(admission.id);

  const isSigned = Boolean(admission.consent_signature);

  async function handleSaveSignature() {
    if (!pendingSignature) {
      setError('Please draw your signature before saving.');
      return;
    }
    setError(null);
    try {
      await signConsent.mutateAsync(pendingSignature);
      setIsEditingSignature(false);
      setPendingSignature(null);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to save signature');
    }
  }

  const renderConsentDocument = () => (
    <div className="space-y-6 text-slate-800">
      {/* Header */}
      <div className="border-b-2 border-slate-900 pb-4 text-center">
        <h1 className="text-xl font-bold uppercase tracking-wider text-slate-900 sm:text-2xl">
          {admission.branches?.name ?? 'Hospital Care Center'}
        </h1>
        <p className="text-xs uppercase tracking-widest text-slate-500">Inpatient Department (IPD)</p>
        <div className="mt-2 inline-block rounded bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-800">
          ADMISSION & MEDICAL TREATMENT CONSENT FORM
        </div>
      </div>

      {/* Patient & Admission Grid */}
      <div className="grid grid-cols-2 gap-4 rounded border border-slate-300 p-4 text-sm sm:grid-cols-4">
        <div>
          <span className="block text-xs font-semibold uppercase text-slate-500">Patient Name</span>
          <span className="font-semibold text-slate-900">{admission.patients?.full_name ?? '-'}</span>
        </div>
        <div>
          <span className="block text-xs font-semibold uppercase text-slate-500">UHID / Patient ID</span>
          <span className="font-mono text-slate-900">{admission.patients?.uhid ?? '-'}</span>
        </div>
        <div>
          <span className="block text-xs font-semibold uppercase text-slate-500">IP Number</span>
          <span className="font-mono font-bold text-brand-700">{admission.ip_number ?? '-'}</span>
        </div>
        <div>
          <span className="block text-xs font-semibold uppercase text-slate-500">Gender / Age</span>
          <span className="text-slate-900">
            {admission.patients?.gender ?? '-'}
            {admission.patients?.date_of_birth ? ` / ${calculateAge(admission.patients.date_of_birth)} yrs` : ''}
          </span>
        </div>
        <div>
          <span className="block text-xs font-semibold uppercase text-slate-500">Contact No.</span>
          <span className="text-slate-900">{admission.patients?.mobile ?? '-'}</span>
        </div>
        <div>
          <span className="block text-xs font-semibold uppercase text-slate-500">Admission Date & Time</span>
          <span className="text-slate-900">{new Date(admission.admitted_at).toLocaleString()}</span>
        </div>
        <div>
          <span className="block text-xs font-semibold uppercase text-slate-500">Bed / Location</span>
          <span className="text-slate-900">{admission.bed?.name ?? '-'} {admission.bed?.code ? `(${admission.bed.code})` : ''}</span>
        </div>
        <div>
          <span className="block text-xs font-semibold uppercase text-slate-500">Attending Consultant</span>
          <span className="font-semibold text-slate-900">{admission.doctors?.full_name ?? '-'}</span>
        </div>
      </div>

      {/* Diagnosis & Reason */}
      <div className="rounded border border-slate-200 bg-slate-50 p-3 text-sm">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div>
            <span className="block text-xs font-semibold uppercase text-slate-500">Provisional Diagnosis:</span>
            <span className="font-medium text-slate-800">{admission.diagnosis || 'Under evaluation'}</span>
          </div>
          <div>
            <span className="block text-xs font-semibold uppercase text-slate-500">Reason for Admission:</span>
            <span className="font-medium text-slate-800">{admission.reason || 'Medical / Surgical Management'}</span>
          </div>
        </div>
      </div>

      {/* Consent Clauses */}
      <div className="space-y-3 text-xs leading-relaxed text-slate-700">
        <h3 className="font-bold uppercase tracking-wide text-slate-900">Terms of Admission and Declarations:</h3>
        <ol className="list-decimal space-y-2 pl-4">
          <li>
            <strong>Consent for Medical Care:</strong> I voluntarily consent to inpatient admission, diagnostic examinations,
            pathological and radiological investigations, nursing care, and administration of medication as deemed necessary by
            the attending physician and hospital medical staff.
          </li>
          <li>
            <strong>Emergency Care & Procedures:</strong> In case of an emergency requiring immediate intervention, resuscitation,
            or urgent transfer to an intensive care unit (ICU), I authorize the medical team to administer emergency treatment to
            preserve life and prevent deterioration.
          </li>
          <li>
            <strong>Financial Undertaking:</strong> I agree to pay all charges related to this hospitalization, including room tariffs,
            nursing charges, investigation costs, pharmacy bills, surgical and consultation fees. I understand that estimated costs
            are provisional and final charges depend on actual procedures and length of stay.
          </li>
          <li>
            <strong>Hospital Rules & Valuables:</strong> I agree to adhere to hospital rules and visiting hours. The hospital and its
            management shall not be held liable for loss or theft of any personal belongings, jewelry, money, or documents brought into the premises.
          </li>
          <li>
            <strong>Discharge Against Medical Advice (DAMA/LAMA):</strong> In the event I or my patient decide to leave the hospital
            against medical advice, I accept full responsibility for all clinical consequences, complications, and outcomes.
          </li>
        </ol>
      </div>

      {/* Signatures Box */}
      <div className="mt-8 border-t border-slate-300 pt-6">
        <div className="grid grid-cols-2 gap-8 items-end">
          {/* Patient/Guardian signature */}
          <div className="space-y-2">
            <span className="block text-xs font-bold uppercase tracking-wider text-slate-600">
              Patient / Legal Guardian Signature
            </span>
            <div className="h-28 w-full rounded border border-dashed border-slate-300 bg-slate-50 flex items-center justify-center p-2">
              {admission.consent_signature ? (
                <img
                  src={admission.consent_signature}
                  alt="Patient Signature"
                  className="max-h-24 max-w-full object-contain"
                />
              ) : (
                <span className="text-xs italic text-slate-400">Awaiting signature</span>
              )}
            </div>
            <div className="text-xs text-slate-500">
              {admission.consent_signed_at ? (
                <>Signed on: {new Date(admission.consent_signed_at).toLocaleString()}</>
              ) : (
                <>Date & Time: _______________</>
              )}
            </div>
          </div>

          {/* Doctor / Hospital authority */}
          <div className="space-y-2">
            <span className="block text-xs font-bold uppercase tracking-wider text-slate-600">
              Admitting Medical Officer / Doctor
            </span>
            <div className="h-28 w-full rounded border border-dashed border-slate-300 bg-slate-50 flex flex-col justify-end p-2 text-center">
              <span className="text-sm font-semibold text-slate-900">{admission.doctors?.full_name ?? 'Doctor'}</span>
              <span className="text-xs text-slate-500">Attending Consultant / Signature</span>
            </div>
            <div className="text-xs text-slate-500">
              Date: {new Date(admission.admitted_at).toLocaleDateString()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title="Inpatient Admission Consent Form"
          subtitle="Medical treatment consent, financial undertaking, and patient signature"
          action={
            <div className="flex items-center gap-2">
              {isSigned ? (
                <Badge tone="green" className="flex items-center gap-1">
                  <CheckCircle size={12} /> Consent Signed
                </Badge>
              ) : (
                <Badge tone="yellow">Pending Signature</Badge>
              )}
              <Button variant="secondary" size="sm" onClick={() => setPrintOpen(true)}>
                <Printer size={14} /> Print / Save PDF
              </Button>
            </div>
          }
        />
        <CardBody className="space-y-6">
          {error && <div className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</div>}

          {/* Form preview */}
          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            {renderConsentDocument()}
          </div>

          {/* Signature Capture Section */}
          {canManage && (
            <div className="rounded-lg border border-brand-100 bg-brand-50/40 p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <PenTool size={16} className="text-brand-600" />
                  <h4 className="text-sm font-semibold text-slate-900">
                    {isSigned && !isEditingSignature ? 'Patient Signature Recorded' : 'Capture Patient / Guardian Signature'}
                  </h4>
                </div>
                {isSigned && !isEditingSignature && (
                  <Button variant="ghost" size="sm" onClick={() => setIsEditingSignature(true)}>
                    <RefreshCw size={14} /> Re-sign / Change Signature
                  </Button>
                )}
              </div>

              {(!isSigned || isEditingSignature) && (
                <div className="space-y-3">
                  <p className="text-xs text-slate-600">
                    Sign below using a mouse, stylus, or touch screen. Click "Apply & Save Signature" to record the legal consent.
                  </p>
                  <SignaturePad
                    width={480}
                    height={160}
                    onSign={(dataUrl) => setPendingSignature(dataUrl)}
                    onClear={() => setPendingSignature(null)}
                  />
                  <div className="flex items-center gap-2 pt-2">
                    <Button
                      size="sm"
                      onClick={handleSaveSignature}
                      loading={signConsent.isPending}
                      disabled={!pendingSignature}
                    >
                      Apply & Save Signature
                    </Button>
                    {isEditingSignature && (
                      <Button variant="secondary" size="sm" onClick={() => setIsEditingSignature(false)}>
                        Cancel
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardBody>
      </Card>

      {/* Print Preview Modal */}
      <PrintPreviewModal
        open={printOpen}
        onClose={() => setPrintOpen(false)}
        title={`Consent Form - ${admission.patients?.full_name ?? 'Admission'} (IP: ${admission.ip_number ?? '-'})`}
      >
        <div className="p-4 bg-white">
          {renderConsentDocument()}
        </div>
      </PrintPreviewModal>
    </div>
  );
}

function calculateAge(dobString: string): number {
  const birth = new Date(dobString);
  const diff = Date.now() - birth.getTime();
  const ageDate = new Date(diff);
  return Math.abs(ageDate.getUTCFullYear() - 1970);
}

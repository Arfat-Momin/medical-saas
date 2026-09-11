import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Check, FlaskConical, Pencil, ShieldCheck } from 'lucide-react';
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
  useLabOrder, useCollectSample, useEnterResults, useVerifyResults,
} from '@/hooks/useLaboratory';
import { usePermissions } from '@/hooks/useAuth';
import { PERMISSIONS } from '@medical/shared';

const statusTone: Record<string, BadgeTone> = {
  ORDERED: 'blue', COLLECTED: 'yellow', RESULTED: 'purple',
  VERIFIED: 'green', CANCELLED: 'gray',
};
const EMPTY_RESULT = { value: '', unit: '', flag: '', remarks: '' };

const flagTone: Record<string, BadgeTone> = {
  NORMAL: 'green', HIGH: 'red', LOW: 'yellow', ABNORMAL: 'purple', CRITICAL: 'red',
};

export function LabOrderDetailPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const order = useLabOrder(orderId);
  const collect = useCollectSample(orderId ?? '');
  const enter = useEnterResults(orderId ?? '');
  const verify = useVerifyResults(orderId ?? '');
  const { can } = usePermissions();

  const [collectOpen, setCollectOpen] = useState(false);
  const [enterOpen, setEnterOpen] = useState(false);
  const [sampleType, setSampleType] = useState('Blood');
  const [barcode, setBarcode] = useState('');
  const [collectNotes, setCollectNotes] = useState('');

  const [results, setResults] = useState<Record<string, { value: string; unit: string; flag: string; remarks: string }>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!order.data) return;
    const initial: Record<string, any> = {};
    order.data.items?.forEach((i) => {
      initial[i.id] = {
        value: i.result_value ?? '',
        unit: i.result_unit ?? '',
        flag: i.flag ?? '',
        remarks: i.remarks ?? '',
      };
    });
    setResults(initial);
  }, [order.data]);

  if (order.isLoading) return <div className="flex justify-center py-20"><Spinner size={32} /></div>;
  if (order.isError || !order.data) return <Alert tone="error">Failed to load order.</Alert>;

  const o = order.data;
  const allResultsEntered = o.items?.every((i) => i.resulted_at) ?? false;

  async function onCollect() {
    setError(null);
    try {
      await collect.mutateAsync({ sampleType, barcode: barcode || null, notes: collectNotes || null });
      setCollectOpen(false); setBarcode(''); setCollectNotes('');
    } catch (e: any) { setError(e?.message ?? 'Failed to collect sample'); }
  }

  async function onEnterResults() {
    setError(null);
    try {
      const items = Object.entries(results).map(([itemId, v]) => ({
        itemId, resultValue: v.value || null, resultUnit: v.unit || null,
        flag: v.flag || null, remarks: v.remarks || null,
      }));
      await enter.mutateAsync(items);
      setEnterOpen(false);
    } catch (e: any) { setError(e?.message ?? 'Failed to save results'); }
  }

  async function onVerify() {
    setError(null);
    try { await verify.mutateAsync(); }
    catch (e: any) { setError(e?.message ?? 'Verification failed'); }
  }

  return (
    <>
      <div className="mb-4">
        <Link to="/laboratory/orders" className="inline-flex items-center gap-1 text-sm text-brand-600 hover:underline">
          <ArrowLeft size={14} /> Back to lab orders
        </Link>
      </div>

      <PageHeader
        title={`Lab Order`}
        subtitle={`${o.patients?.uhid} | ${o.patients?.full_name}`}
        action={
          <div className="flex items-center gap-2">
            <Badge tone={statusTone[o.status] ?? 'gray'} className="px-3 py-1 text-xs">{o.status}</Badge>
            <Badge tone={o.priority === 'STAT' ? 'red' : o.priority === 'URGENT' ? 'yellow' : 'gray'} className="px-3 py-1 text-xs">{o.priority}</Badge>
          </div>
        }
      />

      {error && <div className="mb-4"><Alert tone="error">{error}</Alert></div>}

      <Card className="mb-6">
        <CardBody className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <Info label="Patient" value={o.patients?.full_name} sub={o.patients?.uhid} />
          <Info label="Doctor" value={o.doctors?.full_name} />
          <Info label="Order date" value={o.order_date} />
          <Info label="Branch" value={o.branches?.name} sub={o.branches?.branch_code} />
        </CardBody>
      </Card>

      <div className="mb-6 flex flex-wrap items-center gap-2">
        {o.status === 'ORDERED' && can(PERMISSIONS.LAB_ORDER) && (
          <Button onClick={() => setCollectOpen(true)}>
            <FlaskConical size={14} /> Collect sample
          </Button>
        )}
        {o.status === 'COLLECTED' && can(PERMISSIONS.LAB_RESULT_ENTER) && (
          <Button onClick={() => setEnterOpen(true)}>
            <Pencil size={14} /> Enter results
          </Button>
        )}
        {o.status === 'RESULTED' && can(PERMISSIONS.LAB_RESULT_VERIFY) && (
          <Button onClick={onVerify} loading={verify.isPending} disabled={!allResultsEntered}>
            <ShieldCheck size={14} /> Verify & release report
          </Button>
        )}
        {o.status === 'VERIFIED' && (
          <Badge tone="green" className="px-3 py-1.5 text-sm">
            <Check size={14} className="mr-1 inline" /> Report verified
          </Badge>
        )}
      </div>

      {o.samples && o.samples.length > 0 && (
        <Card className="mb-6">
          <CardHeader title="Samples" subtitle={`${o.samples.length} sample(s) collected`} />
          <CardBody>
            <ul className="divide-y divide-slate-100">
              {o.samples.map((s) => (
                <li key={s.id} className="flex items-center justify-between py-2 text-sm">
                  <div>
                    <span className="font-medium text-slate-800">{s.sample_type}</span>
                    {s.barcode && <span className="ml-2 font-mono text-xs text-slate-500">{s.barcode}</span>}
                  </div>
                  <span className="text-xs text-slate-500">{new Date(s.collected_at).toLocaleString()}</span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader title="Tests & Results" subtitle={`${o.items?.length ?? 0} test(s)`} />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3">Test</th>
                <th className="px-5 py-3">Sample</th>
                <th className="px-5 py-3">Reference</th>
                <th className="px-5 py-3">Result</th>
                <th className="px-5 py-3">Flag</th>
                <th className="px-5 py-3 text-right">Price</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {o.items?.map((it) => (
                <tr key={it.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3">
                    <div className="font-medium text-slate-900">{it.test_name}</div>
                    {it.test_code && <div className="font-mono text-xs text-slate-500">{it.test_code}</div>}
                  </td>
                  <td className="px-5 py-3 text-slate-600">{it.sample_type ?? '-'}</td>
                  <td className="px-5 py-3 text-slate-600 text-xs">{it.reference_text ?? '-'}</td>
                  <td className="px-5 py-3">
                    {it.result_value
                      ? <span className="font-mono text-slate-800">{it.result_value} {it.result_unit ?? ''}</span>
                      : <span className="text-slate-400">Pending</span>}
                  </td>
                  <td className="px-5 py-3">
                    {it.flag ? <Badge tone={flagTone[it.flag] ?? 'gray'}>{it.flag}</Badge> : '-'}
                  </td>
                  <td className="px-5 py-3 text-right font-mono">Rs.{it.price.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50 font-medium">
                <td colSpan={5} className="px-5 py-3 text-right text-slate-600">Total</td>
                <td className="px-5 py-3 text-right font-mono">Rs.{o.total_amount.toFixed(2)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

      {o.notes && (
        <Card className="mt-6">
          <CardBody>
            <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Order notes</h4>
            <p className="text-sm text-slate-700 whitespace-pre-wrap">{o.notes}</p>
          </CardBody>
        </Card>
      )}

      <Modal open={collectOpen} onClose={() => setCollectOpen(false)} title="Collect sample"
        footer={<><Button variant="secondary" onClick={() => setCollectOpen(false)}>Cancel</Button>
          <Button onClick={onCollect} loading={collect.isPending}>Mark collected</Button></>}>
        <div className="space-y-4">
          <Select label="Sample type" value={sampleType} onChange={(e) => setSampleType(e.target.value)}>
            {['Blood','Serum','Plasma','Urine','Stool','Swab','Sputum','Other'].map((s) => <option key={s}>{s}</option>)}
          </Select>
          <Input label="Barcode (optional)" value={barcode} onChange={(e) => setBarcode(e.target.value)} />
          <Input label="Notes" value={collectNotes} onChange={(e) => setCollectNotes(e.target.value)} />
        </div>
      </Modal>

      <Modal open={enterOpen} onClose={() => setEnterOpen(false)} title="Enter results" size="lg"
        footer={<><Button variant="secondary" onClick={() => setEnterOpen(false)}>Cancel</Button>
          <Button onClick={onEnterResults} loading={enter.isPending}>Save results</Button></>}>
        <div className="space-y-3">
          {o.items?.map((it) => (
            <div key={it.id} className="rounded-md border border-slate-200 p-3">
              <div className="mb-2 flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-slate-900">{it.test_name}</div>
                  <div className="text-xs text-slate-500">Ref: {it.reference_text ?? '-'}</div>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
                <Input label="Value" placeholder="e.g. 13.5"
                  value={results[it.id]?.value ?? ''}
                  onChange={(e) => setResults({ ...results, [it.id]: { ...(results[it.id] ?? EMPTY_RESULT), value: e.target.value } })} />
                <Input label="Unit" placeholder={it.result_unit ?? ''}
                  value={results[it.id]?.unit ?? ''}
                  onChange={(e) => setResults({ ...results, [it.id]: { ...(results[it.id] ?? EMPTY_RESULT), unit: e.target.value } })} />
                <Select label="Flag"
                  value={results[it.id]?.flag ?? ''}
                  onChange={(e) => setResults({ ...results, [it.id]: { ...(results[it.id] ?? EMPTY_RESULT), flag: e.target.value } })}>
                  <option value="">-</option>
                  <option value="NORMAL">Normal</option>
                  <option value="HIGH">High</option>
                  <option value="LOW">Low</option>
                  <option value="ABNORMAL">Abnormal</option>
                  <option value="CRITICAL">Critical</option>
                </Select>
                <Input label="Remarks"
                  value={results[it.id]?.remarks ?? ''}
                  onChange={(e) => setResults({ ...results, [it.id]: { ...(results[it.id] ?? EMPTY_RESULT), remarks: e.target.value } })} />
              </div>
            </div>
          ))}
        </div>
      </Modal>
    </>
  );
}

function Info({ label, value, sub }: { label: string; value?: string; sub?: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-slate-900">{value ?? '-'}</p>
      {sub && <p className="font-mono text-xs text-slate-500">{sub}</p>}
    </div>
  );
}

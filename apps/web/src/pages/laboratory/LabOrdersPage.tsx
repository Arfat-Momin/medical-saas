import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Card } from '@/components/ui/Card';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { Alert } from '@/components/ui/Alert';
import { Spinner } from '@/components/ui/Spinner';
import { useLabOrders, useCreateLabOrder, useLabTests } from '@/hooks/useLaboratory';
import { usePatients } from '@/hooks/usePatients';
import { useUsers } from '@/hooks/useUsers';
import { usePermissions } from '@/hooks/useAuth';
import { PERMISSIONS } from '@medical/shared';

const statusTone: Record<string, BadgeTone> = {
  ORDERED: 'blue', COLLECTED: 'yellow', RESULTED: 'purple',
  VERIFIED: 'green', CANCELLED: 'gray',
};

export function LabOrdersPage() {
  const { can } = usePermissions();
  const [status, setStatus] = useState('');
  const [date, setDate] = useState('');
  const [page, setPage] = useState(1);
  const list = useLabOrders({ status: status || undefined, date: date || undefined, page, pageSize: 20 });

  const patients = usePatients({ page: 1, pageSize: 200 });
  const doctors = useUsers({ page: 1, pageSize: 100, roleCode: 'DOCTOR' });
  const tests = useLabTests({ page: 1, pageSize: 200 });
  const create = useCreateLabOrder();

  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [patientId, setPatientId] = useState('');
  const [doctorId, setDoctorId] = useState('');
  const [priority, setPriority] = useState<'ROUTINE'|'URGENT'|'STAT'>('ROUTINE');
  const [notes, setNotes] = useState('');
  const [selectedTests, setSelectedTests] = useState<string[]>([]);

  const canOrder = can(PERMISSIONS.LAB_ORDER);

  function toggleTest(id: string) {
    setSelectedTests((s) => s.includes(id) ? s.filter((x) => x !== id) : [...s, id]);
  }

  async function onCreate() {
    setError(null);
    if (!patientId || !doctorId) { setError('Select patient and doctor'); return; }
    if (selectedTests.length === 0) { setError('Select at least one test'); return; }
    try {
      await create.mutateAsync({
        patientId, doctorId, priority, notes: notes || null, testIds: selectedTests,
      });
      setOpen(false);
      setPatientId(''); setDoctorId(''); setSelectedTests([]); setNotes(''); setPriority('ROUTINE');
    } catch (e: any) { setError(e?.message ?? 'Failed to create order'); }
  }

  const totalPages = list.data ? Math.max(1, Math.ceil(list.data.total / (list.data.pageSize || 20))) : 1;

  return (
    <>
      <PageHeader title="Lab Orders" subtitle="Orders, samples and results"
        action={canOrder && <Button onClick={() => setOpen(true)}><Plus size={16} /> New order</Button>} />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="w-48">
          <Select label="Status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="">All statuses</option>
            <option value="ORDERED">Ordered</option>
            <option value="COLLECTED">Sample collected</option>
            <option value="RESULTED">Results entered</option>
            <option value="VERIFIED">Verified</option>
            <option value="CANCELLED">Cancelled</option>
          </Select>
        </div>
        <div className="w-48">
          <Input label="Date" type="date" value={date} onChange={(e) => { setDate(e.target.value); setPage(1); }} />
        </div>
      </div>

      {list.isLoading && <div className="flex justify-center py-12"><Spinner size={28} /></div>}
      {list.isError && <Alert tone="error">Failed to load lab orders.</Alert>}

      {list.data?.rows.length === 0 && (
        <EmptyState title="No lab orders" description="Orders placed from consultations or manually will appear here."
          action={canOrder && <Button onClick={() => setOpen(true)}><Plus size={16} /> New order</Button>} />
      )}

      {list.data && list.data.rows.length > 0 && (
        <>
          <Card className="overflow-x-auto overflow-y-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3">Date</th>
                  <th className="px-5 py-3">Patient</th>
                  <th className="px-5 py-3">Doctor</th>
                  <th className="px-5 py-3">Priority</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Total</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {list.data.rows.map((o) => (
                  <tr key={o.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3 text-slate-700">{o.order_date}</td>
                    <td className="px-5 py-3">
                      <div className="font-medium text-slate-900">{o.patients?.full_name}</div>
                      <div className="font-mono text-xs text-brand-700">{o.patients?.uhid}</div>
                    </td>
                    <td className="px-5 py-3 text-slate-600">{o.doctors?.full_name ?? '-'}</td>
                    <td className="px-5 py-3">
                      <Badge tone={o.priority === 'STAT' ? 'red' : o.priority === 'URGENT' ? 'yellow' : 'gray'}>
                        {o.priority}
                      </Badge>
                    </td>
                    <td className="px-5 py-3"><Badge tone={statusTone[o.status] ?? 'gray'}>{o.status}</Badge></td>
                    <td className="px-5 py-3 text-right font-mono">Rs.{o.total_amount.toFixed(2)}</td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex justify-end items-center gap-2">
                        <Link to={`/laboratory/orders/${o.id}`} className="text-sm text-brand-600 hover:underline">Open</Link>
                        {o.lab_invoice && (
                          <Link
                            to={`/billing/invoices/${o.lab_invoice.id}`}
                            className="rounded px-2 py-0.5 font-mono text-xs text-purple-700 bg-purple-50 hover:bg-purple-100"
                            title={`Lab invoice Rs.${o.lab_invoice.total_amount.toFixed(2)}`}
                          >
                            {o.lab_invoice.invoice_no}
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
            <span>{list.data.total} order{list.data.total === 1 ? '' : 's'} | page {page} of {totalPages}</span>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
              <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          </div>
        </>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="New lab order" size="lg"
        footer={<><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={onCreate} loading={create.isPending}>Create order</Button></>}>
        <div className="space-y-4">
          {error && <Alert tone="error">{error}</Alert>}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Select label="Patient *" value={patientId} onChange={(e) => setPatientId(e.target.value)}>
              <option value="">- select -</option>
              {patients.data?.rows.map((p) => (
                <option key={p.id} value={p.id}>{p.uhid} | {p.full_name}</option>
              ))}
            </Select>
            <Select label="Ordering doctor *" value={doctorId} onChange={(e) => setDoctorId(e.target.value)}>
              <option value="">- select -</option>
              {doctors.data?.rows.map((r) => <option key={r.user_id} value={r.user_id}>{r.users.full_name}</option>)}
            </Select>
            <Select label="Priority" value={priority} onChange={(e) => setPriority(e.target.value as any)}>
              <option value="ROUTINE">Routine</option>
              <option value="URGENT">Urgent</option>
              <option value="STAT">STAT</option>
            </Select>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <h4 className="text-sm font-medium text-slate-700">Tests * ({selectedTests.length} selected)</h4>
              {tests.data && (
                <span className="text-xs text-slate-500">
                  Est. total: Rs.{tests.data.rows.filter((t) => selectedTests.includes(t.id)).reduce((s, t) => s + t.price, 0).toFixed(2)}
                </span>
              )}
            </div>
            <div className="max-h-64 overflow-y-auto rounded-md border border-slate-200">
              {tests.data?.rows.map((t) => (
                <label key={t.id} className="flex cursor-pointer items-center justify-between border-b border-slate-100 px-3 py-2 last:border-0 hover:bg-slate-50">
                  <div className="flex items-center gap-3">
                    <input type="checkbox" className="h-4 w-4"
                      checked={selectedTests.includes(t.id)} onChange={() => toggleTest(t.id)} />
                    <div>
                      <div className="text-sm text-slate-800">{t.name}</div>
                      <div className="text-xs text-slate-500">{t.category} | {t.sample_type ?? '-'}</div>
                    </div>
                  </div>
                  <div className="font-mono text-sm text-slate-700">Rs.{t.price.toFixed(2)}</div>
                </label>
              ))}
            </div>
          </div>

          <Input label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Clinical notes to lab" />
        </div>
      </Modal>
    </>
  );
}

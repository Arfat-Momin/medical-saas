import { useState } from 'react';
import { Save, Stethoscope, FlaskConical } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { PageHeader } from '@/components/ui/PageHeader';
import { Alert } from '@/components/ui/Alert';
import { Spinner } from '@/components/ui/Spinner';
import { useUsers, useUpdateUser } from '@/hooks/useUsers';
import { useLabTests, useUpdateLabTest } from '@/hooks/useLaboratory';
import { usePermissions } from '@/hooks/useAuth';
import { PERMISSIONS } from '@medical/shared';
import { cn } from '@/lib/cn';

type Tab = 'doctors' | 'labs';

export function PricingPage() {
  const { can } = usePermissions();
  const isAdmin = can(PERMISSIONS.USER_MANAGE);

  const [tab, setTab] = useState<Tab>('doctors');
  const [msg, setMsg] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [feeEdits, setFeeEdits]     = useState<Record<string, string>>({});
  const [priceEdits, setPriceEdits] = useState<Record<string, string>>({});
  const [saving, setSaving]         = useState<string | null>(null);

  const doctors = useUsers({ page: 1, pageSize: 300, roleCode: 'DOCTOR' });
  const labs    = useLabTests({ page: 1, pageSize: 500 });
  const updateUser = useUpdateUser();
  const updateLab  = useUpdateLabTest();

  if (!isAdmin) {
    return (
      <>
        <PageHeader title="Pricing" subtitle="Consultation and lab pricing" />
        <Alert tone="error">Only the Hospital Admin can view and edit pricing.</Alert>
      </>
    );
  }

  async function saveDoctor(userId: string, name: string) {
    const fee = Number(feeEdits[userId]);
    if (isNaN(fee) || fee < 0) { setMsg({ tone: 'error', text: 'Enter a valid non-negative number' }); return; }
    setSaving(userId); setMsg(null);
    try {
      await updateUser.mutateAsync({ id: userId, patch: { consultationFee: fee } });
      setMsg({ tone: 'success', text: `Fee updated for ${name}` });
      setFeeEdits((e) => { const n = { ...e }; delete n[userId]; return n; });
    } catch (err: any) { setMsg({ tone: 'error', text: err?.message ?? 'Save failed' }); }
    finally { setSaving(null); }
  }

  async function saveLab(id: string, name: string) {
    const p = Number(priceEdits[id]);
    if (isNaN(p) || p < 0) { setMsg({ tone: 'error', text: 'Enter a valid non-negative number' }); return; }
    setSaving(id); setMsg(null);
    try {
      await updateLab.mutateAsync({ id, patch: { price: p } });
      setMsg({ tone: 'success', text: `Price updated for ${name}` });
      setPriceEdits((e) => { const n = { ...e }; delete n[id]; return n; });
    } catch (err: any) { setMsg({ tone: 'error', text: err?.message ?? 'Save failed' }); }
    finally { setSaving(null); }
  }

  return (
    <>
      <PageHeader title="Pricing" subtitle="Set each doctor’s consultation fee and each lab test’s price" />
      {msg && <div className="mb-4"><Alert tone={msg.tone}>{msg.text}</Alert></div>}

      <div className="mb-4 border-b border-slate-200">
        <nav className="-mb-px flex gap-6">
          <TabButton active={tab === 'doctors'} onClick={() => setTab('doctors')} icon={<Stethoscope size={14} />}>Doctors</TabButton>
          <TabButton active={tab === 'labs'}    onClick={() => setTab('labs')}    icon={<FlaskConical size={14} />}>Lab Tests</TabButton>
        </nav>
      </div>

      {tab === 'doctors' && (
        <Card className="overflow-x-auto overflow-y-hidden">
          <CardHeader title="Doctor consultation fees" subtitle={`${doctors.data?.total ?? 0} doctor(s). Added to the invoice when a consultation is completed.`} />
          {doctors.isLoading && <div className="flex justify-center py-10"><Spinner size={24} /></div>}
          {doctors.isError && <CardBody><Alert tone="error">Failed to load doctors.</Alert></CardBody>}
          {doctors.data && doctors.data.rows.length === 0 && (
            <CardBody><p className="text-sm text-slate-500">No doctors yet. Invite a user with the DOCTOR role first.</p></CardBody>
          )}
          {doctors.data && doctors.data.rows.length > 0 && (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3">Doctor</th>
                  <th className="px-5 py-3">Email</th>
                  <th className="px-5 py-3 text-right">Consultation fee (Rs.)</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {doctors.data.rows.map((row: any) => {
                  const userId = row.user_id;
                  const name = row.users.full_name;
                  const current = Number(row.users.consultation_fee ?? 0);
                  const draft = feeEdits[userId];
                  const value = draft ?? String(current);
                  const dirty = draft !== undefined && draft !== String(current);
                  return (
                    <tr key={row.id} className="hover:bg-slate-50">
                      <td className="px-5 py-3 font-medium text-slate-900">{name}</td>
                      <td className="px-5 py-3 text-slate-600">{row.users.email}</td>
                      <td className="px-5 py-3 text-right">
                        <div className="inline-flex items-center gap-2">
                          <Input
                            type="number" min="0" step="1" className="w-32 text-right"
                            value={value}
                            onChange={(e) => setFeeEdits((s) => ({ ...s, [userId]: e.target.value }))}
                          />
                          {!dirty && <Badge tone="gray">saved</Badge>}
                        </div>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <Button size="sm" onClick={() => saveDoctor(userId, name)} disabled={!dirty} loading={saving === userId}>
                          <Save size={12} /> Save
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Card>
      )}

      {tab === 'labs' && (
        <Card className="overflow-x-auto overflow-y-hidden">
          <CardHeader title="Lab test prices" subtitle={`${labs.data?.total ?? 0} test(s). Added to the invoice when a test is ordered.`} />
          {labs.isLoading && <div className="flex justify-center py-10"><Spinner size={24} /></div>}
          {labs.isError && <CardBody><Alert tone="error">Failed to load lab tests.</Alert></CardBody>}
          {labs.data && labs.data.rows.length === 0 && (
            <CardBody><p className="text-sm text-slate-500">No lab tests yet. Add tests in the Laboratory module first.</p></CardBody>
          )}
          {labs.data && labs.data.rows.length > 0 && (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3">Test</th>
                  <th className="px-5 py-3">Category</th>
                  <th className="px-5 py-3 text-right">Price (Rs.)</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {labs.data.rows.map((t: any) => {
                  const current = Number(t.price ?? 0);
                  const draft = priceEdits[t.id];
                  const value = draft ?? String(current);
                  const dirty = draft !== undefined && draft !== String(current);
                  return (
                    <tr key={t.id} className="hover:bg-slate-50">
                      <td className="px-5 py-3 font-medium text-slate-900">{t.name}</td>
                      <td className="px-5 py-3 text-slate-600">{t.category ?? '-'}</td>
                      <td className="px-5 py-3 text-right">
                        <div className="inline-flex items-center gap-2">
                          <Input
                            type="number" min="0" step="1" className="w-32 text-right"
                            value={value}
                            onChange={(e) => setPriceEdits((s) => ({ ...s, [t.id]: e.target.value }))}
                          />
                          {!dirty && <Badge tone="gray">saved</Badge>}
                        </div>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <Button size="sm" onClick={() => saveLab(t.id, t.name)} disabled={!dirty} loading={saving === t.id}>
                          <Save size={12} /> Save
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Card>
      )}
    </>
  );
}

function TabButton({
  active, onClick, icon, children,
}: { active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 border-b-2 px-1 py-3 text-sm font-medium transition-colors',
        active ? 'border-brand-500 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-700',
      )}
    >
      {icon}{children}
    </button>
  );
}
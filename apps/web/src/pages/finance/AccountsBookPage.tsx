import { useState } from 'react';
import { Plus, ArrowUpCircle, ArrowDownCircle, RefreshCw, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { PageHeader } from '@/components/ui/PageHeader';
import { Alert } from '@/components/ui/Alert';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { useBranches } from '@/hooks/useBranches';
import { useAccounts, useCreateAccountEntry } from '@/hooks/useFinance';

const ENTRY_TYPES = ['INCOME', 'EXPENSE', 'REFUND', 'ADJUSTMENT'] as const;
const PAYMENT_MODES = ['CASH', 'CARD', 'UPI', 'CHEQUE', 'NEFT_RTGS', 'INSURANCE', 'PACKAGE', 'CREDIT', 'OTHER'] as const;
const CATEGORIES = ['CONSULTATION', 'PHARMACY', 'LAB', 'IPD', 'BILLING', 'SALARY', 'UTILITY', 'EQUIPMENT', 'OTHER'];

const TONE_MAP: Record<string, 'green' | 'red' | 'blue' | 'gray'> = {
  INCOME: 'green', EXPENSE: 'red', REFUND: 'blue', ADJUSTMENT: 'gray',
};

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}
function fmtCurrency(n: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(n);
}

export function AccountsBookPage() {
  const branches = useBranches();
  const today = new Date().toISOString().split('T')[0]!;

  const [branchId, setBranchId] = useState('');
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [entryType, setEntryType] = useState('');
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading, isError } = useAccounts({
    branchId: branchId || undefined,
    startDate,
    endDate,
    entryType: entryType || undefined,
    category: category || undefined,
    page,
    pageSize: 50,
  });

  const createEntry = useCreateAccountEntry();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    entryType: 'INCOME' as typeof ENTRY_TYPES[number],
    category: 'BILLING',
    description: '',
    amount: '',
    paymentMode: 'CASH' as typeof PAYMENT_MODES[number],
    coverageType: '',
    referenceNo: '',
    entryDate: today,
    branchId: '',
  });
  const [formErr, setFormErr] = useState<string | null>(null);

  const activeBranch = branchId || branches.data?.[0]?.id || '';

  function resetForm() {
    setForm({ entryType: 'INCOME', category: 'BILLING', description: '', amount: '', paymentMode: 'CASH', coverageType: '', referenceNo: '', entryDate: today, branchId: activeBranch });
    setFormErr(null);
  }

  async function onSubmit() {
    setFormErr(null);
    if (!form.description.trim()) { setFormErr('Description is required'); return; }
    if (!form.amount || isNaN(Number(form.amount))) { setFormErr('Valid amount is required'); return; }
    const bId = form.branchId || activeBranch;
    if (!bId) { setFormErr('Select a branch'); return; }
    try {
      await createEntry.mutateAsync({
        branchId: bId,
        entryType: form.entryType,
        category: form.category,
        description: form.description,
        amount: Number(form.amount),
        paymentMode: form.paymentMode,
        coverageType: form.coverageType || null,
        referenceNo: form.referenceNo || null,
        entryDate: form.entryDate,
      });
      setOpen(false);
      resetForm();
    } catch (e: any) {
      setFormErr(e?.message ?? 'Failed to add entry');
    }
  }

  const rows = data?.rows ?? [];
  const totals = rows.reduce((acc, r) => {
    if (r.entry_type === 'INCOME') acc.income += r.amount;
    if (r.entry_type === 'EXPENSE') acc.expense += r.amount;
    if (r.entry_type === 'REFUND') acc.refund += r.amount;
    return acc;
  }, { income: 0, expense: 0, refund: 0 });

  return (
    <>
      <PageHeader
        title="Accounts Book"
        subtitle="Daily financial ledger — income, expenses, refunds, adjustments"
        action={
          <Button onClick={() => { resetForm(); setOpen(true); }}>
            <Plus size={16} /> New entry
          </Button>
        }
      />

      {/* Filters */}
      <div className="mb-5 flex flex-wrap items-end gap-3">
        <div className="w-44">
          <Select label="Branch" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
            <option value="">All branches</option>
            {branches.data?.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </Select>
        </div>
        <div>
          <Input label="From" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
        <div>
          <Input label="To" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>
        <div className="w-40">
          <Select label="Type" value={entryType} onChange={(e) => setEntryType(e.target.value)}>
            <option value="">All types</option>
            {ENTRY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </Select>
        </div>
        <div className="w-40">
          <Select label="Category" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">All categories</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
        </div>
      </div>

      {/* Summary cards */}
      <div className="mb-5 grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-emerald-600">
            <ArrowUpCircle size={14} /> Total Income
          </div>
          <div className="mt-1 text-2xl font-bold text-emerald-700">{fmtCurrency(totals.income)}</div>
        </div>
        <div className="rounded-xl border border-red-100 bg-red-50 p-4">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-red-600">
            <ArrowDownCircle size={14} /> Total Expenses
          </div>
          <div className="mt-1 text-2xl font-bold text-red-700">{fmtCurrency(totals.expense)}</div>
        </div>
        <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-blue-600">
            <RefreshCw size={14} /> Net Cash
          </div>
          <div className="mt-1 text-2xl font-bold text-blue-700">{fmtCurrency(totals.income - totals.expense - totals.refund)}</div>
        </div>
      </div>

      {isLoading && <div className="flex justify-center py-12"><Spinner size={28} /></div>}
      {isError && <Alert tone="error">Failed to load accounts.</Alert>}

      {!isLoading && rows.length === 0 && (
        <EmptyState
          title="No entries found"
          description="Add an income, expense, refund, or adjustment entry."
          action={<Button onClick={() => { resetForm(); setOpen(true); }}><Plus size={16} /> New entry</Button>}
        />
      )}

      {rows.length > 0 && (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3">Mode</th>
                <th className="px-4 py-3 text-right">Amount (₹)</th>
                <th className="px-4 py-3">Ref #</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5 text-slate-500 text-xs">{fmtDate(r.entry_date)}</td>
                  <td className="px-4 py-2.5">
                    <Badge tone={TONE_MAP[r.entry_type]}>{r.entry_type}</Badge>
                  </td>
                  <td className="px-4 py-2.5 text-slate-600 text-xs">{r.category}</td>
                  <td className="px-4 py-2.5 text-slate-800">{r.description}</td>
                  <td className="px-4 py-2.5">
                    <Badge tone="gray">{r.payment_mode}</Badge>
                  </td>
                  <td className={`px-4 py-2.5 text-right font-semibold ${
                    r.entry_type === 'INCOME' ? 'text-emerald-700' : 
                    r.entry_type === 'EXPENSE' ? 'text-red-600' : 'text-slate-700'
                  }`}>
                    {r.entry_type === 'EXPENSE' || r.entry_type === 'REFUND' ? '-' : '+'}
                    {fmtCurrency(r.amount)}
                  </td>
                  <td className="px-4 py-2.5 text-slate-400 text-xs font-mono">{r.reference_no ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {/* Create Entry Modal */}
      <Modal
        open={open}
        onClose={() => { setOpen(false); resetForm(); }}
        title="Add Accounts Entry"
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => { setOpen(false); resetForm(); }}>Cancel</Button>
            <Button onClick={onSubmit} loading={createEntry.isPending}>Save entry</Button>
          </>
        }
      >
        <div className="space-y-4">
          {formErr && <Alert tone="error">{formErr}</Alert>}
          <div className="grid grid-cols-2 gap-4">
            <Select label="Type *" value={form.entryType} onChange={(e) => setForm({ ...form, entryType: e.target.value as any })}>
              {ENTRY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </Select>
            <Select label="Category *" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
          </div>
          <Select label="Branch *" value={form.branchId || activeBranch} onChange={(e) => setForm({ ...form, branchId: e.target.value })}>
            {branches.data?.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </Select>
          <Input label="Description *" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="e.g. OPD consultation revenue" />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Amount (₹) *" type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0.00" />
            <Input label="Date" type="date" value={form.entryDate} onChange={(e) => setForm({ ...form, entryDate: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Select label="Payment Mode *" value={form.paymentMode} onChange={(e) => setForm({ ...form, paymentMode: e.target.value as any })}>
              {PAYMENT_MODES.map((m) => <option key={m} value={m}>{m}</option>)}
            </Select>
            <Input label="Reference / Receipt #" value={form.referenceNo} onChange={(e) => setForm({ ...form, referenceNo: e.target.value })} placeholder="TXN12345" />
          </div>
        </div>
      </Modal>
    </>
  );
}

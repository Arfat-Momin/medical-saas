import { useState } from 'react';
import { Lock, CheckCircle, TrendingUp, TrendingDown, DollarSign, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Card, CardBody } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { PageHeader } from '@/components/ui/PageHeader';
import { Alert } from '@/components/ui/Alert';
import { Spinner } from '@/components/ui/Spinner';
import { Badge } from '@/components/ui/Badge';
import { useBranches } from '@/hooks/useBranches';
import { useCashClosing, useUpdateCashClosing, useCloseCashDay } from '@/hooks/useFinance';

function fmtCurrency(n: number | null) {
  if (n === null || n === undefined) return '₹—';
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(n);
}

export function CashClosingPage() {
  const branches = useBranches();
  const today = new Date().toISOString().split('T')[0]!;

  const [branchId, setBranchId] = useState('');
  const [date, setDate] = useState(today);

  const activeBranch = branchId || branches.data?.[0]?.id || '';
  const { data: closing, isLoading, isError, refetch } = useCashClosing(activeBranch, date);

  const updateClosing = useUpdateCashClosing();
  const closeDay = useCloseCashDay();

  const [actualCash, setActualCash] = useState('');
  const [notes, setNotes] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [editErr, setEditErr] = useState<string | null>(null);

  // Sync form values from fetched data
  const displayActualCash = actualCash !== '' ? actualCash : String(closing?.actual_cash ?? '');

  async function onSaveActual() {
    setEditErr(null);
    if (!activeBranch) { setEditErr('Select a branch'); return; }
    if (!actualCash || isNaN(Number(actualCash))) { setEditErr('Enter a valid cash amount'); return; }
    try {
      await updateClosing.mutateAsync({
        branchId: activeBranch,
        closingDate: date,
        actualCash: Number(actualCash),
        notes: notes || null,
      });
    } catch (e: any) {
      setEditErr(e?.message ?? 'Failed to update');
    }
  }

  async function onConfirmClose() {
    if (!closing?.id) return;
    try {
      await closeDay.mutateAsync(closing.id);
      setConfirmOpen(false);
    } catch (e: any) {
      setEditErr(e?.message ?? 'Failed to close day');
    }
  }

  const isClosed = closing?.status === 'CLOSED';
  const difference = closing?.difference;
  const hasShortage = difference !== null && difference !== undefined && difference < 0;
  const hasExcess = difference !== null && difference !== undefined && difference > 0;

  return (
    <>
      <PageHeader
        title="Cash Day Closing"
        subtitle="Reconcile and close the cash register for a given date"
      />

      <div className="mb-6 flex flex-wrap items-end gap-4">
        <div className="w-44">
          <Select label="Branch" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
            {branches.data?.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </Select>
        </div>
        <div>
          <Input label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
      </div>

      {isLoading && <div className="flex justify-center py-12"><Spinner size={28} /></div>}
      {isError && <Alert tone="error">Failed to load cash closing data.</Alert>}

      {closing && (
        <>
          {/* Status badge */}
          <div className="mb-4 flex items-center gap-3">
            <Badge tone={isClosed ? 'green' : 'blue'}>
              {isClosed ? '✓ Day Closed' : '● Open'}
            </Badge>
            {isClosed && closing.closed_at && (
              <span className="text-xs text-slate-500">
                Closed at {new Date(closing.closed_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>

          {/* Summary grid */}
          <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <SummaryCard
              label="Opening Balance"
              value={fmtCurrency(closing.opening_balance)}
              icon={<DollarSign size={18} className="text-slate-500" />}
              tone="slate"
            />
            <SummaryCard
              label="Cash Receipts"
              value={fmtCurrency(closing.cash_receipts)}
              icon={<TrendingUp size={18} className="text-emerald-600" />}
              tone="emerald"
            />
            <SummaryCard
              label="Cash Expenses"
              value={fmtCurrency(closing.cash_expenses + closing.cash_refunds)}
              icon={<TrendingDown size={18} className="text-red-500" />}
              tone="red"
            />
            <SummaryCard
              label="Expected Cash"
              value={fmtCurrency(closing.expected_cash)}
              icon={<DollarSign size={18} className="text-blue-500" />}
              tone="blue"
            />
          </div>

          {/* Actual cash input + difference */}
          <Card>
            <CardBody className="space-y-5">
              <h3 className="text-sm font-semibold text-slate-700">Physical Cash Count</h3>

              {editErr && <Alert tone="error">{editErr}</Alert>}

              {hasShortage && (
                <Alert tone="error">
                  <span className="flex items-center gap-2">
                    <AlertTriangle size={16} /> Shortage of {fmtCurrency(Math.abs(difference!))}
                  </span>
                </Alert>
              )}
              {hasExcess && (
                <Alert tone="info">
                  <span>Excess of {fmtCurrency(difference!)} in cash</span>
                </Alert>
              )}

              {!isClosed ? (
                <>
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <Input
                        label="Actual Cash on Hand (₹)"
                        type="number"
                        value={displayActualCash}
                        onChange={(e) => setActualCash(e.target.value)}
                        placeholder="Count the physical cash"
                      />
                    </div>
                    <div className="flex-1">
                      <Input
                        label="Notes"
                        value={notes || closing.notes || ''}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Any remarks..."
                      />
                    </div>
                  </div>

                  {closing.actual_cash !== null && (
                    <div className="rounded-lg border p-3 text-sm">
                      <span className="text-slate-500">Difference: </span>
                      <span className={`font-bold ${hasShortage ? 'text-red-600' : hasExcess ? 'text-yellow-600' : 'text-emerald-600'}`}>
                        {fmtCurrency(closing.difference)}
                      </span>
                    </div>
                  )}

                  <div className="flex gap-3">
                    <Button variant="secondary" onClick={onSaveActual} loading={updateClosing.isPending}>
                      Save count
                    </Button>
                    <Button
                      onClick={() => setConfirmOpen(true)}
                      disabled={closing.actual_cash === null}
                    >
                      <Lock size={14} /> Close Day
                    </Button>
                  </div>
                </>
              ) : (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                  <div className="flex items-center gap-2 text-emerald-700 font-medium">
                    <CheckCircle size={18} /> Day successfully closed
                  </div>
                  <div className="mt-2 text-sm text-slate-600">
                    Actual cash counted: <span className="font-semibold">{fmtCurrency(closing.actual_cash)}</span>
                    {' · '}
                    Difference: <span className={`font-semibold ${hasShortage ? 'text-red-600' : hasExcess ? 'text-yellow-600' : 'text-emerald-600'}`}>{fmtCurrency(closing.difference)}</span>
                  </div>
                  {closing.notes && <p className="mt-1 text-xs text-slate-500">Notes: {closing.notes}</p>}
                </div>
              )}
            </CardBody>
          </Card>
        </>
      )}

      {/* Confirm close modal */}
      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Confirm Day Close"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button onClick={onConfirmClose} loading={closeDay.isPending}>Yes, Close Day</Button>
          </>
        }
      >
        <Alert tone="error">
          Once the day is closed, it cannot be re-opened. The next day's opening balance will automatically be set to today's actual cash amount.
        </Alert>
      </Modal>
    </>
  );
}

function SummaryCard({ label, value, icon, tone }: {
  label: string;
  value: string;
  icon: React.ReactNode;
  tone: 'slate' | 'emerald' | 'red' | 'blue';
}) {
  const bg: Record<string, string> = {
    slate: 'bg-slate-50 border-slate-200',
    emerald: 'bg-emerald-50 border-emerald-100',
    red: 'bg-red-50 border-red-100',
    blue: 'bg-blue-50 border-blue-100',
  };
  return (
    <div className={`rounded-xl border p-4 ${bg[tone]}`}>
      <div className="mb-1 flex items-center gap-1.5 text-xs text-slate-500">{icon}{label}</div>
      <div className="text-xl font-bold text-slate-800">{value}</div>
    </div>
  );
}

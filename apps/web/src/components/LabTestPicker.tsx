import { useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import { useLabTests } from '@/hooks/useLaboratory';
import type { LabTestData } from '@/db/schema';
import { cn } from '@/lib/cn';

interface Props {
  value: LabTestData[];
  onChange: (tests: LabTestData[]) => void;
  disabled?: boolean;
}

export function LabTestPicker({ value, onChange, disabled }: Props) {
  const tests = useLabTests({ pageSize: 100 });
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);

  const selectedIds = useMemo(() => new Set(value.map((t) => t.testId)), [value]);

  const filtered = useMemo(() => {
    const all = tests.data?.rows ?? [];
    if (!search.trim()) return all.slice(0, 100);
    const s = search.trim().toLowerCase();
    return all
      .filter(
        (t) =>
          t.name.toLowerCase().includes(s) ||
          (t.code ?? '').toLowerCase().includes(s) ||
          (t.category ?? '').toLowerCase().includes(s),
      )
      .slice(0, 100);
  }, [tests.data, search]);

  function toggleTest(t: any) {
    if (disabled) return;
    if (selectedIds.has(t.id)) {
      onChange(value.filter((x) => x.testId !== t.id));
    } else {
      onChange([
        ...value,
        {
          testId: t.id,
          testCode: t.code ?? null,
          testName: t.name,
          sampleType: t.sample_type ?? null,
          price: Number(t.price ?? 0),
          referenceText:
            t.reference_text ??
            (t.reference_min != null && t.reference_max != null
              ? `${t.reference_min} - ${t.reference_max} ${t.unit ?? ''}`
              : null),
        },
      ]);
    }
  }

  return (
    <div className="space-y-3">
      {/* Selected tests */}
      {value.length > 0 && (
        <div className="space-y-2">
          {value.map((t) => (
            <div
              key={t.testId}
              className="flex items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-900">{t.testName}</p>
                <p className="truncate text-xs text-slate-500">
                  {t.sampleType && t.sampleType}
                  {t.referenceText && ` - Ref: ${t.referenceText}`}
                </p>
              </div>
              {!disabled && (
                <button
                  type="button"
                  onClick={() => onChange(value.filter((x) => x.testId !== t.testId))}
                  className="shrink-0 rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-500"
                  title="Remove"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Picker toggle */}
      {!disabled && (
        <>
          {!open ? (
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="w-full rounded-md border border-dashed border-slate-300 px-3 py-2 text-sm text-slate-600 hover:border-brand-400 hover:bg-brand-50 hover:text-brand-700"
            >
              + Add lab test
            </button>
          ) : (
            <div className="rounded-md border border-slate-200 bg-white">
              {/* Search bar */}
              <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2">
                <Search size={14} className="text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by test name, code or category"
                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    setSearch('');
                  }}
                  className="rounded p-1 text-slate-400 hover:bg-slate-100"
                >
                  <X size={14} />
                </button>
              </div>

              {/* Test list */}
              <div className="max-h-64 overflow-y-auto">
                {tests.isLoading && (
                  <p className="p-3 text-center text-xs text-slate-500">Loading tests...</p>
                )}
                {tests.isError && (
                  <div className="p-3 text-center text-xs text-red-600">
                    <p className="font-medium">Failed to load tests</p>
                    <p className="mt-1 text-[11px] text-red-500">
                      {(tests.error as any)?.message ?? 'Check your connection'}
                    </p>
                  </div>
                )}
                {tests.data && filtered.length === 0 && (
                  <p className="p-3 text-center text-xs text-slate-500">
                    {search ? `No tests match "${search}"` : 'No tests in catalog yet.'}
                  </p>
                )}
                {filtered.map((t) => {
                  const isSelected = selectedIds.has(t.id);
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => toggleTest(t)}
                      className={cn(
                        'flex w-full items-center gap-3 border-b border-slate-50 px-3 py-2 text-left last:border-0',
                        isSelected ? 'bg-brand-50' : 'hover:bg-slate-50',
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        readOnly
                        className="h-4 w-4 shrink-0 rounded border-slate-300 text-brand-600"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-900">{t.name}</p>
                        <p className="truncate text-xs text-slate-500">
                          {t.category && t.category}
                          {t.sample_type && ` - ${t.sample_type}`}
                          {t.code && ` - ${t.code}`}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {disabled && value.length === 0 && (
        <p className="text-xs italic text-slate-500">No lab tests ordered.</p>
      )}
    </div>
  );
}

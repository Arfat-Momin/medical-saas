import { useEffect, useRef, useState } from 'react';
import { Search, X, AlertCircle } from 'lucide-react';
import { useMedicines } from '@/hooks/usePharmacy';

interface Props {
  value: string;
  onChange: (name: string, meta?: { id?: string; category?: string | null; unit?: string | null }) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function MedicinePicker({ value, onChange, disabled, placeholder }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Debounce search
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 200);
    return () => clearTimeout(t);
  }, [search]);

  // Keep in sync with outer value
  useEffect(() => {
    if (value !== search) setSearch(value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const meds = useMedicines({ search: debounced, pageSize: 50 });
  const results = meds.data?.rows ?? [];

  // Log for debugging// Close on outside click
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  function selectMed(m: any) {
    onChange(m.name, { id: m.id, category: m.category, unit: m.unit });
    setSearch(m.name);
    setOpen(false);
  }

  function clear() {
    onChange('');
    setSearch('');
    setOpen(false);
    inputRef.current?.focus();
  }

  return (
    <div ref={wrapperRef}>
      <label className="mb-1 block text-[11px] uppercase tracking-wide text-slate-600">
        Medicine
      </label>

      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          disabled={disabled}
          placeholder={placeholder ?? 'Search medicine...'}
          className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 pl-9 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:bg-slate-50 disabled:text-slate-500"
          autoComplete="off"
        />
        <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        {search && !disabled && (
          <button
            type="button"
            onClick={clear}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:bg-slate-100"
            tabIndex={-1}
          >
            <X size={12} />
          </button>
        )}
      </div>

      {/* Inline dropdown — no portal, no positioning, just shows below */}
      {open && !disabled && (
        <div className="mt-1 overflow-hidden rounded-md border border-slate-200 bg-white shadow-lg">
          <div className="max-h-56 overflow-y-auto">
            {meds.isLoading && (
              <p className="p-3 text-center text-xs text-slate-500">Searching...</p>
            )}

            {!meds.isLoading && meds.isError && (
              <div className="flex items-center gap-2 p-3 text-xs text-red-600">
                <AlertCircle size={14} />
                <div>
                  <p className="font-medium">Failed to load medicines</p>
                  <p className="mt-0.5 text-[11px] text-red-500">
                    {(meds.error as any)?.message ?? 'Check your connection'}
                  </p>
                </div>
              </div>
            )}

            {!meds.isLoading && !meds.isError && results.length === 0 && (
              <p className="p-3 text-center text-xs text-slate-500">
                {debounced ? `No medicines match "${debounced}"` : 'Type to search the catalog'}
              </p>
            )}

            {!meds.isLoading && !meds.isError && results.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => selectMed(m)}
                className="flex w-full items-center gap-3 border-b border-slate-50 px-3 py-2 text-left last:border-0 hover:bg-brand-50"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900">{m.name}</p>
                  <p className="truncate text-xs text-slate-500">
                    {m.category ?? 'General'}
                    {m.unit && ` - ${m.unit}`}
                    {m.generic_name && ` - ${m.generic_name}`}
                  </p>
                </div>
              </button>
            ))}
          </div>

          {results.length > 0 && (
            <div className="border-t border-slate-100 bg-slate-50 px-3 py-1.5 text-[10px] text-slate-500">
              {results.length} medicine{results.length === 1 ? '' : 's'}
            </div>
          )}
        </div>
      )}
    </div>
  );
}


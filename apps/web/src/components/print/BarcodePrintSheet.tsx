import { BarcodeLabel } from './BarcodeLabel';

interface Props {
  organizationName?: string | null;
  medicines: Array<{
    id: string;
    name: string;
    barcode: string | null;
    generic_name?: string | null;
  }>;
}

export function BarcodePrintSheet({ organizationName, medicines }: Props) {
  const valid = medicines.filter((m) => !!m.barcode);

  return (
    <div className="text-slate-900">
      <div className="mb-4 border-b-2 border-slate-800 pb-2">
        <h1 className="text-lg font-bold">
          {organizationName ?? 'Hospital'} — Medicine Barcodes
        </h1>
        <p className="text-xs text-slate-600">
          Scan these labels in the Pharmacy Queue to dispense. Total: {valid.length} label(s).
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {valid.map((m) => (
          <div
            key={m.id}
            className="flex flex-col items-center rounded border border-slate-300 p-2"
          >
            <BarcodeLabel
              value={m.barcode!}
              width={1.4}
              height={45}
              fontSize={11}
            />
            <p className="mt-1 text-center text-[10px] font-medium leading-tight">
              {m.name.length > 34 ? m.name.slice(0, 34) + '…' : m.name}
            </p>
          </div>
        ))}
      </div>

      {valid.length === 0 && (
        <p className="py-8 text-center text-sm text-slate-500">
          No barcodes to print for the current filter.
        </p>
      )}
    </div>
  );
}
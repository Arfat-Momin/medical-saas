import type { ReactNode } from "react";

export const inputClass =
  "w-full rounded-xl border border-stone-300/90 bg-white px-3.5 py-3 text-[15px] text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] outline-none transition placeholder:text-slate-400 focus:border-teal-600 focus:ring-[3px] focus:ring-teal-600/15";

export function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <div className="block">
      <label htmlFor={htmlFor} className="mb-1.5 block text-[13px] font-medium text-slate-700">
        {label}
      </label>
      {children}
    </div>
  );
}

export function Alert({ children }: { children: ReactNode }) {
  return (
    <div
      role="alert"
      className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-[13px] leading-relaxed text-rose-800"
    >
      {children}
    </div>
  );
}

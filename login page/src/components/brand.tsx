import Link from "next/link";

export function BrandMark({ size = 40 }: { size?: number }) {
  return (
    <span
      className="relative grid place-items-center rounded-[13px] bg-gradient-to-br from-[#2dd4bf] to-[#0f766e] shadow-[0_10px_24px_rgba(13,148,136,0.38)]"
      style={{ width: size, height: size }}
      aria-hidden
    >
      <svg viewBox="0 0 24 24" className="h-[54%] w-[54%] text-white" fill="none">
        <path
          d="M12 5v14M5 12h14"
          stroke="currentColor"
          strokeWidth="2.7"
          strokeLinecap="round"
        />
        <path
          d="M8.5 12h0.2M15.3 12h0.2"
          stroke="currentColor"
          strokeWidth="2.7"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}

export function Brand({
  light = false,
  href = "/",
  compact = false,
}: {
  light?: boolean;
  href?: string;
  compact?: boolean;
}) {
  return (
    <Link href={href} className="group inline-flex items-center gap-3">
      <BrandMark size={compact ? 34 : 40} />
      <span className="leading-tight">
        <span
          className={`block text-[17px] font-semibold tracking-[-0.03em] ${
            light ? "text-white" : "text-slate-950"
          }`}
        >
          Med SaaS
        </span>
        {!compact ? (
          <span
            className={`block text-[10px] font-medium uppercase tracking-[0.22em] ${
              light ? "text-teal-100/80" : "text-teal-800/70"
            }`}
          >
            Clinical OS
          </span>
        ) : null}
      </span>
    </Link>
  );
}

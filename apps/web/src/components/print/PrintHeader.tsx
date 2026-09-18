interface Props {
  organization?: {
    name?: string | null;
    legal_name?: string | null;
    address?: string | null;
    city?: string | null;
    state?: string | null;
    pincode?: string | null;
    phone?: string | null;
    email?: string | null;
  } | null;
  title: string;
  subtitle?: string;
}

export function PrintHeader({ organization, title, subtitle }: Props) {
  const org = organization ?? {};
  const addressLine = [org.address, org.city, org.state, org.pincode].filter(Boolean).join(', ');

  return (
    <div className="mb-6 flex flex-col gap-4 border-b-2 border-ink-900 pb-4 md:mb-8 md:flex-row md:items-start md:justify-between md:gap-6">
      <div className="flex items-start gap-3">
        <div className="print-banner flex h-12 w-12 items-center justify-center rounded-xl bg-brand-800 text-white">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 21h18" />
            <path d="M5 21V7l8-4v18" />
            <path d="M19 21V11l-6-4" />
            <path d="M9 9h.01" />
            <path d="M9 12h.01" />
            <path d="M9 15h.01" />
            <path d="M9 18h.01" />
          </svg>
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-bold tracking-tight text-ink-900">{org.name ?? 'Hospital'}</h1>
          {org.legal_name && <p className="mt-0.5 text-[11px] text-ink-500">{org.legal_name}</p>}
          {addressLine && <p className="mt-1 text-[11px] text-ink-600">{addressLine}</p>}
          <p className="mt-0.5 text-[11px] text-ink-600">
            {org.phone && `Phone: ${org.phone}`}
            {org.phone && org.email && ' · '}
            {org.email && `Email: ${org.email}`}
          </p>
        </div>
      </div>

      <div className="shrink-0 md:text-right">
        <div className="print-banner inline-block rounded-md bg-brand-800 px-6 py-2">
          <h2 className="text-xl font-extrabold uppercase tracking-widest text-white">{title}</h2>
        </div>
        {subtitle && <p className="mt-2 text-[11px] text-ink-500">{subtitle}</p>}
      </div>
    </div>
  );
}
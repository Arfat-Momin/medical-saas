import Image from "next/image";
import type { ReactNode } from "react";
import { Brand } from "@/components/brand";

const stats = [
  { value: "12.4k", label: "Clinicians" },
  { value: "4.8M", label: "Records" },
  { value: "99.99%", label: "Uptime" },
];

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F3F0EA] lg:grid lg:grid-cols-2">
      <BrandPanel />
      <div className="relative flex min-h-screen flex-col">{children}</div>
    </div>
  );
}

function BrandPanel() {
  return (
    <aside className="relative hidden min-h-screen overflow-hidden lg:block">
      <Image
        src="/images/clinic-hero.jpg"
        alt="Sunlit atrium of a Med SaaS partner hospital"
        fill
        priority
        sizes="50vw"
        className="object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-[#061018] via-[#061018]/62 to-[#061018]/25" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(45,212,191,0.18),transparent_46%)]" />

      <div className="relative flex h-full min-h-screen flex-col justify-between p-10 xl:p-14">
        <div className="flex items-center justify-between">
          <Brand light />
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[11px] font-medium tracking-wide text-teal-50 backdrop-blur-md">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]" />
            Encrypted session
          </span>
        </div>

        <div className="max-w-xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-teal-200/90">
            Care coordination, refined
          </p>
          <h1 className="mt-5 font-serif text-[3.15rem] leading-[1.05] tracking-[-0.03em] text-white xl:text-[3.6rem]">
            Clinical intelligence for teams who refuse to compromise on care.
          </h1>
          <p className="mt-5 max-w-md text-[15px] leading-relaxed text-slate-200/85">
            One calm workspace for rounds, orders, and follow-ups — built for hospitals,
            specialty groups, and modern practices.
          </p>

          <dl className="mt-10 grid max-w-md grid-cols-3 gap-6 border-t border-white/10 pt-8">
            {stats.map((stat) => (
              <div key={stat.label}>
                <dt className="text-[11px] uppercase tracking-[0.18em] text-slate-300/80">
                  {stat.label}
                </dt>
                <dd className="mt-1 font-serif text-[1.85rem] text-white">{stat.value}</dd>
              </div>
            ))}
          </dl>
        </div>

          <figure className="max-w-lg rounded-2xl border border-white/10 bg-white/10 p-5 backdrop-blur-xl">
          <blockquote className="text-[15px] leading-relaxed text-slate-100/95">
            “Med SaaS gave our cardiology group a single source of truth — rounds, orders,
            and follow-ups finally live in one quiet, reliable workspace.”
          </blockquote>
          <figcaption className="mt-4 flex items-center gap-3">
            <Image
              src="/images/physician.jpg"
              alt="Dr. Amelia Chen"
              width={44}
              height={44}
              className="h-11 w-11 rounded-full object-cover ring-2 ring-white/30"
            />
            <div>
              <p className="text-sm font-semibold text-white">Dr. Amelia Chen</p>
              <p className="text-xs text-slate-300">Chief Medical Officer, Northwell</p>
            </div>
          </figcaption>
        </figure>
      </div>
    </aside>
  );
}

export function AuthMobileHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <div className="relative isolate overflow-hidden bg-[#071018] px-6 pb-9 pt-7 lg:hidden">
      <Image
        src="/images/pulse-pattern.jpg"
        alt=""
        fill
        priority
        className="object-cover opacity-55"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[#F3F0EA]" />
      <div className="relative">
        <Brand light compact />
        <h1 className="mt-7 font-serif text-[2.15rem] leading-tight text-white">{title}</h1>
        <p className="mt-2 max-w-sm text-sm text-slate-200/85">{subtitle}</p>
      </div>
    </div>
  );
}

export function AuthFooter() {
  return (
    <p className="mt-auto px-6 pb-6 pt-8 text-center text-[11px] leading-relaxed text-slate-500 lg:px-10">
      HIPAA · SOC 2 Type II · HITRUST · AES-256 at rest · TLS 1.3 in transit
      <span className="mt-1 block text-slate-400">© 2026 Med SaaS. All rights reserved.</span>
    </p>
  );
}

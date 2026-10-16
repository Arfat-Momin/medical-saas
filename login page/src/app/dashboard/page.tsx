import type { Metadata } from "next";
import type { ReactNode } from "react";
import { desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import {
  Activity,
  Bell,
  CalendarClock,
  HeartPulse,
  LogOut,
  ShieldCheck,
  Users,
} from "lucide-react";
import { Brand } from "@/components/brand";
import { db } from "@/db";
import { appointments, loginEvents, patients } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { ensureSeed } from "@/lib/seed";
import { logoutAction } from "./actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Workspace",
};

export default async function DashboardPage() {
  await ensureSeed();
  const user = await getCurrentUser();
  if (!user) redirect("/");

  const [census, schedule, events] = await Promise.all([
    db.select().from(patients),
    db.select().from(appointments).orderBy(appointments.scheduledAt),
    db
      .select()
      .from(loginEvents)
      .where(eq(loginEvents.userId, user.id))
      .orderBy(desc(loginEvents.createdAt))
      .limit(5),
  ]);

  const critical = census.filter((patient) => patient.status === "critical").length;
  const observation = census.filter((patient) => patient.status === "observation").length;
  const greeting = greetingFor(new Date());
  const firstName = user.fullName.replace(/^Dr\.\s+/, "").split(" ")[0];

  return (
    <div className="min-h-screen bg-[#F3F0EA]">
      <header className="border-b border-stone-200/80 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <Brand compact href="/dashboard" />
          <div className="hidden items-center gap-2 rounded-full border border-stone-200 bg-stone-50 px-3 py-1.5 text-[12px] text-slate-600 md:flex">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            {user.organization}
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-[13px] font-semibold text-slate-900">{user.fullName}</p>
              <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">
                {user.title ?? user.role}
              </p>
            </div>
            <div className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-teal-600 to-teal-900 text-sm font-semibold text-white">
              {initials(user.fullName)}
            </div>
            <form action={logoutAction}>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-white px-3 py-2 text-[13px] font-medium text-slate-700 transition hover:border-stone-300 hover:bg-stone-50"
              >
                <LogOut className="h-3.5 w-3.5" />
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-8 sm:px-8 sm:py-10">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-[0.22em] text-teal-800">
              Clinical workspace
            </p>
            <h1 className="mt-2 font-serif text-[2.4rem] leading-none tracking-[-0.03em] text-slate-950">
              {greeting}, {firstName}
            </h1>
            <p className="mt-3 text-[15px] text-slate-600">
              {user.specialty ?? "Care team"} · {formatLongDate(new Date())}
            </p>
          </div>
          <p className="inline-flex items-center gap-2 self-start rounded-full border border-teal-200 bg-teal-50 px-3 py-1.5 text-[12px] font-medium text-teal-900">
            <ShieldCheck className="h-3.5 w-3.5" />
            Session audited
          </p>
        </div>

        <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            icon={<Users className="h-4 w-4" />}
            label="Active census"
            value={String(census.length)}
            hint="Across tracked units"
          />
          <StatCard
            icon={<CalendarClock className="h-4 w-4" />}
            label="Today’s board"
            value={String(schedule.length)}
            hint="Appointments remaining"
          />
          <StatCard
            icon={<HeartPulse className="h-4 w-4" />}
            label="Critical"
            value={String(critical)}
            hint="Requires attending review"
            tone="alert"
          />
          <StatCard
            icon={<Activity className="h-4 w-4" />}
            label="Observation"
            value={String(observation)}
            hint="Step-down monitoring"
          />
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-3xl border border-stone-200 bg-white p-6 shadow-[0_20px_50px_rgba(15,23,42,0.06)]">
            <div className="flex items-center justify-between">
              <h2 className="text-[15px] font-semibold text-slate-950">Today’s schedule</h2>
              <span className="text-[12px] text-slate-500">{schedule.length} visits</span>
            </div>
            <ul className="mt-5 divide-y divide-stone-100">
              {schedule.map((visit) => (
                <li key={visit.id} className="flex items-center justify-between gap-4 py-3.5 first:pt-0">
                  <div>
                    <p className="text-[14px] font-medium text-slate-900">{visit.patientName}</p>
                    <p className="text-[13px] text-slate-500">{visit.reason}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[13px] font-semibold text-slate-800">
                      {formatTime(visit.scheduledAt)}
                    </p>
                    <StatusPill status={visit.status} />
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-6">
            <div className="rounded-3xl border border-stone-200 bg-white p-6 shadow-[0_20px_50px_rgba(15,23,42,0.06)]">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-teal-800" />
                <h2 className="text-[15px] font-semibold text-slate-950">Unit census</h2>
              </div>
              <ul className="mt-5 space-y-3">
                {census.slice(0, 6).map((patient) => (
                  <li key={patient.id} className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[14px] font-medium text-slate-900">{patient.fullName}</p>
                      <p className="text-[12px] text-slate-500">
                        {patient.mrn} · {patient.department}
                      </p>
                    </div>
                    <StatusPill status={patient.status} />
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-3xl border border-stone-200 bg-[#0B1620] p-6 text-white shadow-[0_20px_50px_rgba(15,23,42,0.12)]">
              <h2 className="text-[15px] font-semibold">Recent access</h2>
              <p className="mt-1 text-[12px] text-slate-400">HIPAA audit trail for this account</p>
              <ul className="mt-5 space-y-3">
                {events.length === 0 ? (
                  <li className="text-[13px] text-slate-400">No events yet.</li>
                ) : (
                  events.map((event) => (
                    <li key={event.id} className="flex items-center justify-between text-[13px]">
                      <span className={event.success ? "text-emerald-300" : "text-rose-300"}>
                        {event.success ? "Signed in" : "Failed attempt"}
                      </span>
                      <span className="text-slate-400">{formatTime(event.createdAt)}</span>
                    </li>
                  ))
                )}
              </ul>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  hint: string;
  tone?: "alert";
}) {
  return (
    <article className="rounded-3xl border border-stone-200 bg-white p-5 shadow-[0_16px_40px_rgba(15,23,42,0.05)]">
      <div className="flex items-center justify-between">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-teal-50 text-teal-800">
          {icon}
        </span>
        {tone === "alert" ? (
          <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-rose-700">
            Review
          </span>
        ) : null}
      </div>
      <p className="mt-4 text-[12px] font-medium uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-1 font-serif text-[2.2rem] leading-none text-slate-950">{value}</p>
      <p className="mt-2 text-[12px] text-slate-500">{hint}</p>
    </article>
  );
}

function StatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    stable: "bg-emerald-50 text-emerald-800",
    recovery: "bg-sky-50 text-sky-800",
    observation: "bg-amber-50 text-amber-800",
    critical: "bg-rose-50 text-rose-800",
    scheduled: "bg-stone-100 text-slate-700",
    "checked-in": "bg-teal-50 text-teal-800",
  };

  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ${
        styles[status] ?? "bg-stone-100 text-slate-700"
      }`}
    >
      {status.replace("-", " ")}
    </span>
  );
}

function initials(name: string) {
  return name
    .replace(/^Dr\.\s+/, "")
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function greetingFor(date: Date) {
  const hour = date.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function formatTime(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatLongDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(date);
}

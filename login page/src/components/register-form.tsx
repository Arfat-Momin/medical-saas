"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { Alert, Field, inputClass } from "@/components/field";

const roles = [
  { value: "clinician", label: "Clinician" },
  { value: "nurse", label: "Nurse" },
  { value: "admin", label: "Practice admin" },
  { value: "specialist", label: "Specialist" },
  { value: "billing", label: "Billing" },
];

export function RegisterForm() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [organization, setOrganization] = useState("");
  const [role, setRole] = useState("clinician");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (fullName.trim().length < 2) {
      setError("Please enter your full name.");
      return;
    }
    if (!email.includes("@")) {
      setError("Enter a valid work email.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (!accepted) {
      setError("Please accept the terms of use and BAA to continue.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName, email, password, organization, role }),
      });
      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        setError(data.error ?? "Unable to create your workspace.");
        setLoading(false);
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="w-full max-w-[420px] animate-fade-up">
      <div className="hidden lg:block">
        <p className="text-[12px] font-semibold uppercase tracking-[0.22em] text-teal-800">
          Open a workspace
        </p>
        <h2 className="mt-2 font-serif text-[2.2rem] leading-none tracking-[-0.03em] text-slate-950">
          Create your Med SaaS account
        </h2>
        <p className="mt-3 text-[15px] leading-relaxed text-slate-600">
          For clinicians and operators who want a quieter, more precise EHR companion.
        </p>
      </div>

      {error ? (
        <div className="mt-6">
          <Alert>{error}</Alert>
        </div>
      ) : null}

      <div className={`${error ? "mt-5" : "mt-8"} space-y-4`}>
        <Field label="Full name" htmlFor="fullName">
          <input
            id="fullName"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            placeholder="Dr. Jordan Hale"
            className={inputClass}
            autoComplete="name"
            required
          />
        </Field>

        <Field label="Work email" htmlFor="register-email">
          <input
            id="register-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@clinic.org"
            className={inputClass}
            autoComplete="email"
            required
          />
        </Field>

        <Field label="Organization" htmlFor="organization">
          <input
            id="organization"
            value={organization}
            onChange={(event) => setOrganization(event.target.value)}
            placeholder="Northwell Clinical Group"
            className={inputClass}
            autoComplete="organization"
          />
        </Field>

        <Field label="Role" htmlFor="role">
          <select
            id="role"
            value={role}
            onChange={(event) => setRole(event.target.value)}
            className={inputClass}
          >
            {roles.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Password" htmlFor="register-password">
            <input
              id="register-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="8+ characters"
              className={inputClass}
              autoComplete="new-password"
              required
            />
          </Field>
          <Field label="Confirm" htmlFor="confirm">
            <input
              id="confirm"
              type="password"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              placeholder="Repeat password"
              className={inputClass}
              autoComplete="new-password"
              required
            />
          </Field>
        </div>
      </div>

      <label className="mt-5 flex cursor-pointer items-start gap-2.5 text-[13px] leading-relaxed text-slate-600">
        <input
          type="checkbox"
          checked={accepted}
          onChange={(event) => setAccepted(event.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-stone-300 accent-teal-700"
        />
        I agree to the Terms of Use and Business Associate Agreement for protected health information.
      </label>

      <button
        type="submit"
        disabled={loading}
        className="group mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-teal-600 to-teal-800 px-4 py-3.5 text-[15px] font-semibold text-white shadow-[0_12px_24px_rgba(13,116,110,0.28)] transition hover:from-teal-500 hover:to-teal-700 disabled:opacity-70"
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Creating workspace…
          </>
        ) : (
          <>
            Create workspace
            <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
          </>
        )}
      </button>

      <p className="mt-6 text-center text-[13px] text-slate-600">
        Already have an account?{" "}
        <Link href="/" className="font-semibold text-teal-800 hover:text-teal-950">
          Sign in
        </Link>
      </p>
    </form>
  );
}

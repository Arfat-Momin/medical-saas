"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import { Alert, Field, inputClass } from "@/components/field";

export function ForgotForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!email.includes("@")) {
      setError("Enter a valid work email.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/auth/forgot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        setError(data.error ?? "Unable to send a reset link.");
        setLoading(false);
        return;
      }

      setSent(true);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="w-full max-w-[420px] animate-fade-up">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-teal-100 text-teal-800">
          <CheckCircle2 className="h-6 w-6" />
        </div>
        <h2 className="mt-5 font-serif text-[2.1rem] leading-none text-slate-950">Check your inbox</h2>
        <p className="mt-3 text-[15px] leading-relaxed text-slate-600">
          If an account exists for <span className="font-medium text-slate-900">{email}</span>, a
          password reset link is on its way. It expires in 30 minutes.
        </p>
        <Link
          href="/"
          className="mt-8 inline-flex items-center gap-2 text-[14px] font-semibold text-teal-800 hover:text-teal-950"
        >
          Return to sign in
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="w-full max-w-[420px] animate-fade-up">
      <div className="hidden lg:block">
        <p className="text-[12px] font-semibold uppercase tracking-[0.22em] text-teal-800">
          Account recovery
        </p>
        <h2 className="mt-2 font-serif text-[2.2rem] leading-none tracking-[-0.03em] text-slate-950">
          Reset your password
        </h2>
        <p className="mt-3 text-[15px] leading-relaxed text-slate-600">
          Enter the work email on your Med SaaS account. We’ll send a secure reset link.
        </p>
      </div>

      {error ? (
        <div className="mt-6">
          <Alert>{error}</Alert>
        </div>
      ) : null}

      <div className={error ? "mt-5" : "mt-8"}>
        <Field label="Work email" htmlFor="forgot-email">
          <input
            id="forgot-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@clinic.org"
            className={inputClass}
            autoComplete="email"
            required
          />
        </Field>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-teal-600 to-teal-800 px-4 py-3.5 text-[15px] font-semibold text-white shadow-[0_12px_24px_rgba(13,116,110,0.28)] transition hover:from-teal-500 hover:to-teal-700 disabled:opacity-70"
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Sending link…
          </>
        ) : (
          "Send reset link"
        )}
      </button>

      <p className="mt-6 text-center text-[13px] text-slate-600">
        Remembered it?{" "}
        <Link href="/" className="font-semibold text-teal-800 hover:text-teal-950">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}

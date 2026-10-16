"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import {
  ArrowRight,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { Alert, Field, inputClass } from "@/components/field";
import { DEMO_EMAIL, DEMO_PASSWORD } from "@/lib/demo";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setInfo("");

    if (!email.includes("@")) {
      setError("Enter a valid work email.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, remember }),
      });
      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        setError(data.error ?? "Unable to sign in.");
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

  function fillDemo() {
    setEmail(DEMO_EMAIL);
    setPassword(DEMO_PASSWORD);
    setError("");
    setInfo("Demo clinician loaded. Sign in to open the clinical workspace.");
  }

  return (
    <form onSubmit={onSubmit} className="w-full max-w-[420px] animate-fade-up">
      <div className="hidden lg:block">
        <p className="text-[12px] font-semibold uppercase tracking-[0.22em] text-teal-800">
          Welcome back
        </p>
        <h2 className="mt-2 font-serif text-[2.35rem] leading-none tracking-[-0.03em] text-slate-950">
          Sign in to Med SaaS
        </h2>
        <p className="mt-3 text-[15px] leading-relaxed text-slate-600">
          Access your clinical workspace, census, and care team.
        </p>
      </div>

      {error ? (
        <div className="mt-6">
          <Alert>{error}</Alert>
        </div>
      ) : null}

      {info && !error ? (
        <div className="mt-6 rounded-xl border border-teal-200 bg-teal-50 px-3.5 py-3 text-[13px] text-teal-900">
          {info}
        </div>
      ) : null}

      <div className={`${error || info ? "mt-5" : "mt-8"} space-y-4 lg:mt-8`}>
        <Field label="Work email" htmlFor="email">
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@clinic.org"
              className={`${inputClass} pl-10`}
              required
            />
          </div>
        </Field>

        <Field label="Password" htmlFor="password">
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter your password"
              className={`${inputClass} px-10`}
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 transition hover:text-slate-700"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </Field>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <label className="flex cursor-pointer items-center gap-2 text-[13px] text-slate-600">
          <input
            type="checkbox"
            checked={remember}
            onChange={(event) => setRemember(event.target.checked)}
            className="h-4 w-4 rounded border-stone-300 text-teal-700 accent-teal-700"
          />
          Remember this device
        </label>
        <Link
          href="/forgot-password"
          className="text-[13px] font-medium text-teal-800 transition hover:text-teal-950"
        >
          Forgot password?
        </Link>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="group mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-teal-600 to-teal-800 px-4 py-3.5 text-[15px] font-semibold text-white shadow-[0_12px_24px_rgba(13,116,110,0.28)] transition hover:from-teal-500 hover:to-teal-700 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Authenticating…
          </>
        ) : (
          <>
            Sign in to workspace
            <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
          </>
        )}
      </button>

      <div className="mt-6 flex items-center gap-3 text-[11px] uppercase tracking-[0.18em] text-slate-400">
        <span className="h-px flex-1 bg-stone-300/80" />
        or continue with
        <span className="h-px flex-1 bg-stone-300/80" />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <SsoButton
          label="Google"
          onClick={() =>
            setInfo("Google SSO is included on Enterprise. Use the demo clinician to explore.")
          }
        >
          <GoogleIcon />
        </SsoButton>
        <SsoButton
          label="Microsoft"
          onClick={() =>
            setInfo("Microsoft Entra ID is included on Enterprise. Use the demo clinician to explore.")
          }
        >
          <MicrosoftIcon />
        </SsoButton>
      </div>

      <button
        type="button"
        onClick={fillDemo}
        className="mt-5 w-full rounded-xl border border-dashed border-stone-300 bg-white/60 px-4 py-3 text-left transition hover:border-teal-300 hover:bg-teal-50/70"
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-teal-800">
          Guided demo
        </p>
        <p className="mt-1 text-[13px] text-slate-600">
          Use <span className="font-medium text-slate-900">{DEMO_EMAIL}</span> — password fills automatically.
        </p>
      </button>

      <p className="mt-6 text-center text-[13px] text-slate-600">
        New to Med SaaS?{" "}
        <Link href="/register" className="font-semibold text-teal-800 hover:text-teal-950">
          Request a workspace
        </Link>
      </p>

      <p className="mt-5 flex items-center justify-center gap-1.5 text-[12px] text-slate-500">
        <ShieldCheck className="h-3.5 w-3.5 text-teal-700" />
        Protected by role-based access and audit logging
      </p>
    </form>
  );
}

function SsoButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center justify-center gap-2 rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-[13px] font-medium text-slate-800 shadow-sm transition hover:border-stone-400 hover:bg-stone-50"
    >
      {children}
      {label}
    </button>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path
        fill="#EA4335"
        d="M12 10.2v3.7h5.2c-.2 1.2-1.5 3.6-5.2 3.6-3.1 0-5.7-2.6-5.7-5.7S8.9 6.1 12 6.1c1.8 0 3 .7 3.7 1.4l2.5-2.4C16.8 3.7 14.6 2.8 12 2.8 6.9 2.8 2.8 6.9 2.8 12S6.9 21.2 12 21.2c5.5 0 9.1-3.8 9.1-9.2 0-.6 0-1-.1-1.5H12z"
      />
      <path
        fill="#4285F4"
        d="M21.1 12c0-.6 0-1-.1-1.5H12v3.7h5.2"
      />
      <path
        fill="#FBBC05"
        d="M6.8 14.3l-.8.6C7.3 17.4 9.5 19 12 19c2 0 3.7-.7 4.9-1.8l-2.4-1.8c-.6.4-1.5.7-2.5.7-1.9 0-3.5-1.3-4.1-3z"
      />
      <path
        fill="#34A853"
        d="M12 5.1c1.5 0 2.9.5 3.9 1.6l2.4-2.3C16.8 2.9 14.6 2 12 2 8.1 2 4.8 4.2 3.5 7.5l2.8 2.2C7 7 9.3 5.1 12 5.1z"
      />
    </svg>
  );
}

function MicrosoftIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" aria-hidden>
      <path fill="#F25022" d="M2 2h9.5v9.5H2z" />
      <path fill="#7FBA00" d="M12.5 2H22v9.5h-9.5z" />
      <path fill="#00A4EF" d="M2 12.5h9.5V22H2z" />
      <path fill="#FFB900" d="M12.5 12.5H22V22h-9.5z" />
    </svg>
  );
}

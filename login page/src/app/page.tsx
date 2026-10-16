import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthFooter, AuthMobileHeader, AuthShell } from "@/components/auth-shell";
import { LoginForm } from "@/components/login-form";
import { getCurrentUser } from "@/lib/auth";
import { ensureSeed } from "@/lib/seed";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to your Med SaaS clinical workspace.",
};

export default async function LoginPage() {
  await ensureSeed();
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");

  return (
    <AuthShell>
      <AuthMobileHeader
        title="Welcome back."
        subtitle="Sign in to your clinical workspace."
      />
      <div className="flex flex-1 flex-col px-6 py-8 sm:px-10 lg:justify-center lg:px-16 lg:py-12 xl:px-24">
        <div className="mb-8 hidden justify-end text-[13px] text-slate-500 lg:flex">
          Need a workspace?{" "}
          <Link href="/register" className="ml-1 font-semibold text-teal-800 hover:text-teal-950">
            Request access
          </Link>
        </div>
        <div className="flex flex-1 items-start justify-center lg:items-center">
          <LoginForm />
        </div>
        <AuthFooter />
      </div>
    </AuthShell>
  );
}

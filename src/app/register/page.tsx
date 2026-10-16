import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthFooter, AuthMobileHeader, AuthShell } from "@/components/auth-shell";
import { RegisterForm } from "@/components/register-form";
import { getCurrentUser } from "@/lib/auth";
import { ensureSeed } from "@/lib/seed";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Create workspace",
  description: "Open a Med SaaS workspace for your clinic or health system.",
};

export default async function RegisterPage() {
  await ensureSeed();
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");

  return (
    <AuthShell>
      <AuthMobileHeader
        title="Open a workspace."
        subtitle="Create your Med SaaS account in under a minute."
      />
      <div className="flex flex-1 flex-col px-6 py-8 sm:px-10 lg:justify-center lg:px-16 lg:py-12 xl:px-24">
        <div className="mb-8 hidden justify-end text-[13px] text-slate-500 lg:flex">
          Already onboarded?{" "}
          <Link href="/" className="ml-1 font-semibold text-teal-800 hover:text-teal-950">
            Sign in
          </Link>
        </div>
        <div className="flex flex-1 items-start justify-center lg:items-center">
          <RegisterForm />
        </div>
        <AuthFooter />
      </div>
    </AuthShell>
  );
}

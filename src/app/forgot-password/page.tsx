import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthFooter, AuthMobileHeader, AuthShell } from "@/components/auth-shell";
import { ForgotForm } from "@/components/forgot-form";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Reset password",
  description: "Reset the password for your Med SaaS account.",
};

export default async function ForgotPasswordPage() {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");

  return (
    <AuthShell>
      <AuthMobileHeader
        title="Reset access."
        subtitle="We’ll email a secure link to your work inbox."
      />
      <div className="flex flex-1 flex-col px-6 py-8 sm:px-10 lg:justify-center lg:px-16 lg:py-12 xl:px-24">
        <div className="flex flex-1 items-start justify-center lg:items-center">
          <ForgotForm />
        </div>
        <AuthFooter />
      </div>
    </AuthShell>
  );
}

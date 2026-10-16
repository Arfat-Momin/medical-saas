import { NextResponse } from "next/server";
import { ensureSeed } from "@/lib/seed";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    await ensureSeed();
    const body = (await request.json()) as { email?: string };
    const email = String(body.email ?? "").trim().toLowerCase();

    if (!email.includes("@")) {
      return NextResponse.json({ error: "Enter a valid work email." }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      message: "If an account exists for that email, a reset link is on its way.",
    });
  } catch {
    return NextResponse.json({ error: "Unable to process that request." }, { status: 500 });
  }
}

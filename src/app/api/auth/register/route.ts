import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { loginEvents, users } from "@/db/schema";
import { clientMeta, createSession, hashPassword } from "@/lib/auth";
import { ensureSeed } from "@/lib/seed";

export const dynamic = "force-dynamic";

const ROLES = new Set(["clinician", "nurse", "admin", "specialist", "billing"]);

export async function POST(request: Request) {
  try {
    await ensureSeed();

    const body = (await request.json()) as {
      fullName?: string;
      email?: string;
      password?: string;
      organization?: string;
      role?: string;
    };

    const fullName = String(body.fullName ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    const organization = String(body.organization ?? "").trim() || "Independent Practice";
    const role = ROLES.has(String(body.role)) ? String(body.role) : "clinician";
    const meta = clientMeta(request);

    if (fullName.length < 2) {
      return NextResponse.json({ error: "Please enter your full name." }, { status: 400 });
    }

    if (!email.includes("@") || !email.includes(".")) {
      return NextResponse.json({ error: "Enter a valid work email." }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters." },
        { status: 400 },
      );
    }

    const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    if (existing) {
      return NextResponse.json(
        { error: "An account with this email already exists. Try signing in." },
        { status: 409 },
      );
    }

    const passwordHash = await hashPassword(password);
    const [user] = await db
      .insert(users)
      .values({
        fullName,
        email,
        passwordHash,
        role,
        organization,
        title: role === "admin" ? "Practice Administrator" : "Clinician",
      })
      .returning();

    await db.insert(loginEvents).values({
      userId: user.id,
      email,
      success: true,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    await createSession(user.id, true);

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Unable to create your workspace right now." },
      { status: 500 },
    );
  }
}

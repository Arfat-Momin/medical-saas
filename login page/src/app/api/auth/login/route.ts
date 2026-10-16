import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { loginEvents, users } from "@/db/schema";
import { clientMeta, createSession, verifyPassword } from "@/lib/auth";
import { ensureSeed } from "@/lib/seed";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    await ensureSeed();

    const body = (await request.json()) as {
      email?: string;
      password?: string;
      remember?: boolean;
    };

    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    const remember = Boolean(body.remember);
    const meta = clientMeta(request);

    if (!email || !email.includes("@") || password.length < 8) {
      return NextResponse.json(
        { error: "Enter a valid work email and password." },
        { status: 400 },
      );
    }

    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    const valid = user ? await verifyPassword(password, user.passwordHash) : false;

    await db.insert(loginEvents).values({
      userId: user?.id ?? null,
      email,
      success: Boolean(user && valid),
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    if (!user || !valid) {
      return NextResponse.json(
        { error: "The email or password you entered doesn’t match our records." },
        { status: 401 },
      );
    }

    await createSession(user.id, remember);

    return NextResponse.json({
      ok: true,
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Unable to sign in right now. Please try again." },
      { status: 500 },
    );
  }
}

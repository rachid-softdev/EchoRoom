import { NextResponse } from "next/server";
import { db } from "@/server/db";
import bcrypt from "bcryptjs";
import { signIn } from "@/lib/auth";

/**
 * DEV-ONLY endpoint to obtain a real authenticated session cookie.
 *
 * Never active in production (guarded by NODE_ENV). Upserts a known dev user
 * and signs them in via the app's own Credentials provider, producing a valid
 * NextAuth session cookie that can be reused by E2E / Playwright flows.
 *
 * Usage (dev):  POST /api/dev/login  ->  capture the `Set-Cookie` response header.
 */
const DEV_EMAIL = "dev@local.dev";
const DEV_PASSWORD = "dev-password-123";

export async function POST() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 404 });
  }

  const passwordHash = await bcrypt.hash(DEV_PASSWORD, 12);

  await db.user.upsert({
    where: { email: DEV_EMAIL },
    update: { passwordHash, role: "ADMIN" },
    create: {
      email: DEV_EMAIL,
      username: "devuser",
      passwordHash,
      role: "ADMIN",
    },
  });

  const result = await signIn("credentials", {
    email: DEV_EMAIL,
    password: DEV_PASSWORD,
    redirect: false,
  });

  if (result?.error) {
    return NextResponse.json(
      { error: "Dev sign-in failed", detail: result.error },
      { status: 401 },
    );
  }

  return NextResponse.json({ ok: true, email: DEV_EMAIL });
}

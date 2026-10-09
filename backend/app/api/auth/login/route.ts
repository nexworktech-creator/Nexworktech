import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/password";
import { COOKIE, SESSION_HOURS, createSession } from "@/lib/auth";
import { allow } from "@/lib/ratelimit";

const body = z.object({ email: z.string().email().max(200), password: z.string().min(1).max(200) });
let dummy: Promise<string> | undefined;   // lets unknown emails cost the same time as known ones

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
  if (!allow("login-ip:" + ip, 20, 600_000)) return NextResponse.json({ error: "Too many attempts" }, { status: 429 });
  const p = body.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "Invalid email or password" }, { status: 400 });
  const email = p.data.email.toLowerCase();
  if (!allow("login:" + email, 5, 600_000)) return NextResponse.json({ error: "Too many attempts" }, { status: 429 });

  const user = await prisma.user.findUnique({ where: { email } });
  const ok = await verifyPassword(p.data.password, user?.passwordHash ?? (await (dummy ??= hashPassword("not-a-real-password-1"))));
  if (!user || !ok || !user.active || !["SUPER_ADMIN", "ADMIN", "STAFF"].includes(user.role))
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });

  const token = await createSession(user.id);
  await prisma.auditLog.create({ data: { actorId: user.id, action: "auth.login" } });
  const res = NextResponse.json({ ok: true, role: user.role });
  res.cookies.set(COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: SESSION_HOURS * 3600 });
  return res;
}

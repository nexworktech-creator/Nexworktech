import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { COOKIE, hashToken } from "@/lib/auth";

export async function POST(req: Request) {
  const m = (req.headers.get("cookie") ?? "").split(";").map((s) => s.trim()).find((s) => s.startsWith(COOKIE + "="));
  if (m) await prisma.session.deleteMany({ where: { id: hashToken(m.slice(COOKIE.length + 1)) } });   // server-side revoke
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}

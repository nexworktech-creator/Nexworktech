import { NextResponse } from "next/server";
import { z } from "zod";
import { createHash, randomBytes } from "crypto";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

const ONLINE_WINDOW_MS = 2 * 60_000;   // a device is "online" if it reported in the last 2 minutes

export async function GET(req: Request) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const u = new URL(req.url), id = u.searchParams.get("id");
  if (id) {   // latest readings for one device
    const metric = u.searchParams.get("metric") ?? undefined;
    const limit = Math.min(Number(u.searchParams.get("limit") ?? 50) || 50, 500);
    return NextResponse.json({ items: await prisma.deviceTelemetry.findMany({ where: { deviceId: id, metric }, orderBy: { ts: "desc" }, take: limit }) });
  }
  const devices = await prisma.ioTDevice.findMany({ orderBy: { createdAt: "desc" }, select: { id: true, name: true, lastSeenAt: true, createdAt: true } });
  return NextResponse.json({ items: devices.map((d) => ({ ...d, online: !!d.lastSeenAt && Date.now() - d.lastSeenAt.getTime() < ONLINE_WINDOW_MS })) });
}

// Registers a device and returns its token ONCE. Only the hash is stored.
export async function POST(req: Request) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const p = z.object({ name: z.string().trim().min(2).max(80) }).safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  const token = randomBytes(32).toString("hex");
  const d = await prisma.ioTDevice.create({ data: { name: p.data.name, tokenHash: createHash("sha256").update(token).digest("hex") } });
  return NextResponse.json({ id: d.id, token, note: "Save this token now. It cannot be shown again." }, { status: 201 });
}

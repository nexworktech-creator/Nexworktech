import { NextResponse } from "next/server";
import { z } from "zod";
import { createHash } from "crypto";
import { prisma } from "@/lib/db";

// Allowlisted metrics with sane ranges. Anything else is rejected.
const RANGE: Record<string, [number, number]> = { temperature: [-60, 150], humidity: [0, 100], air_quality: [0, 1000], distance: [0, 1000], motion: [0, 1], energy_w: [0, 100000], battery: [0, 100] };
const body = z.object({ readings: z.array(z.object({ metric: z.enum(Object.keys(RANGE) as [string, ...string[]]), value: z.number().finite() })).min(1).max(20) });

export async function POST(req: Request) {
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer /, "");
  if (!token) return NextResponse.json({ error: "Missing device token" }, { status: 401 });
  if (Number(req.headers.get("content-length") ?? 0) > 4096) return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  const device = await prisma.ioTDevice.findUnique({ where: { tokenHash: createHash("sha256").update(token).digest("hex") } });
  if (!device) return NextResponse.json({ error: "Invalid device token" }, { status: 401 });
  if (device.lastSeenAt && Date.now() - device.lastSeenAt.getTime() < 1000) return NextResponse.json({ error: "Send at most one request per second" }, { status: 429 });
  const p = body.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "Invalid readings" }, { status: 400 });
  if (p.data.readings.some((r) => r.value < RANGE[r.metric][0] || r.value > RANGE[r.metric][1])) return NextResponse.json({ error: "Reading out of range" }, { status: 400 });
  await prisma.$transaction([
    prisma.deviceTelemetry.createMany({ data: p.data.readings.map((r) => ({ deviceId: device.id, metric: r.metric, value: r.value })) }),
    prisma.ioTDevice.update({ where: { id: device.id }, data: { lastSeenAt: new Date() } }),
  ]);
  return NextResponse.json({ ok: true, stored: p.data.readings.length }, { status: 201 });
}

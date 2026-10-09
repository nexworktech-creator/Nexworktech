import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { Definition } from "@/lib/automation/engine";

const body = z.object({ name: z.string().trim().min(2).max(120), definition: Definition, enabled: z.boolean().optional() });

export async function GET(req: Request) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ items: await prisma.workflow.findMany({ orderBy: { createdAt: "desc" }, take: 100 }) });
}
export async function POST(req: Request) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const p = body.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "Invalid workflow", fields: p.error.flatten() }, { status: 400 });
  const wf = await prisma.workflow.create({ data: { name: p.data.name, definition: p.data.definition as any, enabled: p.data.enabled ?? false } });
  return NextResponse.json({ id: wf.id }, { status: 201 });
}

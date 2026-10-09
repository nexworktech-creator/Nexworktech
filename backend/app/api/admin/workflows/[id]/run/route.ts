import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { runWorkflow } from "@/lib/automation/engine";

const body = z.object({ mode: z.enum(["TEST", "PRODUCTION"]).default("TEST"), context: z.record(z.string(), z.any()).default({}) });

export async function POST(req: Request, { params }: { params: { id: string } }) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const p = body.safeParse(await req.json().catch(() => ({})));
  if (!p.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  try { return NextResponse.json(await runWorkflow(params.id, p.data.mode, p.data.context)); }
  catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 400 }); }
}

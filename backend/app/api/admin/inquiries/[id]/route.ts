import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/auth";

const patch = z.object({ status: z.enum(["NEW", "CONTACTED", "QUALIFIED", "WON", "LOST"]).optional(), assigneeId: z.string().nullable().optional() });

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  if (!(await requireStaff(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const p = patch.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  const item = await prisma.inquiry.update({ where: { id: params.id }, data: p.data }).catch(() => null);
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.auditLog.create({ data: { action: "inquiry.update", target: item.publicId } });
  return NextResponse.json({ item });
}

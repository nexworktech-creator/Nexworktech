import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/auth";

export async function GET(req: Request) {
  if (!(await requireStaff(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const [total, grouped, demoSessions] = await Promise.all([
    prisma.inquiry.count(),
    prisma.inquiry.groupBy({ by: ["status"], _count: true }),
    prisma.demoSession.count(),
  ]);
  const byStatus = Object.fromEntries(grouped.map((g) => [g.status, g._count]));
  // Students, courses, certificates and projects are added with Stage 5-6 tables.
  return NextResponse.json({ total, byStatus, demoSessions });
}

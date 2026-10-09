import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/auth";

export async function GET(req: Request) {
  if (!(await requireStaff(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const u = new URL(req.url), q = u.searchParams.get("q") ?? "", status = u.searchParams.get("status");
  const items = await prisma.inquiry.findMany({
    where: {
      ...(status ? { status: status as any } : {}),
      ...(u.searchParams.get("service") ? { service: { slug: u.searchParams.get("service")! } } : {}),
      ...(q ? { OR: [{ fullName: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }, { publicId: { contains: q } }] } : {}),
    },
    include: { service: { select: { name: true } }, assignee: { select: { name: true } } },
    orderBy: { createdAt: "desc" }, take: 100,
  });
  return NextResponse.json({ items });
}

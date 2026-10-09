import { NextResponse } from "next/server";
import { z } from "zod";
import { randomInt } from "crypto";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

const body = z.object({ fullName: z.string().trim().min(2).max(120), email: z.string().email(), courseSlug: z.string().optional() });

// Staff create a verified student record (and optional enrollment). The registration
// number is generated here; students cannot invent their own.
export async function POST(req: Request) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const p = body.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  const course = p.data.courseSlug ? await prisma.course.findUnique({ where: { slug: p.data.courseSlug } }) : null;
  if (p.data.courseSlug && !course) return NextResponse.json({ error: "Course not found" }, { status: 404 });
  for (let i = 0; i < 3; i++) {
    const regNo = `NX-${new Date().getFullYear()}-${randomInt(10000, 100000)}`;
    try {
      const s = await prisma.student.create({ data: { regNo, fullName: p.data.fullName, email: p.data.email,
        ...(course ? { enrollments: { create: { courseId: course.id } } } : {}) }, include: { enrollments: true } });
      return NextResponse.json({ regNo: s.regNo, enrollmentIds: s.enrollments.map((e) => e.id) }, { status: 201 });
    } catch (e: any) { if (e.code !== "P2002" || String(e.meta?.target).includes("email")) break; }
  }
  return NextResponse.json({ error: "Could not create student (email may already exist)" }, { status: 409 });
}

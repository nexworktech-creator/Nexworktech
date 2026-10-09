import { NextResponse } from "next/server";
import { z } from "zod";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

const issue = z.object({ enrollmentId: z.string(), override: z.boolean().optional() });
const revoke = z.object({ certId: z.string() });

// Issue: only when the course completion rule is met, or staff explicitly override (audited).
export async function POST(req: Request) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const p = issue.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  const e = await prisma.enrollment.findUnique({ where: { id: p.data.enrollmentId }, include: { course: true, certificate: true } });
  if (!e) return NextResponse.json({ error: "Enrollment not found" }, { status: 404 });
  if (e.certificate?.status === "ISSUED") return NextResponse.json({ error: "Already issued" }, { status: 409 });
  if (e.certificate?.status === "REVOKED") return NextResponse.json({ error: "Certificate was revoked" }, { status: 409 });
  const approved = await prisma.submission.count({ where: { studentId: e.studentId, status: "APPROVED", assignment: { courseId: e.courseId } } });
  const met = approved >= e.course.requiredAssignments;
  if (!met && !p.data.override) return NextResponse.json({ error: `Needs ${e.course.requiredAssignments} approved assignments, has ${approved}. Send override:true to issue anyway.` }, { status: 409 });
  const certId = e.certificate?.certId ?? `NXC-${new Date().getFullYear()}-${randomBytes(5).toString("hex").toUpperCase()}`;
  const cert = await prisma.certificate.upsert({ where: { enrollmentId: e.id }, update: { status: "ISSUED", issuedAt: new Date() }, create: { certId, enrollmentId: e.id, status: "ISSUED", issuedAt: new Date() } });
  await prisma.enrollment.update({ where: { id: e.id }, data: { status: "COMPLETED" } });
  await prisma.auditLog.create({ data: { action: met ? "certificate.issue" : "certificate.issue.override", target: cert.certId } });
  return NextResponse.json({ certId: cert.certId }, { status: 201 });
}

export async function PATCH(req: Request) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const p = revoke.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  const c = await prisma.certificate.update({ where: { certId: p.data.certId.toUpperCase() }, data: { status: "REVOKED", revokedAt: new Date() } }).catch(() => null);
  if (!c) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.auditLog.create({ data: { action: "certificate.revoke", target: c.certId } });
  return NextResponse.json({ certId: c.certId, status: c.status });
}

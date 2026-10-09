import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Public. A certificate ID shows the record and a download link when the status is ISSUED.
// A registration number shows status only: it never returns the certificate ID or the PDF.
export async function GET(req: Request) {
  const u = new URL(req.url);
  const id = u.searchParams.get("id")?.trim().toUpperCase();
  const reg = u.searchParams.get("reg")?.trim().toUpperCase();
  if (id) {
    if (!/^NXC-\d{4}-[0-9A-F]{10}$/.test(id)) return NextResponse.json({ valid: false, error: "Not found" }, { status: 404 });
    const c = await prisma.certificate.findUnique({ where: { certId: id }, include: { enrollment: { include: { student: true, course: true } } } });
    if (!c) return NextResponse.json({ valid: false, error: "Not found" }, { status: 404 });
    if (c.status !== "ISSUED") return NextResponse.json({ valid: false, status: c.status });
    return NextResponse.json({ valid: true, certId: c.certId, studentName: c.enrollment.student.fullName,
      course: c.enrollment.course.title, issuedAt: c.issuedAt, pdfUrl: `/api/certificates/${c.certId}/pdf` });
  }
  if (reg) {
    if (!/^NX-\d{4}-\d{5}$/.test(reg)) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const s = await prisma.student.findUnique({ where: { regNo: reg }, include: { enrollments: { include: { course: true, certificate: true } } } });
    if (!s) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ studentName: s.fullName, items: s.enrollments.map((e) => ({
      course: e.course.title, status: e.certificate?.status ?? "NOT_ISSUED", issuedAt: e.certificate?.issuedAt ?? null })) });
  }
  return NextResponse.json({ error: "Provide id or reg" }, { status: 400 });
}

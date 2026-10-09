import { prisma } from "@/lib/db";
import { certificatePdf } from "@/lib/certificate";

export async function GET(_: Request, { params }: { params: { certId: string } }) {
  const c = await prisma.certificate.findUnique({ where: { certId: params.certId.toUpperCase() }, include: { enrollment: { include: { student: true, course: true } } } });
  if (!c || c.status !== "ISSUED" || !c.issuedAt) return new Response("Not found", { status: 404 });
  const bytes = await certificatePdf({ certId: c.certId, studentName: c.enrollment.student.fullName, courseTitle: c.enrollment.course.title, issuedAt: c.issuedAt });
  return new Response(bytes, { headers: { "content-type": "application/pdf", "content-disposition": `attachment; filename="${c.certId}.pdf"` } });
}

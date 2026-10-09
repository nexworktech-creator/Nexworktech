import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import QRCode from "qrcode";

type Cert = { certId: string; studentName: string; courseTitle: string; issuedAt: Date };

// Note: the built-in PDF fonts cover Latin text only. For names in Devanagari or other
// scripts, embed a Unicode TTF through @pdf-lib/fontkit before drawing.
export async function certificatePdf(c: Cert): Promise<Uint8Array> {
  const url = `${process.env.APP_URL}/verify?id=${c.certId}`;
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([842, 595]);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const reg = await pdf.embedFont(StandardFonts.Helvetica);
  const navy = rgb(0.03, 0.08, 0.2), blue = rgb(0.18, 0.42, 1);
  const mid = (t: string, y: number, size: number, f = reg, color = navy) =>
    page.drawText(t, { x: (842 - f.widthOfTextAtSize(t, size)) / 2, y, size, font: f, color });

  page.drawRectangle({ x: 24, y: 24, width: 794, height: 547, borderColor: blue, borderWidth: 3 });
  mid("NEXWORK TECH", 505, 20, bold, blue);
  mid("Certificate of Completion", 450, 34, bold);
  mid("This certifies that", 400, 14);
  mid(c.studentName, 350, 32, bold, blue);
  mid("has successfully completed the course", 312, 14);
  mid(c.courseTitle, 275, 24, bold);
  mid(`Issued on ${c.issuedAt.toISOString().slice(0, 10)}`, 235, 13);

  page.drawLine({ start: { x: 560, y: 120 }, end: { x: 760, y: 120 }, thickness: 1, color: navy });
  page.drawText(process.env.CERT_SIGNATORY ?? "Authorized Signatory", { x: 560, y: 102, size: 12, font: reg, color: navy });

  const png = await pdf.embedPng(await QRCode.toBuffer(url, { margin: 1, width: 240 }));
  page.drawImage(png, { x: 70, y: 70, width: 100, height: 100 });
  page.drawText(`Certificate ID: ${c.certId}`, { x: 190, y: 130, size: 11, font: bold, color: navy });
  page.drawText("Verify at:", { x: 190, y: 112, size: 10, font: reg, color: navy });
  page.drawText(url, { x: 190, y: 98, size: 9, font: reg, color: blue });
  return pdf.save();
}

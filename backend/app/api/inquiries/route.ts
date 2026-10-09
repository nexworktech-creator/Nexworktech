import { NextResponse } from "next/server";
import { z } from "zod";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/db";

const schema = z.object({
  fullName: z.string().trim().min(2).max(120),
  organization: z.string().trim().max(160).optional(),
  phone: z.string().regex(/^\+?[0-9 ()-]{7,18}$/),
  whatsapp: z.string().regex(/^\+?[0-9 ()-]{7,18}$/).optional().or(z.literal("")),
  email: z.string().email().max(200),
  city: z.string().trim().min(1).max(100),
  service: z.string().max(60).optional(),          // service slug
  features: z.array(z.string().max(80)).max(30).default([]),
  budget: z.string().max(60).optional(),
  description: z.string().trim().min(10).max(4000),
  contactVia: z.enum(["Phone call", "WhatsApp", "Email"]),
  consent: z.literal(true),
  config: z.record(z.string(), z.any()).optional(),
  website: z.string().max(0).optional(),           // honeypot: must stay empty
});

// Simple per-IP limiter. In-memory only: use Redis or an edge limiter in production.
const hits = new Map<string, number[]>();
function limited(ip: string) {
  const now = Date.now(), win = (hits.get(ip) ?? []).filter((t) => now - t < 600_000);
  win.push(now); hits.set(ip, win); return win.length > 5;
}

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
  if (limited(ip)) return NextResponse.json({ error: "Too many requests. Try again later." }, { status: 429 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input", fields: parsed.error.flatten().fieldErrors }, { status: 400 });
  const d = parsed.data;
  try {
    const service = d.service ? await prisma.service.findUnique({ where: { slug: d.service } }) : null;
    const publicId = `NX-${new Date().getFullYear()}-${randomBytes(3).toString("hex").toUpperCase()}`;
    await prisma.inquiry.create({ data: {
      publicId, fullName: d.fullName, organization: d.organization, phone: d.phone,
      whatsapp: d.whatsapp || null, email: d.email, city: d.city, serviceId: service?.id,
      features: d.features, budget: d.budget, description: d.description,
      contactVia: d.contactVia, consent: true, config: d.config,
    }});
    // The ID is returned only after the database confirms the write.
    // Email/WhatsApp notifications: add a provider in Stage 6 and report delivery separately.
    return NextResponse.json({ ok: true, inquiryId: publicId }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Could not save your inquiry. Please try again." }, { status: 500 });
  }
}

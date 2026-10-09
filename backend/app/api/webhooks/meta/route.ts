import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/db";
import { Definition, runWorkflow } from "@/lib/automation/engine";

// One endpoint for the official WhatsApp Business Platform and Instagram messaging webhooks (Meta).
// Set this URL in the Meta app dashboard. No WhatsApp Web / QR-session scraping is used anywhere.
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  if (!process.env.META_VERIFY_TOKEN) return new Response("Not configured", { status: 503 });
  if (q.get("hub.mode") === "subscribe" && q.get("hub.verify_token") === process.env.META_VERIFY_TOKEN)
    return new Response(q.get("hub.challenge") ?? "", { status: 200 });
  return new Response("Forbidden", { status: 403 });
}

export async function POST(req: Request) {
  const secret = process.env.META_APP_SECRET;
  if (!secret) return NextResponse.json({ error: "Not configured" }, { status: 503 });
  const raw = await req.text();
  const sig = (req.headers.get("x-hub-signature-256") ?? "").replace("sha256=", "");
  const want = createHmac("sha256", secret).update(raw).digest("hex");
  if (sig.length !== want.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(want))) return new Response("Bad signature", { status: 401 });

  let evt: any; try { evt = JSON.parse(raw); } catch { return new Response("Bad JSON", { status: 400 }); }
  const msgs: { channel: string; from: string; text: string }[] = [];
  for (const e of evt.entry ?? []) {
    for (const ch of e.changes ?? []) for (const m of ch.value?.messages ?? []) if (m.text?.body) msgs.push({ channel: "whatsapp", from: String(m.from), text: String(m.text.body) });
    for (const m of e.messaging ?? []) if (m.message?.text) msgs.push({ channel: "instagram", from: String(m.sender?.id), text: String(m.message.text) });
  }
  const flows = (await prisma.workflow.findMany({ where: { enabled: true } })).filter((w) => Definition.safeParse(w.definition).data?.trigger.type === "inbound_message");
  for (const m of msgs) for (const w of flows) await runWorkflow(w.id, "PRODUCTION", m).catch(() => null);
  return NextResponse.json({ received: msgs.length });   // Meta expects a fast 200
}

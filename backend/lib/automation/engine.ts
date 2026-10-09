import { z } from "zod";
import { prisma } from "@/lib/db";

// Workflows are DATA, never code. Only the step types below exist; anything else fails validation.
export const Definition = z.object({
  trigger: z.object({
    type: z.enum(["form_submission", "new_lead", "schedule", "webhook", "inbound_message"]),
    config: z.record(z.string(), z.any()).default({}),
  }),
  steps: z.array(z.object({
    id: z.string().max(40),
    type: z.enum(["condition", "email_notification", "crm_update", "ai_text", "approval", "delay", "send_whatsapp"]),
    config: z.record(z.string(), z.any()).default({}),
    maxAttempts: z.number().int().min(1).max(5).default(3),
  })).min(1).max(20),
});
export type Def = z.infer<typeof Definition>;
type Ctx = Record<string, any>;
export type Mode = "TEST" | "PRODUCTION";
type StepResult = { id: string; type: string; ok: boolean; detail: string; attempt?: number; simulated: boolean };

class Permanent extends Error {}   // configuration problems: never retried
const BLOCKED = new Set(["__proto__", "constructor", "prototype"]);
const get = (o: Ctx, p: string) => p.split(".").slice(0, 4).reduce((a: any, k) => (a && typeof a === "object" && !BLOCKED.has(k) ? a[k] : undefined), o);
export const fill = (t: string, c: Ctx) => t.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, p) => String(get(c, p) ?? ""));

function check(c: Ctx, ctx: Ctx): boolean {
  const a = get(ctx, String(c.field)), b = c.value;
  switch (c.op) {
    case "eq": return String(a) === String(b);
    case "neq": return String(a) !== String(b);
    case "gt": return Number(a) > Number(b);
    case "lt": return Number(a) < Number(b);
    case "contains": return String(a ?? "").toLowerCase().includes(String(b).toLowerCase());
    default: throw new Permanent("Unknown condition operator");
  }
}

const need = (...n: string[]) => { const m = n.filter((k) => !process.env[k]); if (m.length) throw new Permanent("Not configured: set " + m.join(", ")); };
const sim = (label: string) => async (c: Ctx, x: Ctx) => `SIMULATED ${label}. Nothing was sent. Config: ${fill(JSON.stringify(c), x).slice(0, 160)}`;
const STATUSES = ["NEW", "CONTACTED", "QUALIFIED", "WON", "LOST"];

type Exec = { test: (c: Ctx, x: Ctx) => Promise<string>; prod?: (c: Ctx, x: Ctx) => Promise<string> };
// A step with no `prod` handler is refused in production instead of pretending to work.
const EXEC: Record<string, Exec> = {
  email_notification: { test: sim("email") },        // add a provider adapter as `prod`
  approval: { test: sim("approval request") },       // needs an approvals screen
  delay: { test: sim("delay") },                     // needs the background job queue
  crm_update: { test: sim("CRM update"), prod: async (c, x) => {
    if (!STATUSES.includes(c.status)) throw new Permanent("Invalid status");
    if (!x.inquiryId) throw new Permanent("No inquiryId in context");
    await prisma.inquiry.update({ where: { publicId: String(x.inquiryId) }, data: { status: c.status } });
    return `Inquiry ${x.inquiryId} set to ${c.status}`;
  } },
  ai_text: { test: async (c) => `SIMULATED AI text for prompt: ${String(c.prompt ?? "").slice(0, 80)}`, prod: async (c, x) => {
    need("ANTHROPIC_API_KEY");
    const r = await fetch("https://api.anthropic.com/v1/messages", { method: "POST",
      headers: { "x-api-key": process.env.ANTHROPIC_API_KEY!, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: process.env.AI_MODEL ?? "claude-sonnet-5-5", max_tokens: 400, messages: [{ role: "user", content: fill(String(c.prompt ?? ""), x).slice(0, 2000) }] }) });
    if (!r.ok) throw new Error("AI provider returned " + r.status);
    x.ai_text = (await r.json()).content?.[0]?.text ?? "";
    return `AI text generated (${x.ai_text.length} characters)`;
  } },
  send_whatsapp: { test: sim("WhatsApp reply"), prod: async (c, x) => {
    need("WHATSAPP_TOKEN", "WHATSAPP_PHONE_ID");
    if (!x.from) throw new Permanent("No recipient (from) in context");
    const r = await fetch(`https://graph.facebook.com/${process.env.GRAPH_VERSION ?? "v21.0"}/${process.env.WHATSAPP_PHONE_ID}/messages`, { method: "POST",
      headers: { authorization: "Bearer " + process.env.WHATSAPP_TOKEN, "content-type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", to: x.from, type: "text", text: { body: fill(String(c.text ?? ""), x).slice(0, 1000) } }) });
    if (!r.ok) throw new Error("WhatsApp API returned " + r.status);
    return "WhatsApp message sent to " + x.from;
  } },
};

async function runStep(s: Def["steps"][number], mode: Mode, ctx: Ctx): Promise<{ ok: boolean; detail: string; attempt?: number }> {
  const fn = mode === "TEST" ? EXEC[s.type].test : EXEC[s.type].prod;
  if (!fn) return { ok: false, detail: "Not available in production yet. Use test mode." };
  let last = "";
  for (let a = 1; a <= s.maxAttempts; a++) {
    try { return { ok: true, attempt: a, detail: await fn(s.config, ctx) }; }
    catch (e) {
      if (e instanceof Permanent) return { ok: false, detail: e.message };
      last = (e as Error).message;
      await new Promise((r) => setTimeout(r, 200 * a));   // simple backoff; move to a job queue for long delays
    }
  }
  return { ok: false, detail: `Failed after ${s.maxAttempts} attempts: ${last}` };
}

export async function executeDefinition(def: Def, mode: Mode, input: Ctx) {
  const ctx: Ctx = JSON.parse(JSON.stringify(input));
  const steps: StepResult[] = [];
  let status: "SUCCEEDED" | "FAILED" | "SKIPPED" = "SUCCEEDED";
  for (const s of def.steps) {
    const simulated = mode === "TEST";
    if (s.type === "condition") {
      try {
        const ok = check(s.config, ctx);
        steps.push({ id: s.id, type: s.type, ok: true, detail: `Condition is ${ok}`, simulated });
        if (!ok) { status = "SKIPPED"; break; }
        continue;
      } catch (e) { steps.push({ id: s.id, type: s.type, ok: false, detail: (e as Error).message, simulated }); status = "FAILED"; break; }
    }
    const r = await runStep(s, mode, ctx);
    steps.push({ id: s.id, type: s.type, simulated, ...r });
    if (!r.ok) { status = "FAILED"; break; }
  }
  return { status, steps };
}

export async function runWorkflow(workflowId: string, mode: Mode, ctx: Ctx) {
  const wf = await prisma.workflow.findUnique({ where: { id: workflowId } });
  if (!wf) throw new Error("Workflow not found");
  if (mode === "PRODUCTION" && !wf.enabled) throw new Error("Workflow is disabled. Enable it before production runs.");
  const result = await executeDefinition(Definition.parse(wf.definition), mode, ctx);
  const run = await prisma.workflowRun.create({ data: { workflowId, mode, status: result.status, steps: result.steps as any } });
  return { runId: run.id, ...result };
}

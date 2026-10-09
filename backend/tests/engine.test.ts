import { describe, it, expect, vi } from "vitest";
vi.mock("@/lib/db", () => ({ prisma: { inquiry: { update: vi.fn() } } }));
import { Definition, executeDefinition } from "@/lib/automation/engine";

const def = Definition.parse({ trigger: { type: "new_lead" }, steps: [
  { id: "c", type: "condition", config: { field: "lead.budget", op: "gt", value: 50000 } },
  { id: "w", type: "send_whatsapp", config: { text: "Hi {{lead.name}}" } }] });

describe("automation engine", () => {
  it("runs every step as a simulation in test mode", async () => {
    const r = await executeDefinition(def, "TEST", { lead: { name: "Asha", budget: 80000 } });
    expect(r.status).toBe("SUCCEEDED");
    expect(r.steps.every((s) => s.simulated)).toBe(true);
  });
  it("stops with SKIPPED when the condition is false", async () => {
    const r = await executeDefinition(def, "TEST", { lead: { budget: 10 } });
    expect(r.status).toBe("SKIPPED"); expect(r.steps).toHaveLength(1);
  });
  it("refuses production steps whose integration is not configured", async () => {
    delete process.env.WHATSAPP_TOKEN;
    const r = await executeDefinition(def, "PRODUCTION", { lead: { budget: 80000 }, from: "1" });
    expect(r.status).toBe("FAILED"); expect(r.steps.at(-1)?.detail).toContain("Not configured");
  });
  it("rejects unknown step types and blocks prototype access in conditions", async () => {
    expect(Definition.safeParse({ trigger: { type: "webhook" }, steps: [{ id: "x", type: "run_code" }] }).success).toBe(false);
    const d = Definition.parse({ trigger: { type: "webhook" }, steps: [{ id: "c", type: "condition", config: { field: "constructor.name", op: "eq", value: "Object" } }] });
    expect((await executeDefinition(d, "TEST", {})).status).toBe("SKIPPED");
  });
});

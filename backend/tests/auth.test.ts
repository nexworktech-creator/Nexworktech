import { describe, it, expect, vi, beforeEach } from "vitest";
const { findUnique } = vi.hoisted(() => ({ findUnique: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: { session: { findUnique } } }));
import { requireAdmin, requireStaff } from "@/lib/auth";

const req = (method: string, headers: Record<string, string> = {}) =>
  new Request("https://nexwork.test/api/x", { method, headers: { host: "nexwork.test", cookie: "nx_session=abc", ...headers } });
const session = (role: string, over: object = {}) => ({ expiresAt: new Date(Date.now() + 60_000), user: { id: "u1", role, active: true }, ...over });
beforeEach(() => findUnique.mockReset());

describe("route guards", () => {
  it("rejects requests without a session cookie", async () => {
    expect(await requireAdmin(new Request("https://nexwork.test/api/x", { headers: { host: "nexwork.test" } }))).toBeNull();
  });
  it("accepts a valid admin session", async () => {
    findUnique.mockResolvedValue(session("ADMIN"));
    expect(await requireAdmin(req("GET"))).toMatchObject({ id: "u1" });
  });
  it("lets staff in only where staff are allowed", async () => {
    findUnique.mockResolvedValue(session("STAFF"));
    expect(await requireAdmin(req("GET"))).toBeNull();
    expect(await requireStaff(req("GET"))).not.toBeNull();
  });
  it("rejects customers, expired sessions, disabled users and unknown tokens", async () => {
    findUnique.mockResolvedValue(session("CUSTOMER")); expect(await requireStaff(req("GET"))).toBeNull();
    findUnique.mockResolvedValue(session("ADMIN", { expiresAt: new Date(Date.now() - 1) })); expect(await requireAdmin(req("GET"))).toBeNull();
    findUnique.mockResolvedValue({ ...session("ADMIN"), user: { id: "u1", role: "ADMIN", active: false } }); expect(await requireAdmin(req("GET"))).toBeNull();
    findUnique.mockResolvedValue(null); expect(await requireAdmin(req("GET"))).toBeNull();
  });
  it("blocks cross-site and origin-less writes (CSRF)", async () => {
    findUnique.mockResolvedValue(session("ADMIN"));
    expect(await requireAdmin(req("POST"))).toBeNull();
    expect(await requireAdmin(req("POST", { origin: "https://evil.example" }))).toBeNull();
    expect(await requireAdmin(req("POST", { origin: "https://nexwork.test" }))).not.toBeNull();
  });
});

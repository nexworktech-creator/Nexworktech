import { createHash, randomBytes } from "crypto";
import { prisma } from "@/lib/db";

export const COOKIE = "nx_session";
export const SESSION_HOURS = 8;
export const hashToken = (t: string) => createHash("sha256").update(t).digest("hex");
type Role = "SUPER_ADMIN" | "ADMIN" | "STAFF" | "CUSTOMER" | "STUDENT";

function cookie(req: Request, name: string) {
  const m = (req.headers.get("cookie") ?? "").split(";").map((s) => s.trim()).find((s) => s.startsWith(name + "="));
  return m ? m.slice(name.length + 1) : undefined;
}
function sameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? new URL(req.url).host;
  try { return !!origin && new URL(origin).host === host; } catch { return false; }
}

// Returns the signed-in user when the session is valid and the role is allowed, otherwise null.
// Any request that changes data must also come from our own origin (CSRF defence on top of SameSite).
export async function requireRole(req: Request, roles: Role[]) {
  if (req.method !== "GET" && req.method !== "HEAD" && !sameOrigin(req)) return null;
  const token = cookie(req, COOKIE);
  if (!token) return null;
  const s = await prisma.session.findUnique({ where: { id: hashToken(token) }, include: { user: true } });
  if (!s || s.expiresAt.getTime() < Date.now() || !s.user.active || !roles.includes(s.user.role as Role)) return null;
  return s.user;
}
export const requireAdmin = (req: Request) => requireRole(req, ["SUPER_ADMIN", "ADMIN"]);
export const requireStaff = (req: Request) => requireRole(req, ["SUPER_ADMIN", "ADMIN", "STAFF"]);

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("hex");
  await prisma.session.create({ data: { id: hashToken(token), userId, expiresAt: new Date(Date.now() + SESSION_HOURS * 3_600_000) } });
  return token;
}

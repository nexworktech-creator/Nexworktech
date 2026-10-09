// Usage: ADMIN_EMAIL=you@company.com ADMIN_PASSWORD='long-unique-pass-9' ADMIN_NAME='Your Name' npx tsx scripts/create-admin.ts
import { prisma } from "../lib/db";
import { hashPassword, passwordProblem } from "../lib/password";

async function main() {
  const email = process.env.ADMIN_EMAIL?.toLowerCase(), pw = process.env.ADMIN_PASSWORD;
  if (!email || !pw) throw new Error("Set ADMIN_EMAIL and ADMIN_PASSWORD");
  const problem = passwordProblem(pw);
  if (problem) throw new Error(problem);
  const passwordHash = await hashPassword(pw);
  await prisma.user.upsert({ where: { email }, update: { passwordHash, role: "SUPER_ADMIN", active: true },
    create: { email, passwordHash, name: process.env.ADMIN_NAME ?? "Administrator", role: "SUPER_ADMIN" } });
  console.log("Admin ready:", email, "(clear your shell history if the password was typed inline)");
}
main().catch((e) => { console.error(e.message); process.exit(1); }).finally(() => prisma.$disconnect());

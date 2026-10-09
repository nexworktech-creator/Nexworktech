import { randomBytes, scrypt as _scrypt, timingSafeEqual } from "crypto";
import { promisify } from "util";

const scrypt = promisify(_scrypt) as (p: string, s: Buffer, k: number, o: object) => Promise<Buffer>;
const N = 32768, R = 8, P = 1, MAXMEM = 128 * 1024 * 1024;

export async function hashPassword(pw: string): Promise<string> {
  const salt = randomBytes(16);
  const h = await scrypt(pw, salt, 64, { N, r: R, p: P, maxmem: MAXMEM });
  return `scrypt$${N}$${salt.toString("base64")}$${h.toString("base64")}`;
}
export async function verifyPassword(pw: string, stored: string): Promise<boolean> {
  const [alg, n, s, h] = stored.split("$");
  if (alg !== "scrypt" || !n || !s || !h) return false;
  const want = Buffer.from(h, "base64");
  const got = await scrypt(pw, Buffer.from(s, "base64"), want.length, { N: Number(n), r: R, p: P, maxmem: MAXMEM });
  return got.length === want.length && timingSafeEqual(got, want);
}
export function passwordProblem(pw: string): string | null {
  if (pw.length < 12) return "Use at least 12 characters.";
  if (!/[a-z]/i.test(pw) || !/\d/.test(pw)) return "Include letters and numbers.";
  if (/^(.)\1+$/.test(pw) || /12345|password|qwerty/i.test(pw)) return "Choose a less predictable password.";
  return null;
}

import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword, passwordProblem } from "../lib/password";

describe("passwords", () => {
  it("hashes with a salt and verifies", async () => {
    const a = await hashPassword("Correct-Horse-9"), b = await hashPassword("Correct-Horse-9");
    expect(a).not.toBe(b);
    expect(await verifyPassword("Correct-Horse-9", a)).toBe(true);
    expect(await verifyPassword("Correct-Horse-8", a)).toBe(false);
    expect(await verifyPassword("x", "garbage")).toBe(false);
  });
  it("rejects weak passwords, including the old test password", () => {
    for (const w of ["12345", "short1", "aaaaaaaaaaaa", "password12345", "onlyletterslongenough"]) expect(passwordProblem(w)).not.toBeNull();
    expect(passwordProblem("Str0ng-and-long-enough")).toBeNull();
  });
});

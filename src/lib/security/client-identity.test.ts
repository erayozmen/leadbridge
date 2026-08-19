import { describe, expect, it } from "vitest";
import { buildPrivateRateLimitKey, resolveTrustedClientIdentity } from "./client-identity";

describe("trusted client identity", () => {
  it("uses only Vercel's forwarded identity in production", () => {
    const headers = new Headers({ "x-vercel-forwarded-for": "203.0.113.8", "x-forwarded-for": "attacker-value" });
    expect(resolveTrustedClientIdentity(headers, true)).toBe("203.0.113.8");
    expect(resolveTrustedClientIdentity(new Headers({ "x-forwarded-for": "203.0.113.9" }), true)).toBeNull();
  });
  it("hashes identity without retaining raw IP", () => {
    const key = buildPrivateRateLimitKey("scope", "203.0.113.8", "secret");
    expect(key).not.toContain("203.0.113.8");
    expect(key).toMatch(/^rl:scope:[a-f0-9]{64}$/);
  });
});

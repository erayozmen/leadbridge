import { describe, expect, it } from "vitest";
import { buildContentSecurityPolicy, getSecurityHeaders } from "./security-headers";

describe("security headers", () => {
  it("uses a restrictive baseline without unsafe-eval", () => {
    const csp = buildContentSecurityPolicy(true);
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("upgrade-insecure-requests");
    expect(csp).toContain("frame-src https://challenges.cloudflare.com");
    expect(csp).not.toContain("unsafe-eval");
  });

  it("enables HSTS only in production", () => {
    expect(getSecurityHeaders(true).some(({ key }) => key === "Strict-Transport-Security")).toBe(true);
    expect(getSecurityHeaders(false).some(({ key }) => key === "Strict-Transport-Security")).toBe(false);
  });
});

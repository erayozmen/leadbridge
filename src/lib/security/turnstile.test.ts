import { describe, expect, it, vi } from "vitest";
import { verifyTurnstileToken } from "./turnstile";

const response = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));

describe("Turnstile verification", () => {
  const valid = { success: true, hostname: "leadbridges.example", action: "public-qr-registration" };
  it("accepts a valid server verification", async () => expect(await verifyTurnstileToken("token", { secret: "secret", expectedHostname: "leadbridges.example", production: true, fetchImpl: vi.fn(() => response(valid)) })).toEqual({ status: "VALID" }));
  it("rejects invalid and replayed tokens", async () => {
    expect(await verifyTurnstileToken("token", { secret: "secret", production: true, fetchImpl: vi.fn(() => response({ success: false, "error-codes": ["invalid-input-response"] })) })).toMatchObject({ status: "INVALID" });
    expect(await verifyTurnstileToken("token", { secret: "secret", production: true, fetchImpl: vi.fn(() => response({ success: false, "error-codes": ["timeout-or-duplicate"] })) })).toEqual({ status: "INVALID", failureKind: "expired-or-replayed" });
  });
  it("fails safely for malformed responses and provider timeouts", async () => {
    expect(await verifyTurnstileToken("token", { secret: "secret", production: true, fetchImpl: vi.fn(() => response({ nope: true })) })).toEqual({ status: "UNAVAILABLE", failureKind: "malformed-response" });
    expect(await verifyTurnstileToken("token", { secret: "secret", production: true, fetchImpl: vi.fn(async () => { throw new DOMException("timeout", "AbortError"); }) })).toEqual({ status: "UNAVAILABLE", failureKind: "network-or-timeout" });
  });
  it("fails closed without production config and bypasses deterministically in tests", async () => {
    expect(await verifyTurnstileToken("token", { secret: "", production: true })).toEqual({ status: "NOT_CONFIGURED", failureKind: "missing-config" });
    expect(await verifyTurnstileToken("", { secret: "", production: false })).toEqual({ status: "BYPASSED" });
  });
  it("does not return the secret or token in failure metadata", async () => {
    const result = await verifyTurnstileToken("private-token", { secret: "private-secret", production: true, fetchImpl: vi.fn(() => response({}, 503)) });
    expect(JSON.stringify(result)).not.toContain("private");
  });
});

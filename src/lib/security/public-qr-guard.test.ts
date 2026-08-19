import { beforeEach, describe, expect, it, vi } from "vitest";

const { capture } = vi.hoisted(() => ({ capture: vi.fn() }));
vi.mock("@/lib/monitoring/capture", () => ({ captureTechnicalException: capture }));
import { guardPublicQrMutation } from "./public-qr-guard";

describe("public QR security guard", () => {
  beforeEach(() => { vi.clearAllMocks(); process.env.NEXT_PUBLIC_APP_URL = "https://leadbridges.example"; process.env.RATE_LIMIT_KEY_SECRET = "test-key-secret"; });
  const requestHeaders = new Headers({ origin: "https://leadbridges.example", "x-vercel-forwarded-for": "203.0.113.8" });
  const store = (allowed = true) => ({ consume: vi.fn(async () => ({ allowed, counts: [1, 1] })) });
  it("requires both distributed limit and Turnstile", async () => {
    const verify = vi.fn(async () => ({ status: "VALID" as const }));
    await expect(guardPublicQrMutation("token", { production: true, requestHeaders, store: store(), verify })).resolves.toEqual({ allowed: true });
    expect(verify).toHaveBeenCalledOnce();
  });
  it("cannot bypass rate limits", async () => expect(guardPublicQrMutation("token", { production: true, requestHeaders, store: store(false), verify: vi.fn() })).resolves.toEqual({ allowed: false, reason: "RATE_LIMIT" }));
  it("cannot bypass invalid Turnstile and does not report expected rejection", async () => {
    await expect(guardPublicQrMutation("token", { production: true, requestHeaders, store: store(), verify: vi.fn(async () => ({ status: "INVALID" as const })) })).resolves.toEqual({ allowed: false, reason: "TURNSTILE" });
    expect(capture).not.toHaveBeenCalled();
  });
  it("fails closed and safely captures provider failures", async () => {
    await expect(guardPublicQrMutation("token", { production: true, requestHeaders, store: { consume: vi.fn(async () => { throw new Error("down"); }) }, verify: vi.fn() })).resolves.toEqual({ allowed: false, reason: "CONTROL_UNAVAILABLE" });
    expect(capture).toHaveBeenCalledWith(expect.any(Error), expect.objectContaining({ control: "distributed-rate-limit", failureKind: "provider-unavailable" }));
    expect(JSON.stringify(capture.mock.calls)).not.toContain("203.0.113.8");
  });
  it("fails closed when production distributed configuration is missing", async () => {
    await expect(guardPublicQrMutation("token", { production: true, requestHeaders, store: null, verify: vi.fn() })).resolves.toEqual({ allowed: false, reason: "CONTROL_UNAVAILABLE" });
  });
  it("captures technical Turnstile outage without token context", async () => {
    await expect(guardPublicQrMutation("private-token", { production: true, requestHeaders, store: store(), verify: vi.fn(async () => ({ status: "UNAVAILABLE" as const, failureKind: "network-or-timeout" })) })).resolves.toEqual({ allowed: false, reason: "CONTROL_UNAVAILABLE" });
    expect(capture).toHaveBeenCalledWith(expect.any(Error), expect.objectContaining({ control: "turnstile", failureKind: "network-or-timeout" }));
    expect(JSON.stringify(capture.mock.calls)).not.toContain("private-token");
  });
});

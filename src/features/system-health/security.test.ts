import { afterEach, describe, expect, it, vi } from "vitest";
import { getSecurityPosture } from "./security";

afterEach(() => vi.unstubAllEnvs());
describe("system health public QR configuration", () => {
  it("reports fully configured controls without claiming provider uptime", () => {
    vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "site"); vi.stubEnv("TURNSTILE_SECRET_KEY", "secret"); vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://redis.example"); vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "token"); vi.stubEnv("RATE_LIMIT_KEY_SECRET", "key");
    const posture = getSecurityPosture();
    expect(posture.publicQr.turnstile).toBe("CONFIGURED"); expect(posture.publicQr.distributedRateLimit).toBe("CONFIGURED");
    expect(posture.publicQr).not.toHaveProperty("providerHealthy");
  });
  it("reports partial configuration safely", () => {
    vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "site"); vi.stubEnv("TURNSTILE_SECRET_KEY", ""); vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://redis.example"); vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", ""); vi.stubEnv("RATE_LIMIT_KEY_SECRET", "");
    const posture = getSecurityPosture();
    expect(posture.publicQr.turnstile).toBe("UNKNOWN"); expect(posture.publicQr.distributedRateLimit).toBe("DEGRADED"); expect(posture.status).not.toBe("HEALTHY");
  });
});

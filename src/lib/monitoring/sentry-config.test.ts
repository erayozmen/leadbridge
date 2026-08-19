import { describe, expect, it } from "vitest";
import { beforeSend, sanitizeMonitoringValue } from "./sentry-config";

describe("Sentry sensitive data filtering", () => {
  it("redacts secret headers and student contact fields recursively", () => {
    const sanitized = sanitizeMonitoringValue({ headers: { authorization: "Bearer secret", cookie: "session=x" }, student: { email: "student@example.com", phone: "+90 555 111 22 33", firstName: "Ada" }, databaseUrl: "postgresql://user:pass@db/app" });
    expect(sanitized).toEqual({ headers: { authorization: "[Filtered]", cookie: "[Filtered]" }, student: { email: "[Filtered]", phone: "[Filtered]", firstName: "[Filtered]" }, databaseUrl: "[Filtered]" });
  });

  it("redacts provider credentials, challenge tokens, raw IP fields, and student names", () => {
    const sanitized = sanitizeMonitoringValue({ TURNSTILE_SECRET_KEY: "turnstile-secret", "cf-turnstile-response": "challenge-token", UPSTASH_REDIS_REST_TOKEN: "redis-token", RATE_LIMIT_KEY_SECRET: "rate-secret", CRON_SECRET: "cron-secret", ACADEMY_INTEGRATION_SECRET: "academy-secret", BACKUP_DATABASE_URL: "postgresql://backup:secret@db/app", user: { ip: "203.0.113.42", fullName: "Ada Yilmaz" } });
    expect(JSON.stringify(sanitized)).not.toMatch(/turnstile-secret|challenge-token|redis-token|rate-secret|cron-secret|academy-secret|203\.0\.113\.42|Ada Yilmaz|backup:secret/);
  });

  it("sanitizes sensitive values embedded in event messages", () => {
    const event = beforeSend({ message: "contact student@example.com using +90 555 111 22 33" });
    expect(event?.message).toBe("contact [Filtered] using [Filtered]");
  });
});

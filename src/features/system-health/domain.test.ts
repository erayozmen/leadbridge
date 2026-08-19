import { describe, expect, it } from "vitest";
import { aggregateHealthStatus, deriveAcademyIntegrationHealth, deriveCronHealth } from "./domain";
import { deriveSecurityHealth } from "./security";

const now = new Date("2026-08-18T12:00:00.000Z");
describe("system health derivation", () => {
  it("never promotes UNKNOWN to HEALTHY", () => expect(aggregateHealthStatus(["HEALTHY", "UNKNOWN"])).toBe("UNKNOWN"));
  it("uses the worst system-wide status", () => expect(aggregateHealthStatus(["HEALTHY", "WARNING", "FAILED"])).toBe("FAILED"));
  it("keeps MANUAL runs outside cron evidence by accepting cron-only inputs", () => expect(deriveCronHealth({ now, latestCron: null, lastSuccessfulCron: null })).toBe("UNKNOWN"));
  it("marks a delayed cron as warning", () => expect(deriveCronHealth({ now, latestCron: { status: "COMPLETED", startedAt: new Date("2026-08-18T04:00:00.000Z") }, lastSuccessfulCron: { startedAt: new Date("2026-08-18T04:00:00.000Z") } })).toBe("WARNING"));
  it("marks a failed latest cron as failed", () => expect(deriveCronHealth({ now, latestCron: { status: "FAILED", startedAt: now }, lastSuccessfulCron: { startedAt: now } })).toBe("FAILED"));
  it("does not treat a partial cron as healthy", () => expect(deriveCronHealth({ now, latestCron: { status: "PARTIAL", startedAt: now }, lastSuccessfulCron: { startedAt: now } })).toBe("WARNING"));
  it("derives integration status from configuration and the real latest run", () => { expect(deriveAcademyIntegrationHealth(true, "COMPLETED")).toBe("HEALTHY"); expect(deriveAcademyIntegrationHealth(false, "COMPLETED")).toBe("DEGRADED"); });
});

describe("security health derivation", () => {
  const baseline = { headers: { contentSecurityPolicy: true, frameProtection: true, hstsInProduction: true, mimeSniffingProtection: true, referrerPolicy: true }, adminAuthorization: true, sentryDefaultPiiDisabled: true, academySecretConfigured: true, cronSecretConfigured: true, publicQr: { tokenHashed: true, cryptographicEntropy: true, transactionalReplayProtection: true, originGuard: true, turnstile: "CONFIGURED" as const, distributedRateLimit: "CONFIGURED" as const } };
  it("is healthy only when all controls and the audit are clean", () => expect(deriveSecurityHealth({ ...baseline, dependencyAudit: { auditedAt: now, tool: "npm audit", total: 0, critical: 0, high: 0, moderate: 0, low: 0, knownRequestPathExploitableHigh: 0, note: "clean" } })).toBe("HEALTHY"));
  it("does not mark missing public abuse protection healthy", () => expect(deriveSecurityHealth({ ...baseline, publicQr: { ...baseline.publicQr, turnstile: "NOT_CONFIGURED", distributedRateLimit: "NOT_CONFIGURED" } })).toBe("DEGRADED"));
  it("does not promote unknown provider configuration to healthy", () => expect(deriveSecurityHealth({ ...baseline, publicQr: { ...baseline.publicQr, turnstile: "UNKNOWN" } })).toBe("DEGRADED"));
  it("degrades when a required secret is missing", () => expect(deriveSecurityHealth({ ...baseline, cronSecretConfigured: false })).toBe("DEGRADED"));
});

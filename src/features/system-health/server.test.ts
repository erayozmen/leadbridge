import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ query: vi.fn(), findFirst: vi.fn(), findMany: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: { $queryRaw: mocks.query, academySyncRun: { findFirst: mocks.findFirst, findMany: mocks.findMany } } }));
import { getSystemHealthSnapshot } from "./server";

const run = { id: "run-1", source: "CRON", status: "COMPLETED", startedAt: new Date("2026-08-18T09:00:00.000Z"), finishedAt: new Date("2026-08-18T09:01:00.000Z"), candidateCount: 4, matchedCount: 2, notFoundCount: 1, ambiguousCount: 1, commissionAdjustmentCount: 1, errorCount: 0 };
beforeEach(() => { vi.clearAllMocks(); mocks.query.mockResolvedValue([{ "?column?": 1 }]); mocks.findFirst.mockResolvedValue(run); mocks.findMany.mockResolvedValue([]); vi.stubEnv("ACADEMY_API_BASE_URL", "https://academy.example"); vi.stubEnv("ACADEMY_INTEGRATION_SECRET", "secret"); vi.stubEnv("SENTRY_DSN", "https://public@example.ingest.sentry.io/1"); vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "https://public@example.ingest.sentry.io/1"); vi.stubEnv("SENTRY_AUTH_TOKEN", "secret"); vi.stubEnv("SENTRY_ORG", "org"); vi.stubEnv("SENTRY_PROJECT", "project"); vi.stubEnv("VERCEL_ENV", "production"); vi.stubEnv("VERCEL_GIT_COMMIT_SHA", "1234567890abcdef"); });
afterEach(() => vi.unstubAllEnvs());

describe("system health snapshot", () => {
  it("returns safe configuration booleans and the real latest run", async () => {
    const snapshot = await getSystemHealthSnapshot(new Date("2026-08-18T10:00:00.000Z"));
    expect(snapshot.academyIntegration.latestRun?.id).toBe("run-1");
    expect(snapshot.sentry).toMatchObject({ configured: true, sourceMapsConfigured: true, defaultPiiEnabled: false });
    expect(snapshot.backup).toMatchObject({ status: "DEGRADED", managedBackupStatus: "UNKNOWN", pitrConfigured: "UNKNOWN", logicalToolingAvailable: true, recoveryDocumentationAvailable: true });
    expect(snapshot.overallStatus).toBe("DEGRADED");
    const payload = JSON.stringify(snapshot);
    expect(payload).not.toContain("ACADEMY_INTEGRATION_SECRET");
    expect(payload).not.toContain("SENTRY_AUTH_TOKEN");
    expect(payload).not.toContain("academy.example");
    expect(payload).not.toContain("example.ingest.sentry.io");
    expect(payload).not.toContain("BACKUP_DATABASE_URL");
  });
  it("uses only CRON queries as cron evidence and calculates Istanbul schedule", async () => {
    const snapshot = await getSystemHealthSnapshot(new Date("2026-08-18T07:15:00.000Z"));
    expect(mocks.findFirst.mock.calls.some(([query]) => query.where?.source === "CRON")).toBe(true);
    expect(snapshot.academyCron.nextScheduledAt.toISOString()).toBe("2026-08-18T09:00:00.000Z");
  });
  it("returns measured performance data without secrets or PII", async () => {
    mocks.findMany.mockResolvedValue([run]);
    const snapshot = await getSystemHealthSnapshot(new Date("2026-08-18T10:00:00.000Z"));
    expect(snapshot.performance.database.probeDurationMs).toBeTypeOf("number");
    expect(snapshot.performance.academySync).toMatchObject({ sampleCount: 1, minMs: 60_000, averageMs: 60_000, maxMs: 60_000 });
    expect(snapshot.performance.externalDatabaseMetrics).toBe("UNKNOWN");
    expect(JSON.stringify(snapshot.performance)).not.toMatch(/secret|token|student|email|phone/i);
  });
  it("reports a failed database probe as FAILED without inventing latency", async () => {
    mocks.query.mockRejectedValue(new Error("database unavailable"));
    const snapshot = await getSystemHealthSnapshot(new Date("2026-08-18T10:00:00.000Z"));
    expect(snapshot.database.status).toBe("FAILED");
    expect(snapshot.performance.database).toEqual({ status: "FAILED", probeDurationMs: null });
  });
});

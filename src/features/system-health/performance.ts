import type { HealthStatus } from "./domain";

export const PERFORMANCE_BUDGETS = {
  databaseProbe: { warningMs: 250, degradedMs: 750 },
  systemHealthSnapshot: { warningMs: 1_000, degradedMs: 2_500 },
  academySync: { warningMs: 60_000, degradedMs: 180_000 },
  academyApiTimeoutMs: 10_000,
  turnstileTimeoutMs: 5_000,
  distributedRateLimitTimeoutMs: 3_000,
  exportRecordLimit: 5_000,
} as const;

export const PERFORMANCE_QUERY_POSTURE = {
  livePlanVerified: false,
  recommendations: [
    "Commission ledger history için veri büyüdüğünde ayrı paginated detail query değerlendirin.",
    "AcademySyncRun source/order sorgularını production EXPLAIN ile doğrulayın.",
  ],
} as const;

export function deriveLatencyHealth(durationMs: number | null, failed: boolean, budget: { warningMs: number; degradedMs: number }): HealthStatus {
  if (failed) return "FAILED";
  if (durationMs === null || !Number.isFinite(durationMs) || durationMs < 0) return "UNKNOWN";
  if (durationMs >= budget.degradedMs) return "DEGRADED";
  if (durationMs >= budget.warningMs) return "WARNING";
  return "HEALTHY";
}

export function calculateRunDurationMs(run: { startedAt: Date; finishedAt: Date | null } | null | undefined): number | null {
  if (!run?.finishedAt) return null;
  return Math.max(0, run.finishedAt.getTime() - run.startedAt.getTime());
}

export function summarizeDurations(runs: Array<{ startedAt: Date; finishedAt: Date | null }>) {
  const durations = runs.map(calculateRunDurationMs).filter((value): value is number => value !== null);
  if (!durations.length) return { sampleCount: 0, minMs: null, averageMs: null, maxMs: null };
  return { sampleCount: durations.length, minMs: Math.min(...durations), averageMs: Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length), maxMs: Math.max(...durations) };
}

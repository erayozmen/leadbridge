export const HEALTH_STATUSES = ["HEALTHY", "WARNING", "DEGRADED", "FAILED", "UNKNOWN"] as const;
export type HealthStatus = typeof HEALTH_STATUSES[number];

export const ACADEMY_CRON_HEALTH = {
  healthyWithinHours: 7,
  warningWithinHours: 13,
} as const;

const priority: Record<HealthStatus, number> = { HEALTHY: 0, UNKNOWN: 1, WARNING: 2, DEGRADED: 3, FAILED: 4 };

export function aggregateHealthStatus(statuses: HealthStatus[]): HealthStatus {
  if (!statuses.length) return "UNKNOWN";
  return statuses.reduce((worst, status) => priority[status] > priority[worst] ? status : worst, "HEALTHY");
}

export function deriveCronHealth(input: { now: Date; latestCron?: { status: string; startedAt: Date } | null; lastSuccessfulCron?: { startedAt: Date } | null }): HealthStatus {
  if (input.latestCron?.status === "FAILED") return "FAILED";
  if (!input.lastSuccessfulCron) return input.latestCron?.status === "PARTIAL" || input.latestCron?.status === "RUNNING" ? "WARNING" : "UNKNOWN";
  const ageHours = Math.max(0, input.now.getTime() - input.lastSuccessfulCron.startedAt.getTime()) / 3_600_000;
  const scheduleStatus = ageHours <= ACADEMY_CRON_HEALTH.healthyWithinHours ? "HEALTHY" : ageHours <= ACADEMY_CRON_HEALTH.warningWithinHours ? "WARNING" : "DEGRADED";
  return input.latestCron?.status === "PARTIAL" || input.latestCron?.status === "RUNNING" ? aggregateHealthStatus([scheduleStatus, "WARNING"]) : scheduleStatus;
}

export function deriveAcademyIntegrationHealth(configured: boolean, latestStatus?: string | null): HealthStatus {
  if (!configured) return "DEGRADED";
  if (!latestStatus) return "UNKNOWN";
  if (latestStatus === "FAILED") return "FAILED";
  if (latestStatus === "PARTIAL" || latestStatus === "RUNNING") return "WARNING";
  return latestStatus === "COMPLETED" ? "HEALTHY" : "UNKNOWN";
}

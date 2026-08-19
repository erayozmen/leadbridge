import "server-only";
import { AcademySyncRunSource, AcademySyncRunStatus, BackupVerificationType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getNextAcademySyncTime } from "@/features/academy-commissions/schedule";
import { aggregateHealthStatus, deriveAcademyIntegrationHealth, deriveCronHealth, type HealthStatus } from "./domain";
import { deriveBackupOperationsHealth, getBackupConfigurationState } from "./backup";
import { getCachedSentryLiveHealth, type SentryLiveHealth } from "./sentry-provider";
import { getSecurityPosture, type SecurityPosture } from "./security";
import { calculateRunDurationMs, deriveLatencyHealth, PERFORMANCE_BUDGETS, PERFORMANCE_QUERY_POSTURE, summarizeDurations } from "./performance";

type SafeRun = { id: string; source: string; status: string; startedAt: Date; finishedAt: Date | null; candidateCount: number; matchedCount: number; notFoundCount: number; ambiguousCount: number; commissionAdjustmentCount: number; errorCount: number };
export type SystemHealthSnapshot = {
  overallStatus: HealthStatus;
  generatedAt: Date;
  application: { status: HealthStatus; label: string };
  database: { status: HealthStatus; checked: boolean };
  academyIntegration: { status: HealthStatus; configured: boolean; latestRun: SafeRun | null };
  academyCron: { status: HealthStatus; latestCron: SafeRun | null; lastSuccessfulCron: SafeRun | null; nextScheduledAt: Date };
  sentry: SentryLiveHealth & { configured: boolean; serverDsnConfigured: boolean; clientDsnConfigured: boolean; errorMonitoringEnabled: boolean; tracingEnabled: boolean; traceSampleRate: number; defaultPiiEnabled: false; sourceMapsConfigured: boolean };
  backup: { status: HealthStatus; strategy: "SUPABASE_MANAGED_PLUS_LOGICAL"; managed: SafeBackupVerification | null; logical: SafeBackupVerification | null; restore: SafeBackupVerification | null; manualVerificationRequired: true; policyConfigured: boolean; logicalToolingAvailable: boolean; recoveryDocumentationAvailable: boolean };
  security: SecurityPosture;
  performance: { status: HealthStatus; database: { status: HealthStatus; probeDurationMs: number | null }; snapshot: { status: HealthStatus; generationDurationMs: number }; academySync: { status: HealthStatus; latestDurationMs: number | null; lastSuccessfulDurationMs: number | null; sampleCount: number; minMs: number | null; averageMs: number | null; maxMs: number | null }; indexPosture: { status: "WARNING"; livePlanVerified: false; recommendationCount: number }; externalDatabaseMetrics: "UNKNOWN" };
  release: { environment: string; shortSha: string | null };
  recentProblemRuns: SafeRun[];
};
type SafeBackupVerification = { id: string; type: string; status: string; provider: string; verificationMethod: string; verifiedAt: Date; backupCreatedAt: Date | null; sizeBytes: bigint | null; checksumSha256: string | null; pgDumpVersion: string | null; managedStatus: string | null; pitrStatus: string | null };

const runSelect = { id: true, source: true, status: true, startedAt: true, finishedAt: true, candidateCount: true, matchedCount: true, notFoundCount: true, ambiguousCount: true, commissionAdjustmentCount: true, errorCount: true } as const;

export async function getSystemHealthSnapshot(now = new Date()): Promise<SystemHealthSnapshot> {
  const snapshotStartedAt = performance.now();
  const databaseProbeStartedAt = performance.now();
  let databaseFailed = false;
  try { await prisma.$queryRaw`SELECT 1`; } catch { databaseFailed = true; }
  const databaseProbeDurationMs = Math.round((performance.now() - databaseProbeStartedAt) * 100) / 100;
  const databaseStatus = deriveLatencyHealth(databaseProbeDurationMs, databaseFailed, PERFORMANCE_BUDGETS.databaseProbe);

  const [latestRun, latestCron, lastSuccessfulCron, recentProblemRuns, recentSuccessfulRuns, backupVerifications, sentryLive] = await Promise.all([
    prisma.academySyncRun.findFirst({ orderBy: { startedAt: "desc" }, select: runSelect }).catch(() => null),
    prisma.academySyncRun.findFirst({ where: { source: AcademySyncRunSource.CRON }, orderBy: { startedAt: "desc" }, select: runSelect }).catch(() => null),
    prisma.academySyncRun.findFirst({ where: { source: AcademySyncRunSource.CRON, status: AcademySyncRunStatus.COMPLETED }, orderBy: { startedAt: "desc" }, select: runSelect }).catch(() => null),
    prisma.academySyncRun.findMany({ where: { status: { in: [AcademySyncRunStatus.FAILED, AcademySyncRunStatus.PARTIAL] } }, orderBy: { startedAt: "desc" }, take: 10, select: runSelect }).catch(() => []),
    prisma.academySyncRun.findMany({ where: { status: AcademySyncRunStatus.COMPLETED, finishedAt: { not: null } }, orderBy: { startedAt: "desc" }, take: 10, select: runSelect }).catch(() => []),
    prisma.backupVerification.findMany({ orderBy: { verifiedAt: "desc" }, take: 20, select: { id: true, type: true, status: true, provider: true, verificationMethod: true, verifiedAt: true, backupCreatedAt: true, sizeBytes: true, checksumSha256: true, pgDumpVersion: true, managedStatus: true, pitrStatus: true } }).catch(() => []),
    getCachedSentryLiveHealth().catch(() => ({ status: "UNKNOWN", providerState: "UNAVAILABLE", errorEvents24h: null, criticalEvents24h: null, unresolvedIssues: null, lastErrorAt: null, issues: [], failureKind: "provider-error" } as SentryLiveHealth)),
  ]);

  const academyConfigured = Boolean(process.env.ACADEMY_API_BASE_URL && process.env.ACADEMY_INTEGRATION_SECRET);
  const serverDsnConfigured = Boolean(process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN);
  const clientDsnConfigured = Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN);
  const sentryConfigured = serverDsnConfigured && clientDsnConfigured;
  const environment = process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "unknown";
  const monitoringEnabled = sentryConfigured && environment !== "development" && environment !== "test";
  const traceSampleRate = environment === "production" ? 0.05 : 0.1;
  const sourceMapsConfigured = Boolean(process.env.SENTRY_AUTH_TOKEN && process.env.SENTRY_ORG && process.env.SENTRY_PROJECT);
  const { logicalToolingAvailable, recoveryDocumentationAvailable, policyConfigured } = getBackupConfigurationState();
  const managed = backupVerifications.find((item) => item.type === BackupVerificationType.MANAGED_BACKUP) ?? null;
  const logical = backupVerifications.find((item) => item.type === BackupVerificationType.LOGICAL_BACKUP) ?? null;
  const restore = backupVerifications.find((item) => item.type === BackupVerificationType.RESTORE_REHEARSAL) ?? null;
  const backupStatus = deriveBackupOperationsHealth({ now, managed, logical, restore, runbookAvailable: recoveryDocumentationAvailable });
  const security = getSecurityPosture();
  const academyStatus = deriveAcademyIntegrationHealth(academyConfigured, latestRun?.status);
  const cronStatus = deriveCronHealth({ now, latestCron, lastSuccessfulCron });
  const applicationStatus: HealthStatus = "HEALTHY";
  const sentryStatus = sentryLive.status;
  const latestDurationMs = calculateRunDurationMs(latestRun);
  const lastSuccessfulDurationMs = calculateRunDurationMs(recentSuccessfulRuns[0]);
  const durationSummary = summarizeDurations(recentSuccessfulRuns);
  const academyPerformanceStatus = deriveLatencyHealth(lastSuccessfulDurationMs, false, PERFORMANCE_BUDGETS.academySync);
  const snapshotGenerationDurationMs = Math.round((performance.now() - snapshotStartedAt) * 100) / 100;
  const snapshotPerformanceStatus = deriveLatencyHealth(snapshotGenerationDurationMs, false, PERFORMANCE_BUDGETS.systemHealthSnapshot);
  const performanceStatus = aggregateHealthStatus([databaseStatus, snapshotPerformanceStatus, academyPerformanceStatus, "WARNING"]);
  const overallStatus = aggregateHealthStatus([applicationStatus, databaseStatus, academyStatus, cronStatus, sentryStatus, backupStatus, security.status, performanceStatus]);

  return {
    overallStatus,
    generatedAt: now,
    application: { status: applicationStatus, label: "Running" },
    database: { status: databaseStatus, checked: true },
    academyIntegration: { status: academyStatus, configured: academyConfigured, latestRun },
    academyCron: { status: cronStatus, latestCron, lastSuccessfulCron, nextScheduledAt: getNextAcademySyncTime(now) },
    sentry: { ...sentryLive, status: sentryStatus, configured: sentryConfigured, serverDsnConfigured, clientDsnConfigured, errorMonitoringEnabled: monitoringEnabled, tracingEnabled: monitoringEnabled && traceSampleRate > 0, traceSampleRate, defaultPiiEnabled: false, sourceMapsConfigured },
    backup: { status: backupStatus, strategy: "SUPABASE_MANAGED_PLUS_LOGICAL", managed, logical, restore, manualVerificationRequired: true, policyConfigured, logicalToolingAvailable, recoveryDocumentationAvailable },
    security,
    performance: { status: performanceStatus, database: { status: databaseStatus, probeDurationMs: databaseFailed ? null : databaseProbeDurationMs }, snapshot: { status: snapshotPerformanceStatus, generationDurationMs: snapshotGenerationDurationMs }, academySync: { status: academyPerformanceStatus, latestDurationMs, lastSuccessfulDurationMs, ...durationSummary }, indexPosture: { status: "WARNING", livePlanVerified: PERFORMANCE_QUERY_POSTURE.livePlanVerified, recommendationCount: PERFORMANCE_QUERY_POSTURE.recommendations.length }, externalDatabaseMetrics: "UNKNOWN" },
    release: { environment, shortSha: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 8) ?? null },
    recentProblemRuns,
  };
}

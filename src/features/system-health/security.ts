import { SECURITY_HEADER_STATE } from "@/lib/security/security-headers";
import type { HealthStatus } from "./domain";

export type DependencyAuditSnapshot = {
  auditedAt: Date; tool: string; total: number; critical: number; high: number; moderate: number; low: number; knownRequestPathExploitableHigh: number; note: string;
};

export const DEPENDENCY_AUDIT_SNAPSHOT: DependencyAuditSnapshot = {
  auditedAt: new Date("2026-08-19T00:00:00.000+03:00"),
  tool: "npm audit",
  total: 10,
  critical: 0,
  high: 7,
  moderate: 3,
  low: 0,
  knownRequestPathExploitableHigh: 0,
  note: "Kalan bulgular Prisma CLI ve lint/build bağımlılık zincirlerindedir; zorlayıcı downgrade uygulanmadı.",
} as const;

export type SecurityPosture = {
  status: HealthStatus;
  headers: { contentSecurityPolicy: boolean; frameProtection: boolean; hstsInProduction: boolean; mimeSniffingProtection: boolean; referrerPolicy: boolean };
  adminAuthorization: boolean;
  sentryDefaultPiiDisabled: boolean;
  academySecretConfigured: boolean;
  cronSecretConfigured: boolean;
  publicQr: { tokenHashed: boolean; cryptographicEntropy: boolean; transactionalReplayProtection: boolean; originGuard: boolean; turnstile: "CONFIGURED" | "NOT_CONFIGURED" | "UNKNOWN"; distributedRateLimit: "CONFIGURED" | "NOT_CONFIGURED" | "DEGRADED" | "UNKNOWN" };
  dependencyAudit: DependencyAuditSnapshot;
};

export function deriveSecurityHealth(input: Omit<SecurityPosture, "status" | "dependencyAudit"> & { dependencyAudit?: DependencyAuditSnapshot }): HealthStatus {
  const audit = input.dependencyAudit ?? DEPENDENCY_AUDIT_SNAPSHOT;
  if (audit.critical > 0 || audit.knownRequestPathExploitableHigh > 0) return "FAILED";
  if (!input.headers.contentSecurityPolicy || !input.headers.frameProtection || !input.headers.hstsInProduction || !input.adminAuthorization || !input.sentryDefaultPiiDisabled || !input.academySecretConfigured || !input.cronSecretConfigured) return "DEGRADED";
  if (input.publicQr.turnstile !== "CONFIGURED" || input.publicQr.distributedRateLimit !== "CONFIGURED") return "DEGRADED";
  if (!input.publicQr.originGuard || audit.high > 0) return "WARNING";
  return "HEALTHY";
}

export function getSecurityPosture(): SecurityPosture {
  const turnstileParts = [Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY), Boolean(process.env.TURNSTILE_SECRET_KEY)];
  const rateLimitParts = [Boolean(process.env.UPSTASH_REDIS_REST_URL), Boolean(process.env.UPSTASH_REDIS_REST_TOKEN), Boolean(process.env.RATE_LIMIT_KEY_SECRET)];
  const turnstile = turnstileParts.every(Boolean) ? "CONFIGURED" as const : turnstileParts.some(Boolean) ? "UNKNOWN" as const : "NOT_CONFIGURED" as const;
  const distributedRateLimit = rateLimitParts.every(Boolean) ? "CONFIGURED" as const : rateLimitParts.some(Boolean) ? "DEGRADED" as const : "NOT_CONFIGURED" as const;
  const base = {
    headers: SECURITY_HEADER_STATE,
    adminAuthorization: true,
    sentryDefaultPiiDisabled: true,
    academySecretConfigured: Boolean(process.env.ACADEMY_INTEGRATION_SECRET),
    cronSecretConfigured: Boolean(process.env.CRON_SECRET),
    publicQr: { tokenHashed: true, cryptographicEntropy: true, transactionalReplayProtection: true, originGuard: true, turnstile, distributedRateLimit },
  };
  return { ...base, status: deriveSecurityHealth(base), dependencyAudit: DEPENDENCY_AUDIT_SNAPSHOT };
}

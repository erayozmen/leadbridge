import "server-only";
import { unstable_cache } from "next/cache";
import { z } from "zod";
import { sanitizeMonitoringValue } from "@/lib/monitoring/sentry-config";
import type { HealthStatus } from "./domain";

export const SENTRY_HEALTH_POLICY = { timeoutMs: 5_000, cacheSeconds: 45, spikeThreshold: 100 } as const;

const issueSchema = z.object({
  id: z.string().regex(/^\d+$/), title: z.string().max(300), level: z.string(), status: z.string(), count: z.string().regex(/^\d+$/),
  firstSeen: z.iso.datetime(), lastSeen: z.iso.datetime(), culprit: z.string().max(300).nullable().optional(),
  stats: z.record(z.string(), z.array(z.tuple([z.number(), z.number()]))).optional(),
});
const statsSchema = z.array(z.tuple([z.number(), z.number()]));

export type SafeSentryIssue = { id: string; title: string; level: string; status: string; count: number; firstSeen: Date; lastSeen: Date; transaction: string | null; url: string };
export type SentryLiveHealth = { status: HealthStatus; providerState: "AVAILABLE" | "NOT_CONFIGURED" | "UNAVAILABLE" | "UNAUTHORIZED" | "RATE_LIMITED"; errorEvents24h: number | null; criticalEvents24h: number | null; unresolvedIssues: number | null; lastErrorAt: Date | null; issues: SafeSentryIssue[]; failureKind?: string };

export function deriveSentryHealth(input: { available: boolean; configured: boolean; errorEvents24h: number; criticalEvents24h: number; unresolvedIssues: number }): HealthStatus {
  if (!input.configured || !input.available) return "UNKNOWN";
  if (input.criticalEvents24h > 0) return "DEGRADED";
  if (input.errorEvents24h >= SENTRY_HEALTH_POLICY.spikeThreshold) return "DEGRADED";
  if (input.unresolvedIssues > 0) return "WARNING";
  return "HEALTHY";
}

function empty(providerState: SentryLiveHealth["providerState"], failureKind?: string): SentryLiveHealth {
  return { status: "UNKNOWN", providerState, errorEvents24h: null, criticalEvents24h: null, unresolvedIssues: null, lastErrorAt: null, issues: [], failureKind };
}

function safeSlug(value: string | undefined) { return value && /^[a-z0-9][a-z0-9_-]{0,63}$/i.test(value) ? value : null; }
function issueEvents24h(issue: z.infer<typeof issueSchema>) { return (issue.stats?.["24h"] ?? []).reduce((sum, point) => sum + point[1], 0); }

export async function fetchSentryLiveHealth(options: { token?: string; organization?: string; project?: string; fetchImpl?: typeof fetch } = {}): Promise<SentryLiveHealth> {
  const token = options.token ?? process.env.SENTRY_READ_TOKEN;
  const organization = safeSlug(options.organization ?? process.env.SENTRY_ORG);
  const project = safeSlug(options.project ?? process.env.SENTRY_PROJECT);
  if (!token || !organization || !project) return empty("NOT_CONFIGURED", "missing-config");
  const fetchImpl = options.fetchImpl ?? fetch;
  const headers = { authorization: `Bearer ${token}`, accept: "application/json" };
  const base = `https://sentry.io/api/0/projects/${encodeURIComponent(organization)}/${encodeURIComponent(project)}`;
  try {
    const [statsResponse, unresolvedResponse] = await Promise.all([
      fetchImpl(`${base}/stats/?stat=received&resolution=1h&since=${Math.floor(Date.now() / 1000) - 86_400}&until=${Math.floor(Date.now() / 1000)}`, { headers, cache: "no-store", signal: AbortSignal.timeout(SENTRY_HEALTH_POLICY.timeoutMs), redirect: "error" }),
      fetchImpl(`${base}/issues/?query=is%3Aunresolved&statsPeriod=24h&sort=date&limit=100`, { headers, cache: "no-store", signal: AbortSignal.timeout(SENTRY_HEALTH_POLICY.timeoutMs), redirect: "error" }),
    ]);
    const responses = [statsResponse, unresolvedResponse];
    if (responses.some((response) => response.status === 401 || response.status === 403)) return empty("UNAUTHORIZED", "unauthorized");
    if (responses.some((response) => response.status === 429)) return empty("RATE_LIMITED", "rate-limited");
    if (responses.some((response) => !response.ok)) return empty("UNAVAILABLE", "http-error");
    if (responses.some((response) => Number(response.headers.get("content-length") ?? 0) > 524_288)) return empty("UNAVAILABLE", "oversized-response");
    const stats = statsSchema.safeParse(await statsResponse.json());
    const unresolved = z.array(issueSchema).safeParse(await unresolvedResponse.json());
    if (!stats.success || !unresolved.success) return empty("UNAVAILABLE", "malformed-response");
    const errorEvents24h = stats.data.reduce((sum, point) => sum + point[1], 0);
    const criticalEvents24h = unresolved.data.filter((issue) => ["fatal", "critical"].includes(issue.level.toLowerCase())).reduce((sum, issue) => sum + issueEvents24h(issue), 0);
    const issues = unresolved.data.slice(0, 10).map((issue): SafeSentryIssue => ({ id: issue.id, title: String(sanitizeMonitoringValue(issue.title)), level: issue.level, status: issue.status, count: Number(issue.count), firstSeen: new Date(issue.firstSeen), lastSeen: new Date(issue.lastSeen), transaction: issue.culprit && /^\/[A-Za-z0-9_./:[\]-]+$/.test(issue.culprit) ? issue.culprit : null, url: `https://${organization}.sentry.io/issues/${issue.id}/` }));
    const lastErrorAt = issues.reduce<Date | null>((latest, issue) => !latest || issue.lastSeen > latest ? issue.lastSeen : latest, null);
    return { status: deriveSentryHealth({ available: true, configured: true, errorEvents24h, criticalEvents24h, unresolvedIssues: unresolved.data.length }), providerState: "AVAILABLE", errorEvents24h, criticalEvents24h, unresolvedIssues: unresolved.data.length, lastErrorAt, issues };
  } catch { return empty("UNAVAILABLE", "timeout-or-network"); }
}

export function createSentryHealthCache(loader: () => Promise<SentryLiveHealth>, ttlMs = SENTRY_HEALTH_POLICY.cacheSeconds * 1_000, now = () => Date.now()) {
  let value: Promise<SentryLiveHealth> | null = null; let expiresAt = 0;
  return () => { if (!value || now() >= expiresAt) { expiresAt = now() + ttlMs; value = loader().catch((error) => { value = null; throw error; }); } return value; };
}
const getProcessCachedSentryHealth = createSentryHealthCache(fetchSentryLiveHealth);
export const getCachedSentryLiveHealth = unstable_cache(getProcessCachedSentryHealth, ["system-health-sentry-v2"], { revalidate: SENTRY_HEALTH_POLICY.cacheSeconds });

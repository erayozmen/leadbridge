import type { ErrorEvent, EventHint } from "@sentry/nextjs";

const SENSITIVE_KEY = /authorization|cookie|set-cookie|password|token|secret|api[-_]?key|turnstile[-_]?response|challenge[-_]?response|cron_secret|academy_integration_secret|database_url|backup_database_url|email|phone|national[-_]?id|tc(?:kimlik)?|(?:^|[-_])ip(?:$|[-_])|ipaddress|first[-_]?name|last[-_]?name|full[-_]?name|guardian[-_]?name|student[-_]?name/i;
const EMAIL = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const DATABASE_URL = /\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?):\/\/[^\s"']+/gi;
const PHONE = /(?<!\d)(?:\+?90\s?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{2}[\s.-]?\d{2}(?!\d)/g;

export const SENTRY_TRACE_SAMPLE_RATE = process.env.VERCEL_ENV === "production" ? 0.05 : 0.1;
export const SENTRY_ENVIRONMENT = process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development";
export const SENTRY_RELEASE = process.env.VERCEL_GIT_COMMIT_SHA;

function sanitizeString(value: string) {
  return value.replace(DATABASE_URL, "[Filtered]").replace(EMAIL, "[Filtered]").replace(PHONE, "[Filtered]");
}

export function sanitizeMonitoringValue(value: unknown, seen = new WeakSet<object>()): unknown {
  if (typeof value === "string") return sanitizeString(value);
  if (!value || typeof value !== "object") return value;
  if (seen.has(value)) return "[Circular]";
  seen.add(value);
  if (Array.isArray(value)) return value.map((item) => sanitizeMonitoringValue(item, seen));
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, SENSITIVE_KEY.test(key) ? "[Filtered]" : sanitizeMonitoringValue(item, seen)]));
}

export function beforeSend(event: ErrorEvent, _hint?: EventHint): ErrorEvent | null {
  void _hint;
  return sanitizeMonitoringValue(event) as ErrorEvent;
}

export function beforeSendTransaction<T>(event: T): T {
  return sanitizeMonitoringValue(event) as T;
}

export function sentryEnabled(dsn: string | undefined) {
  return Boolean(dsn) && process.env.NODE_ENV !== "development" && process.env.NODE_ENV !== "test";
}

type Entry = { count: number; resetAt: number };
const buckets = new Map<string, Entry>();

export function consumeRateLimit(key: string, options: { limit: number; windowMs: number }, now = Date.now()): boolean {
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + options.windowMs });
    return true;
  }
  if (current.count >= options.limit) return false;
  current.count += 1;
  return true;
}

export function clearRateLimitsForTests() { buckets.clear(); }

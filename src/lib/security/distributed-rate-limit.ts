import "server-only";

export type RateLimitWindow = { name: string; limit: number; windowMs: number };
export type DistributedRateLimitResult = { allowed: boolean; counts: number[] };
export type DistributedRateLimitStore = { consume(key: string, windows: readonly RateLimitWindow[]): Promise<DistributedRateLimitResult> };

type UpstashResult = { result?: number | string | null; error?: string };

export function createUpstashRateLimitStore(config: { url: string; token: string; fetchImpl?: typeof fetch }): DistributedRateLimitStore {
  const fetchImpl = config.fetchImpl ?? fetch;
  return {
    async consume(key, windows) {
      const commands = windows.flatMap((window) => [
        ["INCR", `${key}:${window.name}`],
        ["PEXPIRE", `${key}:${window.name}`, String(window.windowMs), "NX"],
      ]);
      const response = await fetchImpl(`${config.url.replace(/\/$/, "")}/multi-exec`, {
        method: "POST",
        headers: { authorization: `Bearer ${config.token}`, "content-type": "application/json" },
        body: JSON.stringify(commands),
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(3_000),
      });
      if (!response.ok) throw new Error(`Distributed rate limit unavailable (${response.status})`);
      const payload = await response.json() as unknown;
      if (!Array.isArray(payload) || payload.length !== commands.length) throw new Error("Distributed rate limit response is invalid");
      const results = payload as UpstashResult[];
      if (results.some((item) => item.error)) throw new Error("Distributed rate limit command failed");
      const counts = windows.map((_, index) => Number(results[index * 2]?.result));
      if (counts.some((count) => !Number.isSafeInteger(count) || count < 1)) throw new Error("Distributed rate limit response is invalid");
      return { allowed: windows.every((window, index) => counts[index] <= window.limit), counts };
    },
  };
}

export function getDistributedRateLimitStore(): DistributedRateLimitStore | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? createUpstashRateLimitStore({ url, token }) : null;
}

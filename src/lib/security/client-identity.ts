import "server-only";
import { createHmac } from "node:crypto";

function firstAddress(value: string | null): string | null {
  const address = value?.split(",")[0]?.trim();
  return address && address.length <= 64 ? address : null;
}

export function resolveTrustedClientIdentity(headers: Headers, production = process.env.NODE_ENV === "production"): string | null {
  if (production) return firstAddress(headers.get("x-vercel-forwarded-for"));
  return firstAddress(headers.get("x-vercel-forwarded-for")) ?? firstAddress(headers.get("x-forwarded-for")) ?? "development";
}

export function buildPrivateRateLimitKey(scope: string, identity: string, secret: string): string {
  return `rl:${scope}:${createHmac("sha256", secret).update(identity).digest("hex")}`;
}

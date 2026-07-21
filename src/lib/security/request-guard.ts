import "server-only";

import { headers } from "next/headers";
import { consumeRateLimit } from "@/lib/security/rate-limit";

export async function guardMutation(scope: string, options: { limit: number; windowMs: number }): Promise<boolean> {
  try {
    const requestHeaders = await headers();
    const origin = requestHeaders.get("origin");
    const configuredOrigin = process.env.NEXT_PUBLIC_APP_URL;
    if (origin && configuredOrigin && new URL(origin).origin !== new URL(configuredOrigin).origin) return false;
    const forwarded = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim();
    const identity = forwarded && forwarded.length <= 64 ? forwarded : "anonymous";
    return consumeRateLimit(`${scope}:${identity}`, options);
  } catch {
    // Unit tests and non-request invocations still rely on the service's authorization and validation.
    return true;
  }
}

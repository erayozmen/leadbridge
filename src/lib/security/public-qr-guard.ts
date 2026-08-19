import "server-only";
import { headers as nextHeaders } from "next/headers";
import { captureTechnicalException } from "@/lib/monitoring/capture";
import { buildPrivateRateLimitKey, resolveTrustedClientIdentity } from "./client-identity";
import { getDistributedRateLimitStore, type DistributedRateLimitStore } from "./distributed-rate-limit";
import { PUBLIC_QR_SECURITY_POLICY } from "./public-qr-policy";
import { verifyTurnstileToken, type TurnstileVerification } from "./turnstile";

export type PublicQrGuardResult = { allowed: true } | { allowed: false; reason: "ORIGIN" | "RATE_LIMIT" | "TURNSTILE" | "CONTROL_UNAVAILABLE" };
type Dependencies = { requestHeaders?: Headers; store?: DistributedRateLimitStore | null; verify?: (token: string, options: { expectedHostname?: string; production: boolean }) => Promise<TurnstileVerification>; production?: boolean };

export async function guardPublicQrMutation(turnstileToken: string, dependencies: Dependencies = {}): Promise<PublicQrGuardResult> {
  const production = dependencies.production ?? process.env.NODE_ENV === "production";
  let requestHeaders: Headers;
  try { requestHeaders = dependencies.requestHeaders ?? await nextHeaders(); } catch { return production ? { allowed: false, reason: "CONTROL_UNAVAILABLE" } : { allowed: true }; }

  const configuredOrigin = process.env.NEXT_PUBLIC_APP_URL;
  const origin = requestHeaders.get("origin");
  let expectedHostname: string | undefined;
  try {
    const configuredUrl = configuredOrigin ? new URL(configuredOrigin) : null;
    expectedHostname = configuredUrl?.hostname;
    if (origin && configuredUrl && new URL(origin).origin !== configuredUrl.origin) return { allowed: false, reason: "ORIGIN" };
    if (production && (!origin || !configuredOrigin)) return { allowed: false, reason: "ORIGIN" };
  } catch { return { allowed: false, reason: "ORIGIN" }; }

  const identity = resolveTrustedClientIdentity(requestHeaders, production);
  const keySecret = process.env.RATE_LIMIT_KEY_SECRET;
  const store = dependencies.store === undefined ? getDistributedRateLimitStore() : dependencies.store;
  if (!identity || !keySecret || !store) {
    if (production) {
      captureTechnicalException(new Error("Public QR distributed rate limit is not configured"), { feature: "public-qr-security", operation: "guard", control: "distributed-rate-limit", failureKind: "missing-config" });
      return { allowed: false, reason: "CONTROL_UNAVAILABLE" };
    }
  } else {
    try {
      const result = await store.consume(buildPrivateRateLimitKey("public-registration", identity, keySecret), PUBLIC_QR_SECURITY_POLICY.rateLimits);
      if (!result.allowed) return { allowed: false, reason: "RATE_LIMIT" };
    } catch (error) {
      captureTechnicalException(error, { feature: "public-qr-security", operation: "guard", control: "distributed-rate-limit", failureKind: "provider-unavailable" });
      if (production) return { allowed: false, reason: "CONTROL_UNAVAILABLE" };
    }
  }

  const verification = await (dependencies.verify ?? verifyTurnstileToken)(turnstileToken, { expectedHostname, production });
  if (verification.status === "VALID" || verification.status === "BYPASSED") return { allowed: true };
  if (verification.status === "UNAVAILABLE" || verification.status === "NOT_CONFIGURED") {
    captureTechnicalException(new Error("Public QR Turnstile verification unavailable"), { feature: "public-qr-security", operation: "guard", control: "turnstile", failureKind: verification.failureKind ?? "unavailable" });
    return { allowed: false, reason: "CONTROL_UNAVAILABLE" };
  }
  return { allowed: false, reason: "TURNSTILE" };
}

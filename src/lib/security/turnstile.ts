import "server-only";
import { z } from "zod";
import { PUBLIC_QR_SECURITY_POLICY } from "./public-qr-policy";

const responseSchema = z.object({
  success: z.boolean(),
  hostname: z.string().optional(),
  action: z.string().optional(),
  "error-codes": z.array(z.string()).optional(),
});

export type TurnstileVerification = { status: "VALID" | "INVALID" | "UNAVAILABLE" | "NOT_CONFIGURED" | "BYPASSED"; failureKind?: string };

export async function verifyTurnstileToken(token: string, options: { secret?: string; expectedHostname?: string; production?: boolean; fetchImpl?: typeof fetch } = {}): Promise<TurnstileVerification> {
  const production = options.production ?? process.env.NODE_ENV === "production";
  const secret = options.secret ?? process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return production ? { status: "NOT_CONFIGURED", failureKind: "missing-config" } : { status: "BYPASSED" };
  if (!token || token.length > 2_048) return { status: "INVALID", failureKind: "invalid-token" };
  try {
    const body = new URLSearchParams({ secret, response: token });
    const response = await (options.fetchImpl ?? fetch)("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(PUBLIC_QR_SECURITY_POLICY.turnstileTimeoutMs) });
    if (!response.ok) return { status: "UNAVAILABLE", failureKind: "http-error" };
    if (Number(response.headers.get("content-length") ?? 0) > 32_768) return { status: "UNAVAILABLE", failureKind: "malformed-response" };
    const parsed = responseSchema.safeParse(await response.json());
    if (!parsed.success) return { status: "UNAVAILABLE", failureKind: "malformed-response" };
    if (!parsed.data.success) return { status: "INVALID", failureKind: parsed.data["error-codes"]?.includes("timeout-or-duplicate") ? "expired-or-replayed" : "invalid-token" };
    if (parsed.data.action !== PUBLIC_QR_SECURITY_POLICY.turnstileAction) return { status: "INVALID", failureKind: "action-mismatch" };
    if (options.expectedHostname && parsed.data.hostname !== options.expectedHostname) return { status: "INVALID", failureKind: "hostname-mismatch" };
    return { status: "VALID" };
  } catch {
    return { status: "UNAVAILABLE", failureKind: "network-or-timeout" };
  }
}

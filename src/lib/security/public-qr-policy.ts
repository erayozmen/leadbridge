export const PUBLIC_QR_SECURITY_POLICY = {
  turnstileAction: "public-qr-registration",
  turnstileTimeoutMs: 5_000,
  rateLimits: [
    { name: "burst", limit: 8, windowMs: 60_000 },
    { name: "sustained", limit: 30, windowMs: 15 * 60_000 },
  ],
} as const;

export const TURNSTILE_RESPONSE_FIELD = "cf-turnstile-response";

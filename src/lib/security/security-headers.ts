export const SECURITY_HEADER_STATE = {
  contentSecurityPolicy: true,
  frameProtection: true,
  hstsInProduction: true,
  mimeSniffingProtection: true,
  referrerPolicy: true,
} as const;

export function buildContentSecurityPolicy(production: boolean): string {
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "object-src 'none'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "style-src 'self' 'unsafe-inline'",
    // Next.js emits inline bootstrap scripts. A nonce-based CSP is a separate,
    // dynamic-rendering migration; unsafe-eval is intentionally never allowed.
    "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com",
    "frame-src https://challenges.cloudflare.com",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.ingest.sentry.io https://*.ingest.us.sentry.io https://challenges.cloudflare.com",
    ...(production ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}

export function getSecurityHeaders(production: boolean): Array<{ key: string; value: string }> {
  return [
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
    { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
    { key: "Content-Security-Policy", value: buildContentSecurityPolicy(production) },
    ...(production ? [{ key: "Strict-Transport-Security", value: "max-age=31536000" }] : []),
  ];
}

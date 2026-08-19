import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";
import { getSecurityHeaders } from "./src/lib/security/security-headers";

const nextConfig: NextConfig = {
  async headers() {
    return [{
      source: "/(.*)",
      headers: getSecurityHeaders(process.env.NODE_ENV === "production"),
    }];
  },
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  widenClientFileUpload: true,
  sourcemaps: { deleteSourcemapsAfterUpload: true },
  webpack: { automaticVercelMonitors: false },
  telemetry: false,
});

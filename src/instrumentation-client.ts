import * as Sentry from "@sentry/nextjs";
import { beforeSend, beforeSendTransaction, SENTRY_ENVIRONMENT, SENTRY_RELEASE, SENTRY_TRACE_SAMPLE_RATE, sentryEnabled } from "@/lib/monitoring/sentry-config";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
Sentry.init({
  dsn,
  enabled: sentryEnabled(dsn),
  environment: SENTRY_ENVIRONMENT,
  release: SENTRY_RELEASE,
  sendDefaultPii: false,
  tracesSampleRate: SENTRY_TRACE_SAMPLE_RATE,
  beforeSend,
  beforeSendTransaction,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;

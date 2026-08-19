import * as Sentry from "@sentry/nextjs";

type TechnicalErrorContext = {
  feature: string;
  operation: string;
  source?: "CRON" | "MANUAL";
  syncRunId?: string;
  runStatus?: string;
  candidateCount?: number;
  matchedCount?: number;
  errorCount?: number;
  control?: "turnstile" | "distributed-rate-limit";
  failureKind?: string;
};

export function captureTechnicalException(error: unknown, context: TechnicalErrorContext) {
  try {
    Sentry.withScope((scope) => {
      scope.setTag("feature", context.feature);
      scope.setTag("operation", context.operation);
      if (context.source) scope.setTag("source", context.source);
      if (context.syncRunId) scope.setTag("syncRunId", context.syncRunId);
      if (context.runStatus) scope.setTag("runStatus", context.runStatus);
      if (context.control) scope.setTag("control", context.control);
      if (context.failureKind) scope.setTag("failureKind", context.failureKind);
      scope.setContext("operation", {
        candidateCount: context.candidateCount,
        matchedCount: context.matchedCount,
        errorCount: context.errorCount,
      });
      Sentry.captureException(error);
    });
  } catch {
    // Monitoring must never interrupt the application flow.
  }
}

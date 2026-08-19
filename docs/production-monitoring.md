# Production monitoring

LeadBridges uses Sentry for technical runtime failures and performance tracing. `AcademySyncRun` remains the operational/business history for Academy synchronization; Sentry does not replace it.

## Vercel environment variables

Set these variables in Vercel for Production and Preview with the appropriate environment-specific project values:

- `SENTRY_DSN`: server and edge event ingestion DSN.
- `NEXT_PUBLIC_SENTRY_DSN`: public browser ingestion DSN. A DSN is not an authentication secret, but it must be the intended Sentry project DSN.
- `SENTRY_ORG`: Sentry organization slug used during source-map upload.
- `SENTRY_PROJECT`: Sentry project slug used during source-map upload.
- `SENTRY_AUTH_TOKEN`: secret build credential used only to upload source maps. Never expose it with a `NEXT_PUBLIC_` prefix.

Vercel supplies `VERCEL_ENV` and `VERCEL_GIT_COMMIT_SHA`; they identify the Sentry environment and release. Preview and production events therefore remain separate. Local development and tests do not send events.

## Source maps

The Next.js Sentry build plugin uploads source maps when `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, and `SENTRY_PROJECT` are available. Uploaded maps are deleted from build output afterward so they are not intentionally served publicly. A build without upload credentials still compiles, but stack traces will not be de-minified until a deployment with valid credentials uploads its artifacts.

## Data protection

Default PII collection is disabled. A centralized `beforeSend` filter redacts authorization and cookie headers, credentials, tokens, secrets, database URLs, email addresses, phone numbers, and national-ID-like keyed fields. Monitoring context must contain counts and internal run identifiers only; raw request bodies and student payloads must never be attached.

## Academy synchronization

- `AcademySyncRun`: candidate/match/adjustment counts and operational run status shown in the application.
- Sentry: timeouts, unreachable/malformed Academy responses, unexpected transaction failures, and cron/manual execution exceptions.

Normal `NOT_FOUND`, `AMBIGUOUS`, validation, authentication, and authorization outcomes are not technical errors and must not be manually captured.

## Operations

Inspect errors and traces in the configured Sentry project under Issues and Traces. Filter Academy failures using `feature=academy-commission-sync` and `source=CRON|MANUAL`. Rotating `CRON_SECRET` or `ACADEMY_INTEGRATION_SECRET` does not require a Sentry configuration change. Rotating `SENTRY_AUTH_TOKEN` affects future source-map uploads only; rotating a DSN requires updating the corresponding DSN environment variables.

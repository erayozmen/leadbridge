# LeadBridge

LeadBridge is a student conversion and event operations platform for tracking the journey from a VR experience through QR registration, event attendance, and language-course enrollment.

Production: [https://www.leadbridges.com.tr](https://www.leadbridges.com.tr)

## Technology Stack

- Next.js App Router, React, and TypeScript
- Tailwind CSS and shadcn/ui
- Supabase email/password authentication
- PostgreSQL with Prisma ORM
- Zod validation
- Vitest unit tests
- Vercel deployment from the GitHub `main` branch

## Roles

### ADMIN

Administrators can manage schools, VR records, QR cards, student matching, attendance, course enrollment, reports, and audited reversal operations.

### STAFF

Staff users can create and search VR records and mark event attendance. They cannot access administrator routes, reports, QR management, student matching management, course enrollment management, or reversal operations.

Supabase authentication alone does not grant application access. Every authenticated user must have a matching, `ACTIVE` Prisma `User` record.

## MVP Modules

- Protected dashboard with role-based navigation
- School management with active/inactive status
- VR student registration, filtering, and pagination
- Secure bulk QR generation and PNG ZIP/CSV output
- Atomic QR assignment and safe unused-assignment reversal
- Public single-use QR registration
- Manual VR and QR-registration matching
- Event attendance management and audited reversal
- Manual language-course enrollment and audited reversal
- Live dashboard KPIs and administrator reports
- Append-only AuditLog infrastructure
- ADMIN AuditLog explorer with redacted JSON details
- Audited ADMIN user role and status management
- Filtered, UTF-8 and formula-injection-safe CSV exports
- Configurable 25/50/100-row management lists
- VR CSV import with preview, validation, duplicate detection, and atomic acceptance
- Mobile QR attendance scanner with manual fallback
- Provider timeout, retry, rate-limit, and unavailable boundaries
- Public registration and scanner mutation rate limiting
- Multi-event lifecycle management with server-validated active event context
- Event-scoped operational records, dashboard metrics, and reports
- Persistent per-user notifications with read/unread state

## Local Setup

Requirements:

- Node.js compatible with Next.js 16
- npm
- A Supabase project with PostgreSQL and email/password authentication

Install dependencies:

```bash
npm install
```

`postinstall` runs `prisma generate`, so Prisma Client is available in clean development and deployment environments.

Copy the environment template:

```powershell
Copy-Item .env.example .env.local
```

Add real values only to `.env.local`. Never commit that file.

Start the development server:

```bash
npm run dev
```

## Environment Variables

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser-safe Supabase publishable key |
| `NEXT_PUBLIC_APP_URL` | Public application origin used for QR registration links |
| `DATABASE_URL` | Application runtime PostgreSQL connection |
| `DIRECT_URL` | Direct or session-pooler PostgreSQL connection used by Prisma migrations |

Do not add service-role keys, database passwords, or other secrets to tracked files.

## Production Operations

- `GET /api/health` provides a cache-free uptime probe without database or environment details.
- Global response headers deny framing, restrict browser capabilities, and apply a conservative content security policy.
- Vercel deploys the GitHub `main` branch; Prisma Client is generated during `postinstall`.
- Database migrations are reviewed and committed separately, then deployed through the controlled release process.
- Verify Supabase backups, migration status, authentication, public QR registration, and ADMIN/STAFF permissions during every production acceptance cycle.
- In-memory rate limiting provides a first server-instance boundary. A distributed Vercel-compatible rate-limit store is recommended before high-volume public campaigns.
- Course-provider integration deliberately reports "not configured" until real credentials and a reviewed provider adapter are supplied.

## Prisma

Validate and generate the client:

```bash
npm run db:validate
npm run db:generate
```

Create a development migration only after reviewing a deliberate schema change:

```bash
npm run db:migrate:dev -- --name <migration_name>
```

Apply committed migrations in an approved deployment context:

```bash
npm run db:migrate:deploy
```

Never use `prisma db push` or `prisma migrate reset` against production.

## Quality Checks

```bash
npm run test:run
npm run db:validate
npm run lint
npm run build
```

Useful development commands:

```bash
npm test
npm run db:studio
```

Unit tests mock Prisma and Supabase boundaries and do not write test data to the real database.

## Deployment

Production deployments are triggered by pushes to GitHub `main` and built by Vercel. The production environment must define all variables listed in `.env.example`. Prisma Client generation is handled by `postinstall`.

Database migrations are versioned under `prisma/migrations`. Deploying application code does not replace migration review; check `prisma migrate status` and apply pending migrations explicitly when a release includes one.

## Audit And Reversals

LeadBridge records these administrator-only reversals:

- `STUDENT_MATCH_REMOVED`
- `QR_ASSIGNMENT_REVERSED`
- `ATTENDANCE_REVERSED`
- `COURSE_ENROLLMENT_REVERSED`

Each reversal requires a trimmed reason of 10 to 500 characters. The domain mutation and AuditLog insert run in the same Prisma transaction, so an audit failure rolls back the mutation. Audit payloads contain only operational identifiers and changed state; QR tokens, hashes, student personal data, auth data, raw requests, and raw errors are excluded.

## Events And Notifications

Event statuses advance in one direction: `DRAFT` to `ACTIVE`, `ACTIVE` to
`COMPLETED`, and `COMPLETED` to `ARCHIVED`. Operational writes require a
server-validated selected event. Public registration derives the event from
the QR card and accepts only an `ACTIVE` event. Cross-event QR assignment and
student matching are rejected.

Notifications are persistent and user-scoped. Users can read or mark only
their own notifications. Notification delivery is best-effort; AuditLog remains
the mandatory transactional history for sensitive mutations. Review
`docs/v1.2-production-rollout.md` before deploying the v1.2 migrations.

## MVP Scope

LeadBridge MVP v1.0 covers the operational funnel from VR registration through QR registration, matching, attendance, course enrollment, and summary reporting for ADMIN and STAFF roles.

The following remain outside the MVP:

- Live language-school provider integration, import, and synchronization
- Audit history UI and exports
- Spreadsheet report exports
- Email/push notifications and invitation workflows
- Advanced user management
- Row-level security architecture
- Redis or additional caching infrastructure
- Native mobile applications

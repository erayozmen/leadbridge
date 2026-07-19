# LeadBridge

VR Event CRM built with Next.js App Router, TypeScript, Tailwind CSS, and shadcn/ui.

## Development

```bash
npm run dev
```

## Environment Setup

1. Copy `.env.example` to `.env.local`.
2. Add your Supabase Project URL to `NEXT_PUBLIC_SUPABASE_URL`.
3. Add your Supabase Publishable Key to `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
4. Add the application runtime PostgreSQL connection string to `DATABASE_URL`.
5. Add the direct PostgreSQL connection string for migrations and direct database operations to `DIRECT_URL`.
6. Keep real values only in `.env.local`.
7. Do not commit `.env.local` or any secret values.

## Core Data Model

LeadBridge scopes operational data by organization through `organizationId`, which represents the tenant boundary for venues, events, participants, QR batches, payments, and audit logs.

Events connect an organization to a venue and own the registration, QR batch, QR code, staff assignment, and payment flows needed for VR event operations.

Participants belong to an organization and can have many registrations, allowing the same participant record to be reused across events without duplicating identity details.

Payments are tied to organization and event context, optionally linked to a registration and collector user, while audit logs preserve traceability for user actions without cascading away financial or audit history.

# Production backup and disaster recovery

## Operational metadata workflow

After a successful custom-format dump and `pg_restore --list` verification, `npm run backup:production` creates a sibling `.manifest.json`. The manifest contains only timestamp, byte size, SHA-256 checksum, pg_dump version, and verification method; it contains no connection string or absolute path.

Never upload the backup file to the application. In System Health → Yedekleme → Backup Durumunu Doğrula, record the Supabase managed backup/PITR state and optionally paste the manifest JSON. This operation is ADMIN-only and writes an AuditLog.

Recommended cadence:

- Verify Supabase managed backup at least every 7 days.
- Produce a logical backup and record its manifest at least every 7 days.
- Perform an isolated restore rehearsal at least every 90 days.
- PITR is optional enhanced protection; disabled PITR alone does not reduce backup health.

This runbook defines the two-layer recovery approach for LeadBridges: Supabase managed physical backup/PITR plus an independently stored PostgreSQL logical backup. It does not assert that either layer is enabled; operators must verify the current production project in Supabase before every risky release.

## 1. Verify Supabase managed protection

In the production Supabase Dashboard open **Database → Backups** and record, outside the application repository:

1. Project plan and whether managed daily physical backups are available.
2. The newest completed backup and its timestamp.
3. Whether PITR is enabled.
4. PITR earliest/latest recovery points and retention window.
5. Whether the chosen recovery point meets the current RPO.

PITR replaces daily backups while enabled. Physical backups may not be downloadable. Database backups do not restore deleted Storage objects; Storage requires a separate policy if the application begins storing business files there.

## 2. Create and verify a logical backup

Install PostgreSQL client tools containing compatible `pg_dump` and `pg_restore` versions. Use a direct/session connection suitable for administrative exports, not a transaction pooler.

Set `BACKUP_DATABASE_URL` only in the secured operator shell, then run:

```powershell
$env:BACKUP_DATABASE_URL="<production direct PostgreSQL URL>"
npm run backup:production
Remove-Item Env:BACKUP_DATABASE_URL
```

The script creates a timestamped custom-format schema + data dump under `backups/`, verifies that it is non-empty and readable with `pg_restore --list`, and returns a non-zero exit code on failure. The folder and dump extensions are ignored by Git.

Move the verified dump immediately to the approved encrypted, access-controlled, off-site location. Record its checksum, size, timestamp, PostgreSQL client version, source environment, operator, and verification result in the external operations register. The application does not maintain this metadata and therefore cannot display a last-backup timestamp.

## 3. Pre-restore controls

1. Declare an incident owner and maintenance window; stop writes where required.
2. Confirm the target project and recovery point twice. Never test a restore over production.
3. Capture a new pre-restore backup when the database is still accessible.
4. Record current deployment SHA and Vercel environment configuration.
5. Run `npx prisma migrate status` against the intended target.
6. Inventory PostgreSQL extensions, roles, replication/subscription slots, Auth configuration, Storage objects, Edge Functions and network restrictions.
7. Restore first into a new isolated Supabase project whenever the plan and incident allow it.

## 4. Supabase managed restore/PITR

Use **Database → Backups** in Supabase Dashboard. Select the nearest valid backup before the incident, or choose a PITR timestamp inside the displayed recovery window. Review the confirmation carefully; the project is unavailable during an in-place restore. Replication slots/subscriptions may require explicit handling. For a restore to a new project, reconfigure items that are not database content, including Storage objects/settings, Edge Functions, Auth settings/API keys, Realtime settings and read replicas.

## 5. Logical restore rehearsal

Perform logical restore only into an empty, isolated recovery project using official Supabase/PostgreSQL procedures. Never run this example against production without an approved incident plan:

```text
pg_restore --list backups/leadbridge-<timestamp>.dump
pg_restore --clean --if-exists --no-owner --no-privileges --dbname <isolated-target-url> backups/leadbridge-<timestamp>.dump
```

`--clean` is destructive and is documented only for a confirmed isolated restore target. Supabase-managed schemas, roles, Auth and Storage may require the more detailed Supabase CLI backup/restore procedure instead of a blind full restore.

## 6. Post-restore validation

1. Run `npx prisma migrate status`; do not use `prisma db push` or `migrate reset`.
2. Confirm the application build matches the restored schema version.
3. Verify `/api/health`, admin authentication and ADMIN/STAFF authorization.
4. Smoke-test public QR registration, QR assignment, attendance and matching.
5. Verify `AcademyStudentLink`, `AcademyPaymentSnapshot`, immutable `AcademyCommissionLedger` totals and their foreign-key relationships.
6. Check the newest `AcademySyncRun`; keep cron paused until ledger/snapshot consistency is confirmed, then run one controlled sync and verify no duplicate adjustment.
7. Verify audit logs, reports and exports.
8. Reconfigure/rotate environment credentials when restoring to a new project.
9. Record recovery duration, achieved recovery point, validation evidence and follow-up actions.

Official references: Supabase Database Backups and Point-in-Time Recovery, Restore to a New Project, and Backup and Restore using the CLI.

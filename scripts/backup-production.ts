import { chmodSync, createReadStream, existsSync, mkdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

function fail(message: string): never {
  console.error(`[backup] ${message}`);
  process.exit(1);
}

const connectionString = process.env.BACKUP_DATABASE_URL;
if (!connectionString) fail("BACKUP_DATABASE_URL is required.");

let databaseUrl: URL;
try { databaseUrl = new URL(connectionString); } catch { fail("BACKUP_DATABASE_URL is not a valid PostgreSQL URL."); }
if (!/^postgres(?:ql)?:$/.test(databaseUrl.protocol)) fail("BACKUP_DATABASE_URL must use the PostgreSQL protocol.");

const pgEnv: NodeJS.ProcessEnv = { ...process.env, PGHOST: databaseUrl.hostname, PGPORT: databaseUrl.port || "5432", PGDATABASE: databaseUrl.pathname.replace(/^\//, ""), PGUSER: decodeURIComponent(databaseUrl.username), PGPASSWORD: decodeURIComponent(databaseUrl.password), PGSSLMODE: databaseUrl.searchParams.get("sslmode") ?? "require" };
delete pgEnv.BACKUP_DATABASE_URL;
delete pgEnv.DATABASE_URL;
delete pgEnv.DIRECT_URL;

let pgDumpVersion = "";
for (const command of ["pg_dump", "pg_restore"]) {
  const probe = spawnSync(command, ["--version"], { env: pgEnv, encoding: "utf8", windowsHide: true });
  if (probe.status !== 0) fail(`${command} is required and must be available on PATH.`);
  if (command === "pg_dump") pgDumpVersion = probe.stdout.trim();
}

const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const outputDirectory = resolve(process.env.BACKUP_OUTPUT_DIR || "backups");
mkdirSync(outputDirectory, { recursive: true });
const outputPath = resolve(outputDirectory, `leadbridge-${timestamp}.dump`);
if (!outputPath.startsWith(`${outputDirectory}\\`) && !outputPath.startsWith(`${outputDirectory}/`)) fail("Backup output path is invalid.");

console.log(`[backup] Starting logical schema + data backup: ${outputPath}`);
const dump = spawnSync("pg_dump", ["--format=custom", "--no-owner", "--no-privileges", "--file", outputPath], { env: pgEnv, stdio: "inherit", windowsHide: true });
if (dump.status !== 0 || !existsSync(outputPath)) { if (existsSync(outputPath)) rmSync(outputPath); fail("pg_dump failed."); }

const size = statSync(outputPath).size;
const verification = spawnSync("pg_restore", ["--list", outputPath], { env: pgEnv, encoding: "utf8", windowsHide: true });
if (size === 0 || verification.status !== 0 || !verification.stdout.trim()) { rmSync(outputPath); fail("Backup integrity verification failed; incomplete file removed."); }
try { chmodSync(outputPath, 0o600); } catch { /* Best effort on platforms without POSIX modes. */ }
const hash = createHash("sha256");
for await (const chunk of createReadStream(outputPath)) hash.update(chunk);
const manifestPath = `${outputPath}.manifest.json`;
writeFileSync(manifestPath, `${JSON.stringify({ manifestVersion: 1, backupCreatedAt: new Date().toISOString(), sizeBytes: size, checksumSha256: hash.digest("hex"), pgDumpVersion, verificationStatus: "VERIFIED", verificationMethod: "pg_restore --list" }, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
console.log(`[backup] Backup and manifest verified successfully (${size} bytes). Store both encrypted in the approved off-site backup location.`);

import "server-only";
import { AcademyMatchStatus, AcademySyncRunSource, AcademySyncRunStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ACADEMY_COMMISSION_RATE, calculateCommissionAdjustment } from "./domain";

type RemoteResult = { leadbridgesStudentId: string; status: "MATCHED" | "NOT_FOUND" | "AMBIGUOUS"; academyStudentId?: string; totalPaid?: string; currency?: string };

async function callAcademy(students: Array<{ leadbridgesStudentId: string; firstName?: string; lastName?: string; academyStudentId?: string }>) {
  const url = process.env.ACADEMY_API_BASE_URL, secret = process.env.ACADEMY_INTEGRATION_SECRET;
  if (!url || !secret) throw new Error("Academy integration is not configured");
  const response = await fetch(`${url.replace(/\/$/, "")}/api/integrations/leadbridges/students/lookup`, { method: "POST", headers: { authorization: `Bearer ${secret}`, "content-type": "application/json" }, body: JSON.stringify({ students }), signal: AbortSignal.timeout(10_000), cache: "no-store" });
  if (!response.ok) throw new Error(`Academy lookup failed (${response.status})`);
  const body = await response.json() as { results?: RemoteResult[] };
  if (!Array.isArray(body.results)) throw new Error("Academy lookup response is invalid");
  return body.results;
}

export async function runAcademyCommissionSync(source: AcademySyncRunSource = AcademySyncRunSource.CRON) {
  const claimed = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(736241)`;
    const active = await tx.academySyncRun.findFirst({ where: { status: AcademySyncRunStatus.RUNNING, startedAt: { gt: new Date(Date.now() - 30 * 60_000) } } });
    return active ? { run: active, created: false } : { run: await tx.academySyncRun.create({ data: { source } }), created: true };
  });
  const run = claimed.run;
  if (!claimed.created) return { runId: run.id, skipped: true };
  const candidates = await prisma.studentMatch.findMany({ select: { vrRecord: { select: { id: true, firstName: true, lastName: true, academyLink: { select: { academyStudentId: true, status: true } } } }, qrRegistrationId: true } });
  await prisma.academySyncRun.update({ where: { id: run.id }, data: { candidateCount: candidates.length } });
  if (!candidates.length) { await prisma.academySyncRun.update({ where: { id: run.id }, data: { status: AcademySyncRunStatus.COMPLETED, finishedAt: new Date() } }); return { runId: run.id, skipped: false, matched: 0, notFound: 0, ambiguous: 0, adjustments: 0, errors: 0 }; }
  let results: RemoteResult[];
  try {
    results = await callAcademy(candidates.map(({ vrRecord }) => vrRecord.academyLink?.academyStudentId ? { leadbridgesStudentId: vrRecord.id, academyStudentId: vrRecord.academyLink.academyStudentId } : { leadbridgesStudentId: vrRecord.id, firstName: vrRecord.firstName, lastName: vrRecord.lastName }));
  } catch (error) {
    await prisma.academySyncRun.update({ where: { id: run.id }, data: { status: AcademySyncRunStatus.FAILED, finishedAt: new Date(), errorCount: 1 } });
    throw error;
  }
  const counts = { matched: 0, notFound: 0, ambiguous: 0, adjustments: 0, errors: 0 };
  for (const result of results) {
    const candidate = candidates.find((item) => item.vrRecord.id === result.leadbridgesStudentId); if (!candidate) { counts.errors++; continue; }
    const status = AcademyMatchStatus[result.status]; if (status === AcademyMatchStatus.MATCHED) counts.matched++; else if (status === AcademyMatchStatus.NOT_FOUND) counts.notFound++; else counts.ambiguous++;
    try {
      await prisma.$transaction(async (tx) => {
        const active = await tx.studentMatch.findUnique({ where: { vrRecordId: candidate.vrRecord.id }, select: { qrRegistrationId: true } }); if (!active) return;
        const now = new Date();
        await tx.academyStudentLink.upsert({ where: { vrRecordId: candidate.vrRecord.id }, create: { vrRecordId: candidate.vrRecord.id, qrRegistrationId: active.qrRegistrationId, academyStudentId: result.academyStudentId, status, matchedAt: status === AcademyMatchStatus.MATCHED ? now : null, lastCheckedAt: now }, update: { qrRegistrationId: active.qrRegistrationId, academyStudentId: result.academyStudentId, status, matchedAt: status === AcademyMatchStatus.MATCHED ? (candidate.vrRecord.academyLink ? undefined : now) : undefined, lastCheckedAt: now } });
        if (status !== AcademyMatchStatus.MATCHED || !result.academyStudentId || result.totalPaid === undefined || !result.currency) return;
        const current = new Prisma.Decimal(result.totalPaid); const snapshot = await tx.academyPaymentSnapshot.findUnique({ where: { vrRecordId: candidate.vrRecord.id } });
        const previous = snapshot?.lastObservedPaidAmount ?? new Prisma.Decimal(0); const { delta, commission } = calculateCommissionAdjustment(current, previous); const nextVersion = (snapshot?.version ?? 0) + 1;
        if (snapshot) await tx.academyPaymentSnapshot.update({ where: { vrRecordId: candidate.vrRecord.id, version: snapshot.version }, data: { academyStudentId: result.academyStudentId, lastObservedPaidAmount: current, currency: result.currency, lastSyncedAt: now, version: { increment: 1 } } });
        else await tx.academyPaymentSnapshot.create({ data: { vrRecordId: candidate.vrRecord.id, academyStudentId: result.academyStudentId, lastObservedPaidAmount: current, currency: result.currency, lastSyncedAt: now, version: nextVersion } });
        if (!delta.isZero()) { await tx.academyCommissionLedger.create({ data: { vrRecordId: candidate.vrRecord.id, academyStudentId: result.academyStudentId, academyPaymentDelta: delta, commissionRate: ACADEMY_COMMISSION_RATE, commissionAmount: commission, academyTotalPaidAfter: current, currency: result.currency, snapshotVersion: nextVersion, syncRunId: run.id } }); counts.adjustments++; }
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch { counts.errors++; }
  }
  await prisma.academySyncRun.update({ where: { id: run.id }, data: { finishedAt: new Date(), status: counts.errors ? AcademySyncRunStatus.PARTIAL : AcademySyncRunStatus.COMPLETED, matchedCount: counts.matched, notFoundCount: counts.notFound, ambiguousCount: counts.ambiguous, commissionAdjustmentCount: counts.adjustments, errorCount: counts.errors } });
  return { runId: run.id, skipped: false, ...counts };
}

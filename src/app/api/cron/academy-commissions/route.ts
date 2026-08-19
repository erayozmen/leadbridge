import { timingSafeEqual } from "node:crypto";
import { AcademySyncRunSource } from "@prisma/client";
import { NextResponse } from "next/server";
import { runAcademyCommissionSync } from "@/features/academy-commissions/sync";
import { captureTechnicalException } from "@/lib/monitoring/capture";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET, supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!secret || !supplied || Buffer.byteLength(secret) !== Buffer.byteLength(supplied) || !timingSafeEqual(Buffer.from(secret), Buffer.from(supplied))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try { return NextResponse.json(await runAcademyCommissionSync(AcademySyncRunSource.CRON)); } catch (error) { captureTechnicalException(error, { feature: "academy-commission-sync", operation: "cron-route", source: "CRON", runStatus: "FAILED" }); return NextResponse.json({ error: "Sync failed" }, { status: 502 }); }
}

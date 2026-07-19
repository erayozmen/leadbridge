import "server-only";

import type { Prisma } from "@prisma/client";
import {
  attendedRegistrationsWhere,
  courseEnrollmentsWhere,
  distributedQrCodesWhere,
  totalQrRegistrationsWhere,
  totalVrRecordsWhere,
} from "@/features/reports/queries/report-count-definitions";
import type { DashboardOverviewSummary } from "@/features/reports/types/dashboard-overview-summary";

export type DashboardOverviewDependencies = {
  requireAdmin: () => Promise<unknown>;
  countQrCodes: (where: Prisma.QrCodeWhereInput) => Promise<number>;
  countVrRecords: (where: Prisma.VrRecordWhereInput) => Promise<number>;
  countQrRegistrations: (where: Prisma.QrRegistrationWhereInput) => Promise<number>;
};

async function getDefaultDependencies(): Promise<DashboardOverviewDependencies> {
  const [{ requireAdmin }, { prisma }] = await Promise.all([
    import("@/features/auth/server/auth"),
    import("@/lib/prisma"),
  ]);

  return {
    requireAdmin,
    countQrCodes: (where) => prisma.qrCode.count({ where }),
    countVrRecords: (where) => prisma.vrRecord.count({ where }),
    countQrRegistrations: (where) => prisma.qrRegistration.count({ where }),
  };
}

export async function getDashboardOverviewSummary(
  dependencies?: DashboardOverviewDependencies,
): Promise<DashboardOverviewSummary> {
  const resolved = dependencies ?? (await getDefaultDependencies());
  await resolved.requireAdmin();

  const [
    totalVrRecords,
    distributedQrCodes,
    totalQrRegistrations,
    attendedRegistrations,
    courseEnrollments,
  ] = await Promise.all([
    resolved.countVrRecords(totalVrRecordsWhere),
    resolved.countQrCodes(distributedQrCodesWhere),
    resolved.countQrRegistrations(totalQrRegistrationsWhere),
    resolved.countQrRegistrations(attendedRegistrationsWhere),
    resolved.countQrRegistrations(courseEnrollmentsWhere),
  ]);

  return {
    totalVrRecords,
    distributedQrCodes,
    totalQrRegistrations,
    attendedRegistrations,
    courseEnrollments,
  };
}

import "server-only";

import { QrCodeStatus, type Prisma } from "@prisma/client";
import {
  attendedRegistrationsWhere,
  courseEnrollmentsWhere,
  totalQrRegistrationsWhere,
  totalVrRecordsWhere,
} from "@/features/reports/queries/report-count-definitions";
import type { ReportSummary } from "@/features/reports/types/report-summary";

export type ReportSummaryDependencies = {
  requireAdmin: () => Promise<unknown>;
  countSchools: (where: Prisma.SchoolWhereInput) => Promise<number>;
  countQrCodes: (where: Prisma.QrCodeWhereInput) => Promise<number>;
  countVrRecords: (where: Prisma.VrRecordWhereInput) => Promise<number>;
  countQrRegistrations: (where: Prisma.QrRegistrationWhereInput) => Promise<number>;
  countStudentMatches: (where: Prisma.StudentMatchWhereInput) => Promise<number>;
};

async function getDefaultDependencies(): Promise<ReportSummaryDependencies> {
  const [{ requireAdmin }, { prisma }] = await Promise.all([
    import("@/features/auth/server/auth"),
    import("@/lib/prisma"),
  ]);

  return {
    requireAdmin,
    countSchools: (where) => prisma.school.count({ where }),
    countQrCodes: (where) => prisma.qrCode.count({ where }),
    countVrRecords: (where) => prisma.vrRecord.count({ where }),
    countQrRegistrations: (where) => prisma.qrRegistration.count({ where }),
    countStudentMatches: (where) => prisma.studentMatch.count({ where }),
  };
}

export async function getReportSummary(
  dependencies?: ReportSummaryDependencies,
): Promise<ReportSummary> {
  const resolved = dependencies ?? (await getDefaultDependencies());
  await resolved.requireAdmin();

  const [
    totalSchools,
    totalQrCodes,
    assignedQrCodes,
    usedQrCodes,
    archivedQrCodes,
    totalVrRecords,
    totalQrRegistrations,
    totalMatches,
    unmatchedVrRecords,
    unmatchedQrRegistrations,
    attendedRegistrations,
    notAttendedRegistrations,
    courseEnrollments,
  ] = await Promise.all([
    resolved.countSchools({}),
    resolved.countQrCodes({}),
    resolved.countQrCodes({ status: QrCodeStatus.ASSIGNED }),
    resolved.countQrCodes({ status: QrCodeStatus.USED }),
    resolved.countQrCodes({ archivedAt: { not: null } }),
    resolved.countVrRecords(totalVrRecordsWhere),
    resolved.countQrRegistrations(totalQrRegistrationsWhere),
    resolved.countStudentMatches({}),
    resolved.countVrRecords({ studentMatch: { is: null } }),
    resolved.countQrRegistrations({ studentMatch: { is: null } }),
    resolved.countQrRegistrations(attendedRegistrationsWhere),
    resolved.countQrRegistrations({ attendedEvent: false }),
    resolved.countQrRegistrations(courseEnrollmentsWhere),
  ]);

  return {
    totalSchools,
    totalQrCodes,
    assignedQrCodes,
    usedQrCodes,
    archivedQrCodes,
    totalVrRecords,
    totalQrRegistrations,
    totalMatches,
    unmatchedVrRecords,
    unmatchedQrRegistrations,
    attendedRegistrations,
    notAttendedRegistrations,
    courseEnrollments,
  };
}

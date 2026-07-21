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
  getEventId?: () => Promise<string>;
};

async function getDefaultDependencies(): Promise<ReportSummaryDependencies> {
  const [{ requireAdmin }, { requireSelectedEvent }, { prisma }] = await Promise.all([
    import("@/features/auth/server/auth"),
    import("@/features/events/server/event-context"),
    import("@/lib/prisma"),
  ]);

  return {
    requireAdmin,
    getEventId: async () => (await requireSelectedEvent()).id,
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
  const eventId = resolved.getEventId ? await resolved.getEventId() : undefined;
  const event = eventId ? { eventId } : {};

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
    resolved.countQrCodes(event),
    resolved.countQrCodes({ ...event, status: QrCodeStatus.ASSIGNED }),
    resolved.countQrCodes({ ...event, status: QrCodeStatus.USED }),
    resolved.countQrCodes({ ...event, archivedAt: { not: null } }),
    resolved.countVrRecords({ ...totalVrRecordsWhere, ...event }),
    resolved.countQrRegistrations({ ...totalQrRegistrationsWhere, ...event }),
    resolved.countStudentMatches(eventId ? { vrRecord: { eventId } } : {}),
    resolved.countVrRecords({ ...event, studentMatch: { is: null } }),
    resolved.countQrRegistrations({ ...event, studentMatch: { is: null } }),
    resolved.countQrRegistrations({ ...attendedRegistrationsWhere, ...event }),
    resolved.countQrRegistrations({ ...event, attendedEvent: false }),
    resolved.countQrRegistrations({ ...courseEnrollmentsWhere, ...event }),
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

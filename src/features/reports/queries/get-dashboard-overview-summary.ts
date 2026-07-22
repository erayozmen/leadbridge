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
  getEventId?: () => Promise<string>;
};

async function getDefaultDependencies(): Promise<DashboardOverviewDependencies> {
  const [{ requireAdmin }, { requireSelectedEvent }, { prisma }] = await Promise.all([
    import("@/features/auth/server/auth"),
    import("@/features/events/server/event-context"),
    import("@/lib/prisma"),
  ]);

  return {
    requireAdmin,
    getEventId: async () => (await requireSelectedEvent()).id,
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
  const eventId = resolved.getEventId ? await resolved.getEventId() : undefined;
  const vrWhere = (where: Prisma.VrRecordWhereInput) => ({
    ...where,
    ...(eventId ? { eventId } : {}),
  });
  const qrWhere = (where: Prisma.QrCodeWhereInput) => ({
    ...where,
    ...(eventId ? { eventId } : {}),
  });
  const registrationWhere = (where: Prisma.QrRegistrationWhereInput) => ({
    ...where,
    ...(eventId ? { eventId } : {}),
  });

  const [
    totalVrRecords,
    distributedQrCodes,
    totalQrRegistrations,
    attendedRegistrations,
    courseEnrollments,
    assignedWithoutRegistration,
    registeredNotAttended,
    attendedNotEnrolled,
    unmatchedRegistrations,
    unmatchedVrRecords,
  ] = await Promise.all([
    resolved.countVrRecords(vrWhere(totalVrRecordsWhere)),
    resolved.countQrCodes(qrWhere(distributedQrCodesWhere)),
    resolved.countQrRegistrations(registrationWhere(totalQrRegistrationsWhere)),
    resolved.countQrRegistrations(registrationWhere(attendedRegistrationsWhere)),
    resolved.countQrRegistrations(registrationWhere(courseEnrollmentsWhere)),
    resolved.countQrCodes(qrWhere({ status: "ASSIGNED", qrRegistration: { is: null }, archivedAt: null })),
    resolved.countQrRegistrations(registrationWhere({ attendedEvent: false })),
    resolved.countQrRegistrations(registrationWhere({ attendedEvent: true, enrolledCourse: false })),
    resolved.countQrRegistrations(registrationWhere({ studentMatch: { is: null } })),
    resolved.countVrRecords(vrWhere({ studentMatch: { is: null } })),
  ]);

  return {
    totalVrRecords,
    distributedQrCodes,
    totalQrRegistrations,
    attendedRegistrations,
    courseEnrollments,
    assignedWithoutRegistration,
    registeredNotAttended,
    attendedNotEnrolled,
    unmatchedRegistrations,
    unmatchedVrRecords,
  };
}

import "server-only";

import type { Prisma } from "@prisma/client";

export const totalVrRecordsWhere = {} satisfies Prisma.VrRecordWhereInput;
export const distributedQrCodesWhere = {
  assignedAt: { not: null },
} satisfies Prisma.QrCodeWhereInput;
export const totalQrRegistrationsWhere = {} satisfies Prisma.QrRegistrationWhereInput;
export const attendedRegistrationsWhere = {
  attendedEvent: true,
} satisfies Prisma.QrRegistrationWhereInput;
export const courseEnrollmentsWhere = {
  enrolledCourse: true,
} satisfies Prisma.QrRegistrationWhereInput;

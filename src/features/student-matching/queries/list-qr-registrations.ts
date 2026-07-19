import "server-only";

import type { Prisma } from "@prisma/client";
import { resolveSchoolDisplayName } from "@/features/schools/lib/normalize-school-name";

export const REGISTRATIONS_PAGE_SIZE = 20;
export type RegistrationFilters = { firstName?: string; lastName?: string; school?: string; page?: number };
export type RegistrationListItem = {
  id: string; firstName: string; lastName: string; guardianName: string; phone: string; school: string; schoolRelation: { name: string } | null; registeredAt: Date;
  qrCode: { serialNumber: string };
  studentMatch: { id: string; matchedAt: Date; vrRecord: { id: string; firstName: string; lastName: string } } | null;
};
type Args = { where: Prisma.QrRegistrationWhereInput; select: Prisma.QrRegistrationSelect; orderBy: Prisma.QrRegistrationOrderByWithRelationInput; skip: number; take: number };
export type RegistrationListDependencies = { count: (where: Prisma.QrRegistrationWhereInput) => Promise<number>; findMany: (args: Args) => Promise<RegistrationListItem[]> };

async function defaults(): Promise<RegistrationListDependencies> {
  const { prisma } = await import("@/lib/prisma");
  return {
    count: (where) => prisma.qrRegistration.count({ where }),
    async findMany(args) {
      const records = await prisma.qrRegistration.findMany(args);
      return records as unknown as RegistrationListItem[];
    },
  };
}

export async function listQrRegistrations(filters: RegistrationFilters, options: { unmatchedOnly?: boolean } = {}, dependencies?: RegistrationListDependencies) {
  const firstName = filters.firstName?.trim().slice(0, 80) || undefined;
  const lastName = filters.lastName?.trim().slice(0, 80) || undefined;
  const school = filters.school?.trim().slice(0, 120) || undefined;
  const page = Number.isInteger(filters.page) && (filters.page ?? 0) > 0 ? filters.page! : 1;
  const where: Prisma.QrRegistrationWhereInput = {
    ...(options.unmatchedOnly ? { studentMatch: null } : {}),
    ...(firstName ? { firstName: { contains: firstName, mode: "insensitive" } } : {}),
    ...(lastName ? { lastName: { contains: lastName, mode: "insensitive" } } : {}),
    ...(school ? { school: { contains: school, mode: "insensitive" } } : {}),
  };
  const deps = dependencies ?? (await defaults());
  const [total, records] = await Promise.all([
    deps.count(where),
    deps.findMany({ where, select: {
      id: true, firstName: true, lastName: true, guardianName: true, phone: true, school: true, schoolRelation: { select: { name: true } }, registeredAt: true,
      qrCode: { select: { serialNumber: true } },
      studentMatch: { select: { id: true, matchedAt: true, vrRecord: { select: { id: true, firstName: true, lastName: true } } } },
    }, orderBy: { registeredAt: "desc" }, skip: (page - 1) * REGISTRATIONS_PAGE_SIZE, take: REGISTRATIONS_PAGE_SIZE }),
  ]);
  return { records: records.map((record) => ({ ...record, school: resolveSchoolDisplayName(record.schoolRelation, record.school) })), total, page, pageCount: Math.max(1, Math.ceil(total / REGISTRATIONS_PAGE_SIZE)), hasFilters: Boolean(firstName || lastName || school) };
}

export async function getVrMatchTarget(id: string) {
  const { prisma } = await import("@/lib/prisma");
  const record = await prisma.vrRecord.findUnique({ where: { id }, select: {
    id: true, firstName: true, lastName: true, school: true, phone: true,
    studentMatch: { select: { id: true, matchedAt: true, qrRegistration: { select: { firstName: true, lastName: true, school: true, schoolRelation: { select: { name: true } }, phone: true, guardianName: true, registeredAt: true, qrCode: { select: { serialNumber: true } } } } } },
  } });
  if (record?.studentMatch) record.studentMatch.qrRegistration.school = resolveSchoolDisplayName(record.studentMatch.qrRegistration.schoolRelation, record.studentMatch.qrRegistration.school);
  return record;
}

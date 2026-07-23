import "server-only";

import type { Prisma } from "@prisma/client";
import { resolveSchoolDisplayName } from "@/features/schools/lib/normalize-school-name";
import { parsePageSize, parsePositivePage, parseSort } from "@/lib/query-pagination";

export const REGISTRATIONS_PAGE_SIZE = 25;
export type RegistrationFilters = { eventId?: string; firstName?: string; lastName?: string; school?: string; matchStatus?: string; attendance?: string; enrollment?: string; registeredFrom?: string; registeredTo?: string; page?: number; pageSize?: number; sort?: string };
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
  const page = parsePositivePage(filters.page), pageSize = parsePageSize(filters.pageSize), sort = parseSort(filters.sort, ["newest", "oldest", "name-asc", "name-desc"] as const, "newest");
  const matchStatus = filters.matchStatus === "matched" || filters.matchStatus === "unmatched" ? filters.matchStatus : undefined;
  const attendance = filters.attendance === "attended" ? true : filters.attendance === "not-attended" ? false : undefined;
  const enrollment = filters.enrollment === "enrolled" ? true : filters.enrollment === "not-enrolled" ? false : undefined;
  const where: Prisma.QrRegistrationWhereInput = {
    ...(filters.eventId ? { eventId: filters.eventId } : {}),
    ...(options.unmatchedOnly ? { studentMatch: null } : {}),
    ...(firstName ? { firstName: { contains: firstName, mode: "insensitive" } } : {}),
    ...(lastName ? { lastName: { contains: lastName, mode: "insensitive" } } : {}),
    ...(school ? { school: { contains: school, mode: "insensitive" } } : {}),
    ...(matchStatus === "matched" ? { studentMatch: { isNot: null } } : matchStatus === "unmatched" ? { studentMatch: { is: null } } : {}),
    ...(attendance !== undefined ? { attendedEvent: attendance } : {}),
    ...(enrollment !== undefined ? { enrolledCourse: enrollment } : {}),
  };
  const deps = dependencies ?? (await defaults());
  const [total, records] = await Promise.all([
    deps.count(where),
    deps.findMany({ where, select: {
      id: true, firstName: true, lastName: true, guardianName: true, phone: true, school: true, schoolRelation: { select: { name: true } }, registeredAt: true,
      qrCode: { select: { serialNumber: true } },
      studentMatch: { select: { id: true, matchedAt: true, vrRecord: { select: { id: true, firstName: true, lastName: true } } } },
    }, orderBy: sort === "oldest" ? { registeredAt: "asc" } : sort === "name-asc" ? { firstName: "asc" } : sort === "name-desc" ? { firstName: "desc" } : { registeredAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize }),
  ]);
  return { records: records.map((record) => ({ ...record, school: resolveSchoolDisplayName(record.schoolRelation, record.school) })), total, page, pageSize, sort, pageCount: Math.max(1, Math.ceil(total / pageSize)), hasFilters: Boolean(firstName || lastName || school || matchStatus || attendance !== undefined || enrollment !== undefined || sort !== "newest") };
}

export async function getVrMatchTarget(id: string, eventId?: string) {
  const { prisma } = await import("@/lib/prisma");
  const record = await prisma.vrRecord.findFirst({ where: { id, ...(eventId ? { eventId } : {}) }, select: {
    id: true, firstName: true, lastName: true, school: true, phone: true,
    studentMatch: { select: { id: true, matchedAt: true, qrRegistration: { select: { id: true, firstName: true, lastName: true, school: true, schoolRelation: { select: { name: true } }, phone: true, guardianName: true, registeredAt: true, qrCode: { select: { serialNumber: true } } } } } },
  } });
  if (record?.studentMatch) record.studentMatch.qrRegistration.school = resolveSchoolDisplayName(record.studentMatch.qrRegistration.schoolRelation, record.studentMatch.qrRegistration.school);
  return record;
}

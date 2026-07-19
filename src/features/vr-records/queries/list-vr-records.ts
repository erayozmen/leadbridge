import "server-only";

import { QrCodeStatus, type Prisma } from "@prisma/client";

export const VR_RECORDS_PAGE_SIZE = 20;

export type VrRecordFilters = {
  firstName?: string;
  lastName?: string;
  schoolId?: string;
  createdFrom?: string;
  createdTo?: string;
  createdByUserId?: string;
  qrStatus?: string;
  matchStatus?: string;
  page?: number;
};

export type VrRecordListItem = {
  id: string;
  firstName: string;
  lastName: string;
  school: string;
  schoolRelation: { name: string } | null;
  phone: string | null;
  createdAt: Date;
  createdByUser: { fullName: string };
  assignedQrCode: { id: string; serialNumber: string; status: QrCodeStatus; assignedAt: Date | null; usedAt: Date | null; archivedAt: Date | null; qrRegistration: { id: string } | null } | null;
  studentMatch: { id: string; matchedAt: Date; qrRegistration: { firstName: string; lastName: string } } | null;
};

type FindManyArgs = { where: Prisma.VrRecordWhereInput; select: Prisma.VrRecordSelect; orderBy: Prisma.VrRecordOrderByWithRelationInput; skip: number; take: number };
export type ListVrRecordsDependencies = {
  count: (where: Prisma.VrRecordWhereInput) => Promise<number>;
  findMany: (args: FindManyArgs) => Promise<VrRecordListItem[]>;
};
export type VrRecordFilterOptionsDependencies = {
  findSchools: () => Promise<Array<{ id: string; name: string }>>;
  findCreators: () => Promise<Array<{ createdByUser: { id: string; fullName: string } }>>;
};

function normalizeFilter(value: string | undefined, max: number) {
  const normalized = value?.trim();
  return normalized ? normalized.slice(0, max) : undefined;
}

function parseDate(value: string | undefined, endOfDay = false) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const date = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

async function getDefaultDependencies(): Promise<ListVrRecordsDependencies> {
  const { prisma } = await import("@/lib/prisma");
  return { count: (where) => prisma.vrRecord.count({ where }), findMany: (args) => prisma.vrRecord.findMany(args) as Promise<VrRecordListItem[]> };
}

export async function listVrRecordFilterOptions(dependencies?: VrRecordFilterOptionsDependencies) {
  const resolved = dependencies ?? await (async () => {
    const { prisma } = await import("@/lib/prisma");
    return {
      findSchools: () => prisma.school.findMany({ where: { vrRecords: { some: {} } }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
      findCreators: () => prisma.vrRecord.findMany({ distinct: ["createdByUserId"], select: { createdByUser: { select: { id: true, fullName: true } } }, orderBy: { createdByUser: { fullName: "asc" } } }),
    };
  })();
  const [schoolRows, creatorRows] = await Promise.all([resolved.findSchools(), resolved.findCreators()]);
  return {
    schools: schoolRows,
    creators: creatorRows.map(({ createdByUser }) => createdByUser),
  };
}

export async function listVrRecords(filters: VrRecordFilters, dependencies?: ListVrRecordsDependencies) {
  const firstName = normalizeFilter(filters.firstName, 80);
  const lastName = normalizeFilter(filters.lastName, 80);
  const schoolId = normalizeFilter(filters.schoolId, 100);
  const createdByUserId = normalizeFilter(filters.createdByUserId, 100);
  const createdFrom = parseDate(filters.createdFrom);
  const createdTo = parseDate(filters.createdTo, true);
  const qrStatus = Object.values(QrCodeStatus).includes(filters.qrStatus as QrCodeStatus) ? filters.qrStatus as QrCodeStatus : filters.qrStatus === "UNASSIGNED" ? "UNASSIGNED" : undefined;
  const matchStatus = filters.matchStatus === "matched" || filters.matchStatus === "unmatched" ? filters.matchStatus : undefined;
  const page = Number.isInteger(filters.page) && (filters.page ?? 0) > 0 ? filters.page! : 1;
  const where: Prisma.VrRecordWhereInput = {
    ...(firstName ? { firstName: { contains: firstName, mode: "insensitive" } } : {}),
    ...(lastName ? { lastName: { contains: lastName, mode: "insensitive" } } : {}),
    ...(schoolId ? { schoolId } : {}),
    ...(createdByUserId ? { createdByUserId } : {}),
    ...(createdFrom || createdTo ? { createdAt: { ...(createdFrom ? { gte: createdFrom } : {}), ...(createdTo ? { lte: createdTo } : {}) } } : {}),
    ...(qrStatus === "UNASSIGNED" ? { assignedQrCodeId: null } : qrStatus ? { assignedQrCode: { is: { status: qrStatus } } } : {}),
    ...(matchStatus === "matched" ? { studentMatch: { isNot: null } } : matchStatus === "unmatched" ? { studentMatch: { is: null } } : {}),
  };
  const resolved = dependencies ?? await getDefaultDependencies();
  const [total, records] = await Promise.all([resolved.count(where), resolved.findMany({
    where,
    select: {
      id: true, firstName: true, lastName: true, school: true, phone: true, createdAt: true, schoolRelation: { select: { name: true } },
      createdByUser: { select: { fullName: true } },
      assignedQrCode: { select: { id: true, serialNumber: true, status: true, assignedAt: true, usedAt: true, archivedAt: true, qrRegistration: { select: { id: true } } } },
      studentMatch: { select: { id: true, matchedAt: true, qrRegistration: { select: { firstName: true, lastName: true } } } },
    },
    orderBy: { createdAt: "desc" }, skip: (page - 1) * VR_RECORDS_PAGE_SIZE, take: VR_RECORDS_PAGE_SIZE,
  })]);
  const displayRecords = records.map((record) => ({ ...record, school: record.schoolRelation?.name ?? record.school }));
  return { records: displayRecords, total, page, pageSize: VR_RECORDS_PAGE_SIZE, pageCount: Math.max(1, Math.ceil(total / VR_RECORDS_PAGE_SIZE)), hasFilters: Boolean(firstName || lastName || schoolId || createdByUserId || createdFrom || createdTo || qrStatus || matchStatus) };
}

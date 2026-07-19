import "server-only";
import { Prisma, SchoolStatus } from "@prisma/client";

export const SCHOOL_PAGE_SIZE = 20;
export type SchoolListItem = { id: string; name: string; status: SchoolStatus; createdAt: Date; updatedAt: Date; _count: { vrRecords: number; qrRegistrations: number } };
export type ListSchoolsDependencies = { count: (where: Prisma.SchoolWhereInput) => Promise<number>; findMany: (args: { where: Prisma.SchoolWhereInput; select: Prisma.SchoolSelect; orderBy: Prisma.SchoolOrderByWithRelationInput; skip: number; take: number }) => Promise<SchoolListItem[]> };

export async function listSchools(filters: { name?: string; status?: string; page?: number }, dependencies?: ListSchoolsDependencies) {
  const name = filters.name?.trim().slice(0, 160) || undefined;
  const status = Object.values(SchoolStatus).includes(filters.status as SchoolStatus) ? filters.status as SchoolStatus : undefined;
  const page = Number.isInteger(filters.page) && (filters.page ?? 0) > 0 ? filters.page! : 1;
  const where: Prisma.SchoolWhereInput = { ...(name ? { name: { contains: name, mode: "insensitive" } } : {}), ...(status ? { status } : {}) };
  const deps = dependencies ?? await (async () => { const { prisma } = await import("@/lib/prisma"); return { count: (query: Prisma.SchoolWhereInput) => prisma.school.count({ where: query }), async findMany(args: Parameters<typeof prisma.school.findMany>[0]) { const records = await prisma.school.findMany(args); return records as unknown as SchoolListItem[]; } }; })();
  const [total, records] = await Promise.all([deps.count(where), deps.findMany({ where, select: { id: true, name: true, status: true, createdAt: true, updatedAt: true, _count: { select: { vrRecords: true, qrRegistrations: true } } }, orderBy: { name: "asc" }, skip: (page - 1) * SCHOOL_PAGE_SIZE, take: SCHOOL_PAGE_SIZE })]);
  return { records, total, page, pageCount: Math.max(1, Math.ceil(total / SCHOOL_PAGE_SIZE)), hasFilters: Boolean(name || status) };
}

export async function listActiveSchools(dependencies?: { findMany: (args: { where: Prisma.SchoolWhereInput; select: Prisma.SchoolSelect; orderBy: Prisma.SchoolOrderByWithRelationInput }) => Promise<Array<{ id: string; name: string }>> }) {
  const resolved = dependencies ?? await (async () => { const { prisma } = await import("@/lib/prisma"); return { findMany: (args: { where: Prisma.SchoolWhereInput; select: Prisma.SchoolSelect; orderBy: Prisma.SchoolOrderByWithRelationInput }) => prisma.school.findMany(args) as Promise<Array<{ id: string; name: string }>> }; })();
  return resolved.findMany({ where: { status: SchoolStatus.ACTIVE }, select: { id: true, name: true }, orderBy: { name: "asc" } });
}

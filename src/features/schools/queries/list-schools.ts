import "server-only";
import { Prisma, SchoolStatus } from "@prisma/client";
import { parsePageSize, parsePositivePage, parseSort } from "@/lib/query-pagination";

export const SCHOOL_PAGE_SIZE = 25;
export type SchoolListItem = { id: string; name: string; status: SchoolStatus; createdAt: Date; updatedAt: Date; _count: { vrRecords: number; qrRegistrations: number } };
export type ListSchoolsDependencies = { count: (where: Prisma.SchoolWhereInput) => Promise<number>; findMany: (args: { where: Prisma.SchoolWhereInput; select: Prisma.SchoolSelect; orderBy: Prisma.SchoolOrderByWithRelationInput; skip: number; take: number }) => Promise<SchoolListItem[]> };

export async function listSchools(filters: { name?: string; status?: string; page?: number; pageSize?: number; sort?: string }, dependencies?: ListSchoolsDependencies) {
  const name = filters.name?.trim().slice(0, 160) || undefined;
  const status = Object.values(SchoolStatus).includes(filters.status as SchoolStatus) ? filters.status as SchoolStatus : undefined;
  const page = parsePositivePage(filters.page), pageSize = parsePageSize(filters.pageSize), sort = parseSort(filters.sort, ["name-asc", "name-desc", "newest", "oldest"] as const, "name-asc");
  const where: Prisma.SchoolWhereInput = { ...(name ? { name: { contains: name, mode: "insensitive" } } : {}), ...(status ? { status } : {}) };
  const deps = dependencies ?? await (async () => { const { prisma } = await import("@/lib/prisma"); return { count: (query: Prisma.SchoolWhereInput) => prisma.school.count({ where: query }), async findMany(args: Parameters<typeof prisma.school.findMany>[0]) { const records = await prisma.school.findMany(args); return records as unknown as SchoolListItem[]; } }; })();
  const orderBy: Prisma.SchoolOrderByWithRelationInput = sort === "name-desc" ? { name: "desc" } : sort === "newest" ? { createdAt: "desc" } : sort === "oldest" ? { createdAt: "asc" } : { name: "asc" };
  const [total, records] = await Promise.all([deps.count(where), deps.findMany({ where, select: { id: true, name: true, status: true, createdAt: true, updatedAt: true, _count: { select: { vrRecords: true, qrRegistrations: true } } }, orderBy, skip: (page - 1) * pageSize, take: pageSize })]);
  return { records, total, page, pageSize, sort, pageCount: Math.max(1, Math.ceil(total / pageSize)), hasFilters: Boolean(name || status || sort !== "name-asc") };
}

export async function listActiveSchools(dependencies?: { findMany: (args: { where: Prisma.SchoolWhereInput; select: Prisma.SchoolSelect; orderBy: Prisma.SchoolOrderByWithRelationInput }) => Promise<Array<{ id: string; name: string }>> }) {
  const resolved = dependencies ?? await (async () => { const { prisma } = await import("@/lib/prisma"); return { findMany: (args: { where: Prisma.SchoolWhereInput; select: Prisma.SchoolSelect; orderBy: Prisma.SchoolOrderByWithRelationInput }) => prisma.school.findMany(args) as Promise<Array<{ id: string; name: string }>> }; })();
  return resolved.findMany({ where: { status: SchoolStatus.ACTIVE }, select: { id: true, name: true }, orderBy: { name: "asc" } });
}

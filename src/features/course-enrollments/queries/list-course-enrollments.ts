import "server-only";
import type { Prisma } from "@prisma/client";
import { resolveSchoolDisplayName } from "@/features/schools/lib/normalize-school-name";
import { parsePageSize, parsePositivePage, parseSort } from "@/lib/query-pagination";

export const COURSE_ENROLLMENTS_PAGE_SIZE = 25;
export type CourseEnrollmentFilters = { firstName?: string; lastName?: string; schoolId?: string; phone?: string; attendance?: string; enrollment?: string; registeredFrom?: string; registeredTo?: string; enrolledByUserId?: string; page?: number; pageSize?: number; sort?: string };
export type CourseEnrollmentListItem = { id: string; firstName: string; lastName: string; school: string; schoolRelation: { name: string } | null; phone: string; guardianName: string; registeredAt: Date; attendedEvent: boolean; enrolledCourse: boolean; enrolledAt: Date | null; qrCode: { serialNumber: string }; studentMatch: { id: string } | null; enrolledByUser: { fullName: string } | null };
type Args = { where: Prisma.QrRegistrationWhereInput; select: Prisma.QrRegistrationSelect; orderBy: Prisma.QrRegistrationOrderByWithRelationInput; skip: number; take: number };
export type ListCourseEnrollmentDependencies = { count: (where: Prisma.QrRegistrationWhereInput) => Promise<number>; findMany: (args: Args) => Promise<CourseEnrollmentListItem[]> };

const text = (value: string | undefined, max: number) => value?.trim().slice(0, max) || undefined;
function date(value?: string, end = false) { if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined; const parsed = new Date(`${value}T${end ? "23:59:59.999" : "00:00:00.000"}Z`); return Number.isNaN(parsed.getTime()) ? undefined : parsed; }
async function defaults(): Promise<ListCourseEnrollmentDependencies> { const { prisma } = await import("@/lib/prisma"); return { count: (where) => prisma.qrRegistration.count({ where }), async findMany(args) { return await prisma.qrRegistration.findMany(args) as unknown as CourseEnrollmentListItem[]; } }; }

export async function listCourseEnrollments(filters: CourseEnrollmentFilters, dependencies?: ListCourseEnrollmentDependencies) {
  const firstName = text(filters.firstName, 80), lastName = text(filters.lastName, 80), schoolId = text(filters.schoolId, 100), phone = text(filters.phone, 30);
  const registeredFrom = date(filters.registeredFrom), registeredTo = date(filters.registeredTo, true);
  const attendance = filters.attendance === "attended" ? true : filters.attendance === "not-attended" ? false : undefined;
  const enrollment = filters.enrollment === "enrolled" ? true : filters.enrollment === "not-enrolled" ? false : undefined;
  const page = parsePositivePage(filters.page), pageSize = parsePageSize(filters.pageSize), sort = parseSort(filters.sort, ["newest", "oldest", "name-asc", "name-desc"] as const, "newest");
  const enrolledByUserId = text(filters.enrolledByUserId, 100);
  const where: Prisma.QrRegistrationWhereInput = {
    ...(firstName ? { firstName: { contains: firstName, mode: "insensitive" } } : {}), ...(lastName ? { lastName: { contains: lastName, mode: "insensitive" } } : {}),
    ...(schoolId ? { schoolId } : {}), ...(phone ? { phone: { contains: phone } } : {}), ...(attendance !== undefined ? { attendedEvent: attendance } : {}), ...(enrollment !== undefined ? { enrolledCourse: enrollment } : {}),
    ...(registeredFrom || registeredTo ? { registeredAt: { ...(registeredFrom ? { gte: registeredFrom } : {}), ...(registeredTo ? { lte: registeredTo } : {}) } } : {}),
    ...(enrolledByUserId ? { enrolledByUserId } : {}),
  };
  const orderBy: Prisma.QrRegistrationOrderByWithRelationInput = sort === "oldest" ? { registeredAt: "asc" } : sort === "name-asc" ? { firstName: "asc" } : sort === "name-desc" ? { firstName: "desc" } : { registeredAt: "desc" };
  const deps = dependencies ?? await defaults(); const [total, records] = await Promise.all([deps.count(where), deps.findMany({ where, select: { id: true, firstName: true, lastName: true, school: true, schoolRelation: { select: { name: true } }, phone: true, guardianName: true, registeredAt: true, attendedEvent: true, enrolledCourse: true, enrolledAt: true, qrCode: { select: { serialNumber: true } }, studentMatch: { select: { id: true } }, enrolledByUser: { select: { fullName: true } } }, orderBy, skip: (page - 1) * pageSize, take: pageSize })]);
  return { records: records.map((record) => ({ ...record, school: resolveSchoolDisplayName(record.schoolRelation, record.school) })), total, page, pageSize, sort, pageCount: Math.max(1, Math.ceil(total / pageSize)), hasFilters: Boolean(firstName || lastName || schoolId || phone || attendance !== undefined || enrollment !== undefined || registeredFrom || registeredTo || enrolledByUserId || sort !== "newest") };
}

export async function listCourseEnrollmentSchools() { const { prisma } = await import("@/lib/prisma"); return prisma.school.findMany({ where: { qrRegistrations: { some: {} } }, select: { id: true, name: true }, orderBy: { name: "asc" } }); }

import { AcademyMatchStatus, type Prisma } from "@prisma/client";
export type CommissionFilter = "matched" | "unmatched";
export function parseCommissionFilter(value?: string): CommissionFilter { return value === "unmatched" ? "unmatched" : "matched"; }
export function commissionStatusWhere(filter: CommissionFilter): Prisma.AcademyStudentLinkWhereInput { return filter === "matched" ? { status: AcademyMatchStatus.MATCHED } : { status: { in: [AcademyMatchStatus.NOT_FOUND, AcademyMatchStatus.AMBIGUOUS] } }; }
export function commissionFilterHref(filter: CommissionFilter, search = "") { const query = new URLSearchParams({ filter }); if (search) query.set("search", search); return `/dashboard/commissions?${query}`; }
export function buildCommissionWhere(search: string, filter: CommissionFilter): Prisma.AcademyStudentLinkWhereInput { const term = search.trim().slice(0, 100); return { ...commissionStatusWhere(filter), ...(term ? { OR: [{ vrRecord: { firstName: { contains: term, mode: "insensitive" } } }, { vrRecord: { lastName: { contains: term, mode: "insensitive" } } }, { qrRegistration: { qrCode: { serialNumber: { contains: term, mode: "insensitive" } } } }] } : {}) }; }

import "server-only";
import { prisma } from "@/lib/prisma";
export async function listAcademyCommissions(search = "", page = 1) {
  const take = 25, term = search.trim().slice(0, 100), currentPage = Math.max(1, page);
  const where = term ? { OR: [{ vrRecord: { firstName: { contains: term, mode: "insensitive" as const } } }, { vrRecord: { lastName: { contains: term, mode: "insensitive" as const } } }, { qrRegistration: { qrCode: { serialNumber: { contains: term, mode: "insensitive" as const } } } }] } : {};
  const [total, links] = await Promise.all([prisma.academyStudentLink.count({ where }), prisma.academyStudentLink.findMany({ where, orderBy: { lastCheckedAt: "desc" }, skip: (currentPage - 1) * take, take, select: { id: true, status: true, lastCheckedAt: true, vrRecord: { select: { id: true, firstName: true, lastName: true, academySnapshot: true, academyLedger: { orderBy: { createdAt: "desc" }, select: { id: true, academyPaymentDelta: true, commissionAmount: true, currency: true, createdAt: true } } } }, qrRegistration: { select: { qrCode: { select: { serialNumber: true } } } } } })]);
  return { total, page: currentPage, pageCount: Math.max(1, Math.ceil(total / take)), items: links.map((link) => ({ ...link, totalCommission: link.vrRecord.academyLedger.reduce((sum, row) => sum + row.commissionAmount.toNumber(), 0) })) };
}

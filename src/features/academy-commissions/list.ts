import "server-only";
import { prisma } from "@/lib/prisma";
import { buildCommissionWhere, type CommissionFilter } from "./filters";
export async function listAcademyCommissions(search = "", page = 1, filter: CommissionFilter = "matched") {
  const take = 25, currentPage = Math.max(1, page);
  const where = buildCommissionWhere(search, filter);
  const [total, links] = await Promise.all([prisma.academyStudentLink.count({ where }), prisma.academyStudentLink.findMany({ where, orderBy: { lastCheckedAt: "desc" }, skip: (currentPage - 1) * take, take, select: { id: true, status: true, lastCheckedAt: true, vrRecord: { select: { id: true, firstName: true, lastName: true, academySnapshot: true, academyLedger: { orderBy: { createdAt: "desc" }, select: { id: true, academyPaymentDelta: true, commissionAmount: true, currency: true, createdAt: true } } } }, qrRegistration: { select: { qrCode: { select: { serialNumber: true } } } } } })]);
  return { total, page: currentPage, pageCount: Math.max(1, Math.ceil(total / take)), filter, items: links.map((link) => ({ ...link, totalCommission: link.vrRecord.academyLedger.reduce((sum, row) => sum + row.commissionAmount.toNumber(), 0) })) };
}

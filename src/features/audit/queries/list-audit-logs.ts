import "server-only";

import type { Prisma } from "@prisma/client";
import { requireAdmin } from "@/features/auth/server/auth";

export const AUDIT_PAGE_SIZES = [25, 50, 100] as const;

export type AuditLogFilters = {
  action?: string;
  entityType?: string;
  entityId?: string;
  actorUserId?: string;
  reason?: string;
  createdFrom?: string;
  createdTo?: string;
  page?: number;
  pageSize?: number;
};

function date(value?: string, end = false) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const parsed = new Date(`${value}T${end ? "23:59:59.999" : "00:00:00.000"}Z`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

export async function listAuditLogs(filters: AuditLogFilters) {
  await requireAdmin();
  const { prisma } = await import("@/lib/prisma");
  const page = Number.isInteger(filters.page) && (filters.page ?? 0) > 0 ? filters.page! : 1;
  const pageSize = AUDIT_PAGE_SIZES.includes(filters.pageSize as 25 | 50 | 100) ? filters.pageSize! : 25;
  const action = filters.action?.trim().slice(0, 100) || undefined;
  const entityType = filters.entityType?.trim().slice(0, 100) || undefined;
  const entityId = filters.entityId?.trim().slice(0, 120) || undefined;
  const actorUserId = filters.actorUserId?.trim().slice(0, 120) || undefined;
  const reason = filters.reason?.trim().slice(0, 160) || undefined;
  const createdFrom = date(filters.createdFrom);
  const createdTo = date(filters.createdTo, true);
  const where: Prisma.AuditLogWhereInput = {
    ...(action ? { action } : {}),
    ...(entityType ? { entityType } : {}),
    ...(entityId ? { entityId: { contains: entityId, mode: "insensitive" } } : {}),
    ...(actorUserId ? { actorUserId } : {}),
    ...(reason ? { reason: { contains: reason, mode: "insensitive" } } : {}),
    ...(createdFrom || createdTo ? { createdAt: { ...(createdFrom ? { gte: createdFrom } : {}), ...(createdTo ? { lte: createdTo } : {}) } } : {}),
  };
  const [total, records, actors] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      select: { id: true, action: true, entityType: true, entityId: true, relatedEntityType: true, relatedEntityId: true, reason: true, beforeData: true, afterData: true, createdAt: true, actorUser: { select: { id: true, fullName: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.user.findMany({ where: { auditLogs: { some: {} } }, select: { id: true, fullName: true }, orderBy: { fullName: "asc" } }),
  ]);
  return { records, actors, total, page, pageSize, pageCount: Math.max(1, Math.ceil(total / pageSize)) };
}

import "server-only";

import { Prisma, QrCodeStatus } from "@prisma/client";

export const AVAILABLE_QR_PAGE_SIZE = 20;

export type AvailableQrCode = { id: string; serialNumber: string; status: QrCodeStatus; createdAt: Date };
type FindManyArgs = { where: Prisma.QrCodeWhereInput; select: Prisma.QrCodeSelect; orderBy: Prisma.QrCodeOrderByWithRelationInput; skip: number; take: number };
export type AvailableQrDependencies = {
  count: (where: Prisma.QrCodeWhereInput) => Promise<number>;
  findMany: (args: FindManyArgs) => Promise<AvailableQrCode[]>;
};

export async function getVrRecordForQrAssignment(id: string, eventId?: string) {
  const { prisma } = await import("@/lib/prisma");
  return prisma.vrRecord.findUnique({
    where: { id, ...(eventId ? { eventId } : {}) },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      school: true,
      assignedQrCodeId: true,
      assignedQrCode: { select: { serialNumber: true } },
    },
  });
}

async function getDefaultDependencies(): Promise<AvailableQrDependencies> {
  const { prisma } = await import("@/lib/prisma");
  return { count: (where) => prisma.qrCode.count({ where }), findMany: (args) => prisma.qrCode.findMany(args) };
}

export async function listAvailableQrCodes(
  filters: { eventId?: string; serialNumber?: string; page?: number },
  dependencies?: AvailableQrDependencies,
) {
  const serialNumber = filters.serialNumber?.trim().slice(0, 32) || undefined;
  const page = Number.isInteger(filters.page) && (filters.page ?? 0) > 0 ? filters.page! : 1;
  const where: Prisma.QrCodeWhereInput = {
    ...(filters.eventId ? { eventId: filters.eventId } : {}),
    status: QrCodeStatus.CREATED,
    archivedAt: null,
    assignedVrRecord: null,
    ...(serialNumber ? { serialNumber: { contains: serialNumber, mode: "insensitive" } } : {}),
  };
  const resolved = dependencies ?? (await getDefaultDependencies());
  const [total, records] = await Promise.all([
    resolved.count(where),
    resolved.findMany({
      where,
      select: { id: true, serialNumber: true, status: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * AVAILABLE_QR_PAGE_SIZE,
      take: AVAILABLE_QR_PAGE_SIZE,
    }),
  ]);
  return { records, total, page, pageCount: Math.max(1, Math.ceil(total / AVAILABLE_QR_PAGE_SIZE)), hasFilter: Boolean(serialNumber) };
}

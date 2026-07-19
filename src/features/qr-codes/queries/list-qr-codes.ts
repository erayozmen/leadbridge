import "server-only";

import { Prisma, QrCodeStatus } from "@prisma/client";

export const QR_CODES_PAGE_SIZE = 20;

export type QrCodeFilters = {
  serialNumber?: string;
  status?: string;
  createdFrom?: string;
  createdTo?: string;
  archive?: string;
  page?: number;
};

export type QrCodeListItem = {
  id: string;
  serialNumber: string;
  status: QrCodeStatus;
  createdAt: Date;
  assignedAt: Date | null;
  usedAt: Date | null;
  archivedAt: Date | null;
  assignedVrRecord: { firstName: string; lastName: string } | null;
  qrRegistration: { firstName: string; lastName: string } | null;
};

type FindManyArgs = {
  where: Prisma.QrCodeWhereInput;
  select: Prisma.QrCodeSelect;
  orderBy: Prisma.QrCodeOrderByWithRelationInput;
  skip: number;
  take: number;
};

export type ListQrCodesDependencies = {
  count: (where: Prisma.QrCodeWhereInput) => Promise<number>;
  findMany: (args: FindManyArgs) => Promise<QrCodeListItem[]>;
};

function validDate(value?: string, endOfDay = false) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const date = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

async function getDefaultDependencies(): Promise<ListQrCodesDependencies> {
  const { prisma } = await import("@/lib/prisma");
  return {
    count: (where) => prisma.qrCode.count({ where }),
    findMany: (args) => prisma.qrCode.findMany(args),
  };
}

export async function listQrCodes(filters: QrCodeFilters, dependencies?: ListQrCodesDependencies) {
  const serialNumber = filters.serialNumber?.trim().slice(0, 32) || undefined;
  const status = Object.values(QrCodeStatus).includes(filters.status as QrCodeStatus)
    ? (filters.status as QrCodeStatus)
    : undefined;
  const createdFrom = validDate(filters.createdFrom);
  const createdTo = validDate(filters.createdTo, true);
  const page = Number.isInteger(filters.page) && (filters.page ?? 0) > 0 ? filters.page! : 1;
  const archive = filters.archive === "archived" || filters.archive === "all" ? filters.archive : "active";
  const where: Prisma.QrCodeWhereInput = {
    ...(archive === "active" ? { archivedAt: null } : archive === "archived" ? { archivedAt: { not: null } } : {}),
    ...(serialNumber ? { serialNumber: { contains: serialNumber, mode: "insensitive" } } : {}),
    ...(status ? { status } : {}),
    ...(createdFrom || createdTo
      ? { createdAt: { ...(createdFrom ? { gte: createdFrom } : {}), ...(createdTo ? { lte: createdTo } : {}) } }
      : {}),
  };
  const resolved = dependencies ?? (await getDefaultDependencies());
  const [total, records] = await Promise.all([
    resolved.count(where),
    resolved.findMany({
      where,
      select: {
        id: true,
        serialNumber: true,
        status: true,
        createdAt: true,
        assignedAt: true,
        usedAt: true,
        archivedAt: true,
        assignedVrRecord: { select: { firstName: true, lastName: true } },
        qrRegistration: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * QR_CODES_PAGE_SIZE,
      take: QR_CODES_PAGE_SIZE,
    }),
  ]);

  return {
    records,
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / QR_CODES_PAGE_SIZE)),
    hasFilters: Boolean(serialNumber || status || createdFrom || createdTo || archive !== "active"),
  };
}

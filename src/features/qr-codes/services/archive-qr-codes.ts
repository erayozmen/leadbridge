import "server-only";

import { QrCodeStatus } from "@prisma/client";
import { z } from "zod";

import { AuthError } from "@/features/auth/types/auth";
import type { ArchiveQrCodeResult } from "@/features/qr-codes/types/qr-code-result";

type QrArchiveState = {
  id: string;
  status: QrCodeStatus;
  archivedAt: Date | null;
  hasVrRecord: boolean;
  hasRegistration: boolean;
};
export type ArchiveQrCodesDependencies = {
  requireAdmin: () => Promise<unknown>;
  findQrCode: (id: string) => Promise<QrArchiveState | null>;
  archiveOne: (id: string, archivedAt: Date) => Promise<number>;
  archiveAll: (archivedAt: Date) => Promise<number>;
};

const failure = (code: Exclude<ArchiveQrCodeResult, { ok: true }>["code"], message: string) => ({ ok: false as const, code, message });
const archiveWhere = {
  status: QrCodeStatus.DISABLED,
  archivedAt: null,
  assignedVrRecord: null,
  qrRegistration: null,
} as const;

async function defaults(): Promise<ArchiveQrCodesDependencies> {
  const [{ requireAdmin }, { prisma }] = await Promise.all([
    import("@/features/auth/server/auth"),
    import("@/lib/prisma"),
  ]);
  return {
    requireAdmin,
    async findQrCode(id) {
      const qr = await prisma.qrCode.findUnique({
        where: { id },
        select: {
          id: true,
          status: true,
          archivedAt: true,
          assignedVrRecord: { select: { id: true } },
          qrRegistration: { select: { id: true } },
        },
      });
      return qr ? { id: qr.id, status: qr.status, archivedAt: qr.archivedAt, hasVrRecord: Boolean(qr.assignedVrRecord), hasRegistration: Boolean(qr.qrRegistration) } : null;
    },
    async archiveOne(id, archivedAt) {
      return (await prisma.qrCode.updateMany({ where: { id, ...archiveWhere }, data: { archivedAt } })).count;
    },
    async archiveAll(archivedAt) {
      return (await prisma.qrCode.updateMany({ where: archiveWhere, data: { archivedAt } })).count;
    },
  };
}

async function authorize(deps: ArchiveQrCodesDependencies): Promise<ArchiveQrCodeResult | null> {
  try { await deps.requireAdmin(); return null; } catch (error) {
    if (error instanceof AuthError) return failure("UNAUTHORIZED", "Bu işlem yalnızca yöneticiler tarafından yapılabilir.");
    return failure("UNAUTHORIZED", "Yetkilendirme doğrulanamadı.");
  }
}

export async function archiveQrCode(id: string, dependencies?: ArchiveQrCodesDependencies): Promise<ArchiveQrCodeResult> {
  if (!z.string().trim().min(1).max(100).safeParse(id).success) return failure("INVALID_INPUT", "Geçerli bir QR kartı seçin.");
  const deps = dependencies ?? (await defaults());
  const authFailure = await authorize(deps); if (authFailure) return authFailure;
  try {
    const qr = await deps.findQrCode(id);
    if (!qr) return failure("QR_NOT_FOUND", "QR kartı bulunamadı.");
    if (qr.status !== QrCodeStatus.DISABLED || qr.archivedAt || qr.hasVrRecord || qr.hasRegistration) return failure("QR_NOT_ARCHIVABLE", "QR kartı güvenli arşivleme koşullarını karşılamıyor.");
    const count = await deps.archiveOne(qr.id, new Date());
    return count === 1 ? { ok: true, archivedCount: 1, message: "QR kartı ana listeden kaldırıldı. Seri geçmişi korundu." } : failure("ARCHIVE_CONFLICT", "QR kartı başka bir işlem tarafından değiştirildi.");
  } catch { return failure("ARCHIVE_FAILED", "QR kartı arşivlenemedi. Lütfen tekrar deneyin."); }
}

export async function archiveAllDisabledQrCodes(dependencies?: ArchiveQrCodesDependencies): Promise<ArchiveQrCodeResult> {
  const deps = dependencies ?? (await defaults());
  const authFailure = await authorize(deps); if (authFailure) return authFailure;
  try {
    const count = await deps.archiveAll(new Date());
    return { ok: true, archivedCount: count, message: count > 0 ? `${count} QR kartı ana listeden kaldırıldı. Uygun olmayan kayıtlar değiştirilmedi.` : "Arşivlenmeye uygun devre dışı QR kartı bulunamadı." };
  } catch { return failure("ARCHIVE_FAILED", "QR kartları arşivlenemedi. Lütfen tekrar deneyin."); }
}

import "server-only";

import { QrCodeStatus } from "@prisma/client";

import { AuthError } from "@/features/auth/types/auth";
import type { DisableQrCodeResult } from "@/features/qr-codes/types/qr-code-result";

export type DisableQrCodeDependencies = {
  requireAdmin: () => Promise<unknown>;
  disableCreated: (id: string) => Promise<number>;
};

async function getDefaultDependencies(): Promise<DisableQrCodeDependencies> {
  const [{ requireAdmin }, { prisma }] = await Promise.all([
    import("@/features/auth/server/auth"),
    import("@/lib/prisma"),
  ]);
  return {
    requireAdmin,
    async disableCreated(id) {
      const result = await prisma.qrCode.updateMany({
        where: { id, status: QrCodeStatus.CREATED, archivedAt: null },
        data: { status: QrCodeStatus.DISABLED },
      });
      return result.count;
    },
  };
}

export async function disableQrCode(id: string, dependencies?: DisableQrCodeDependencies): Promise<DisableQrCodeResult> {
  if (!id.trim()) return { ok: false, code: "NOT_ALLOWED", message: "QR kartı devre dışı bırakılamadı." };
  const resolved = dependencies ?? (await getDefaultDependencies());
  try {
    await resolved.requireAdmin();
    const count = await resolved.disableCreated(id);
    return count === 1
      ? { ok: true, message: "QR kartı devre dışı bırakıldı." }
      : { ok: false, code: "NOT_ALLOWED", message: "Yalnızca oluşturulmuş QR kartları devre dışı bırakılabilir." };
  } catch (error) {
    if (error instanceof AuthError) return { ok: false, code: "UNAUTHORIZED", message: "Bu işlem için yetkiniz bulunmuyor." };
    return { ok: false, code: "UPDATE_FAILED", message: "QR kartı güncellenemedi. Lütfen tekrar deneyin." };
  }
}

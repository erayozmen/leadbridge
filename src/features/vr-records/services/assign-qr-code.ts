import "server-only";

import { Prisma, QrCodeStatus } from "@prisma/client";
import { z } from "zod";

import { AuthError } from "@/features/auth/types/auth";
import type { QrAssignmentResult } from "@/features/vr-records/types/qr-assignment-result";

const assignmentSchema = z.object({
  vrRecordId: z.string().trim().min(1).max(100),
  qrCodeId: z.string().trim().min(1).max(100),
});

type AssignmentTransaction = {
  findVrRecord: (id: string) => Promise<{ id: string; assignedQrCodeId: string | null } | null>;
  findQrCode: (id: string) => Promise<{
    id: string;
    serialNumber: string;
    status: QrCodeStatus;
    archivedAt: Date | null;
    assigned: boolean;
  } | null>;
  claimQrCode: (id: string, assignedAt: Date) => Promise<number>;
  attachQrToVrRecord: (vrRecordId: string, qrCodeId: string) => Promise<number>;
};

export type AssignQrCodeDependencies = {
  requireAdmin: () => Promise<unknown>;
  runTransaction: <T>(callback: (transaction: AssignmentTransaction) => Promise<T>) => Promise<T>;
};

class AssignmentDomainError extends Error {
  constructor(readonly result: Exclude<QrAssignmentResult, { ok: true }>) {
    super(result.code);
  }
}

function failure(code: Exclude<QrAssignmentResult, { ok: true }>["code"], message: string) {
  return { ok: false as const, code, message };
}

async function getDefaultDependencies(): Promise<AssignQrCodeDependencies> {
  const [{ requireAdmin }, { prisma }] = await Promise.all([
    import("@/features/auth/server/auth"),
    import("@/lib/prisma"),
  ]);

  return {
    requireAdmin,
    runTransaction(callback) {
      return prisma.$transaction(async (tx) =>
        callback({
          findVrRecord: (id) => tx.vrRecord.findUnique({
            where: { id },
            select: { id: true, assignedQrCodeId: true },
          }),
          async findQrCode(id) {
            const qrCode = await tx.qrCode.findUnique({
              where: { id },
              select: {
                id: true,
                serialNumber: true,
                status: true,
                archivedAt: true,
                assignedVrRecord: { select: { id: true } },
              },
            });
            return qrCode
              ? {
                  id: qrCode.id,
                  serialNumber: qrCode.serialNumber,
                  status: qrCode.status,
                  archivedAt: qrCode.archivedAt,
                  assigned: Boolean(qrCode.assignedVrRecord),
                }
              : null;
          },
          async claimQrCode(id, assignedAt) {
            const result = await tx.qrCode.updateMany({
              where: {
                id,
                status: QrCodeStatus.CREATED,
                archivedAt: null,
                assignedVrRecord: null,
              },
              data: { status: QrCodeStatus.ASSIGNED, assignedAt },
            });
            return result.count;
          },
          async attachQrToVrRecord(vrRecordId, qrCodeId) {
            const result = await tx.vrRecord.updateMany({
              where: { id: vrRecordId, assignedQrCodeId: null },
              data: { assignedQrCodeId: qrCodeId },
            });
            return result.count;
          },
        }),
      );
    },
  };
}

export async function assignQrCode(
  input: { vrRecordId: string; qrCodeId: string },
  dependencies?: AssignQrCodeDependencies,
): Promise<QrAssignmentResult> {
  const parsed = assignmentSchema.safeParse(input);
  if (!parsed.success) return failure("INVALID_INPUT", "Geçerli bir VR kaydı ve QR kartı seçin.");

  const resolved = dependencies ?? (await getDefaultDependencies());
  try {
    await resolved.requireAdmin();
  } catch (error) {
    if (error instanceof AuthError) return failure("UNAUTHORIZED", "Bu işlem yalnızca yöneticiler tarafından yapılabilir.");
    return failure("UNAUTHORIZED", "Yetkilendirme doğrulanamadı.");
  }

  try {
    return await resolved.runTransaction(async (transaction) => {
      const vrRecord = await transaction.findVrRecord(parsed.data.vrRecordId);
      if (!vrRecord) throw new AssignmentDomainError(failure("VR_RECORD_NOT_FOUND", "VR kaydı bulunamadı."));
      if (vrRecord.assignedQrCodeId) throw new AssignmentDomainError(failure("VR_ALREADY_HAS_QR", "Bu VR kaydına zaten bir QR kartı atanmış."));

      const qrCode = await transaction.findQrCode(parsed.data.qrCodeId);
      if (!qrCode) throw new AssignmentDomainError(failure("QR_NOT_FOUND", "QR kartı bulunamadı."));
      if (
        qrCode.status !== QrCodeStatus.CREATED
        || qrCode.archivedAt
        || qrCode.assigned
      ) {
        throw new AssignmentDomainError(failure("QR_NOT_AVAILABLE", "QR kartı artık atama için uygun değil."));
      }

      const assignedAt = new Date();
      if ((await transaction.claimQrCode(qrCode.id, assignedAt)) !== 1) {
        throw new AssignmentDomainError(failure("ASSIGNMENT_CONFLICT", "QR kartı başka bir işlem tarafından değiştirilmiş."));
      }
      if ((await transaction.attachQrToVrRecord(vrRecord.id, qrCode.id)) !== 1) {
        throw new AssignmentDomainError(failure("ASSIGNMENT_CONFLICT", "VR kaydı başka bir işlem tarafından değiştirilmiş."));
      }

      return { ok: true as const, serialNumber: qrCode.serialNumber, assignedAt };
    });
  } catch (error) {
    if (error instanceof AssignmentDomainError) return error.result;
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return failure("ASSIGNMENT_CONFLICT", "QR ataması başka bir işlemle çakıştı.");
    }
    return failure("ASSIGN_FAILED", "QR kartı atanamadı. Lütfen tekrar deneyin.");
  }
}

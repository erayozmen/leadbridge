import "server-only";

import { QrCodeStatus } from "@prisma/client";
import { z } from "zod";
import { AUDIT_ACTIONS } from "@/features/audit/constants/audit-actions";
import { AUDIT_ENTITY_TYPES } from "@/features/audit/constants/audit-entity-types";
import { validateAuditReason } from "@/features/audit/lib/validate-audit-input";
import type { WriteAuditLogInput } from "@/features/audit/types/audit-log";
import { AuthError, type AppUser } from "@/features/auth/types/auth";
import type { QrUnassignmentResult } from "@/features/vr-records/types/qr-unassignment-result";

const inputSchema = z.object({
  vrRecordId: z.string().trim().min(1).max(100),
  qrCodeId: z.string().trim().min(1).max(100),
  reason: z.unknown(),
}).strict();

type AssignmentState = {
  vrRecordId: string;
  assignedQrCodeId: string;
  hasStudentMatch: boolean;
  qrCode: {
    id: string;
    serialNumber: string;
    status: QrCodeStatus;
    assignedAt: Date | null;
    usedAt: Date | null;
    archivedAt: Date | null;
    hasRegistration: boolean;
  };
};

type UnassignmentTransaction = {
  findAssignment: (
    vrRecordId: string,
    qrCodeId: string,
  ) => Promise<AssignmentState | null>;
  detachQrFromVrRecord: (vrRecordId: string, qrCodeId: string) => Promise<number>;
  releaseQrCode: (qrCodeId: string, vrRecordId: string) => Promise<number>;
  writeAudit: (input: WriteAuditLogInput) => Promise<unknown>;
};

export type UnassignQrCodeDependencies = {
  requireAdmin: () => Promise<AppUser>;
  runTransaction: <T>(
    callback: (transaction: UnassignmentTransaction) => Promise<T>,
  ) => Promise<T>;
};

class UnassignmentDomainError extends Error {
  constructor(readonly result: Exclude<QrUnassignmentResult, { ok: true }>) {
    super(result.code);
  }
}

function failure(
  code: Exclude<QrUnassignmentResult, { ok: true }>["code"],
  message: string,
) {
  return { ok: false as const, code, message };
}

async function defaults(): Promise<UnassignQrCodeDependencies> {
  const [{ requireAdmin }, { prisma }, { writeAuditLog }] = await Promise.all([
    import("@/features/auth/server/auth"),
    import("@/lib/prisma"),
    import("@/features/audit/services/write-audit-log"),
  ]);

  return {
    requireAdmin,
    runTransaction(callback) {
      return prisma.$transaction(async (tx) => callback({
        async findAssignment(vrRecordId, qrCodeId) {
          const record = await tx.vrRecord.findFirst({
            where: { id: vrRecordId, assignedQrCodeId: qrCodeId },
            select: {
              id: true,
              assignedQrCodeId: true,
              studentMatch: { select: { id: true } },
              assignedQrCode: {
                select: {
                  id: true,
                  serialNumber: true,
                  status: true,
                  assignedAt: true,
                  usedAt: true,
                  archivedAt: true,
                  qrRegistration: { select: { id: true } },
                },
              },
            },
          });
          if (!record?.assignedQrCodeId || !record.assignedQrCode) return null;
          return {
            vrRecordId: record.id,
            assignedQrCodeId: record.assignedQrCodeId,
            hasStudentMatch: Boolean(record.studentMatch),
            qrCode: {
              id: record.assignedQrCode.id,
              serialNumber: record.assignedQrCode.serialNumber,
              status: record.assignedQrCode.status,
              assignedAt: record.assignedQrCode.assignedAt,
              usedAt: record.assignedQrCode.usedAt,
              archivedAt: record.assignedQrCode.archivedAt,
              hasRegistration: Boolean(record.assignedQrCode.qrRegistration),
            },
          };
        },
        async detachQrFromVrRecord(vrRecordId, qrCodeId) {
          return (await tx.vrRecord.updateMany({
            where: { id: vrRecordId, assignedQrCodeId: qrCodeId, studentMatch: null },
            data: { assignedQrCodeId: null },
          })).count;
        },
        async releaseQrCode(qrCodeId, vrRecordId) {
          return (await tx.qrCode.updateMany({
            where: {
              id: qrCodeId,
              status: QrCodeStatus.ASSIGNED,
              usedAt: null,
              archivedAt: null,
              qrRegistration: null,
              assignedVrRecord: { is: { id: vrRecordId } },
            },
            data: { status: QrCodeStatus.CREATED, assignedAt: null },
          })).count;
        },
        writeAudit: (input) => writeAuditLog(tx, input),
      }));
    },
  };
}

export async function unassignQrCode(
  input: unknown,
  dependencies?: UnassignQrCodeDependencies,
): Promise<QrUnassignmentResult> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) {
    return failure("INVALID_INPUT", "Geçerli bir VR kaydı, QR kartı ve işlem nedeni girin.");
  }

  let reason: string;
  try {
    reason = validateAuditReason(
      AUDIT_ACTIONS.QR_ASSIGNMENT_REVERSED,
      parsed.data.reason,
    ) as string;
  } catch {
    return failure(
      "INVALID_INPUT",
      "İşlem nedeni 10 ile 500 karakter arasında olmalıdır.",
    );
  }

  const deps = dependencies ?? (await defaults());
  let admin: AppUser;
  try {
    admin = await deps.requireAdmin();
  } catch (error) {
    if (error instanceof AuthError) {
      return failure(
        "UNAUTHORIZED",
        "Bu işlem yalnızca yöneticiler tarafından yapılabilir.",
      );
    }
    return failure("UNAUTHORIZED", "Yetkilendirme doğrulanamadı.");
  }

  try {
    return await deps.runTransaction(async (transaction) => {
      const assignment = await transaction.findAssignment(
        parsed.data.vrRecordId,
        parsed.data.qrCodeId,
      );
      if (!assignment) {
        throw new UnassignmentDomainError(
          failure(
            "ASSIGNMENT_NOT_FOUND",
            "QR ataması artık mevcut değil veya başka bir VR kaydına ait.",
          ),
        );
      }
      if (
        assignment.qrCode.status === QrCodeStatus.USED
        || assignment.qrCode.usedAt
      ) {
        throw new UnassignmentDomainError(
          failure(
            "QR_ALREADY_USED",
            "Kullanılmış bir QR kartının ataması geri alınamaz.",
          ),
        );
      }
      if (assignment.qrCode.hasRegistration) {
        throw new UnassignmentDomainError(
          failure(
            "QR_HAS_REGISTRATION",
            "QR kartı için kayıt bulunduğundan atama geri alınamaz.",
          ),
        );
      }
      if (assignment.hasStudentMatch) {
        throw new UnassignmentDomainError(
          failure(
            "QR_HAS_STUDENT_MATCH",
            "İlişkili öğrenci eşleşmesi bulunduğundan atama geri alınamaz.",
          ),
        );
      }
      if (assignment.qrCode.archivedAt) {
        throw new UnassignmentDomainError(
          failure(
            "QR_ARCHIVED",
            "Arşivlenmiş QR kartının ataması geri alınamaz.",
          ),
        );
      }
      if (assignment.qrCode.status === QrCodeStatus.DISABLED) {
        throw new UnassignmentDomainError(
          failure(
            "QR_DISABLED",
            "Devre dışı QR kartının ataması geri alınamaz.",
          ),
        );
      }
      if (assignment.qrCode.status !== QrCodeStatus.ASSIGNED) {
        throw new UnassignmentDomainError(
          failure(
            "QR_NOT_UNASSIGNABLE",
            "QR kartı geri alınabilir atanmış durumda değil.",
          ),
        );
      }

      if (
        (await transaction.releaseQrCode(
          assignment.qrCode.id,
          assignment.vrRecordId,
        )) !== 1
      ) {
        throw new UnassignmentDomainError(
          failure(
            "UNASSIGNMENT_CONFLICT",
            "QR kartı başka bir işlem tarafından değiştirilmiş.",
          ),
        );
      }
      if (
        (await transaction.detachQrFromVrRecord(
          assignment.vrRecordId,
          assignment.qrCode.id,
        )) !== 1
      ) {
        throw new UnassignmentDomainError(
          failure(
            "UNASSIGNMENT_CONFLICT",
            "VR kaydı başka bir işlem tarafından değiştirilmiş.",
          ),
        );
      }

      await transaction.writeAudit({
        actor: { type: "USER", userId: admin.id },
        action: AUDIT_ACTIONS.QR_ASSIGNMENT_REVERSED,
        entityType: AUDIT_ENTITY_TYPES.QR_CODE,
        entityId: assignment.qrCode.id,
        relatedEntity: {
          type: AUDIT_ENTITY_TYPES.VR_RECORD,
          id: assignment.vrRecordId,
        },
        reason,
        beforeData: {
          status: QrCodeStatus.ASSIGNED,
          assignedAt: assignment.qrCode.assignedAt?.toISOString() ?? null,
          assignedQrCodeId: assignment.qrCode.id,
        },
        afterData: {
          status: QrCodeStatus.CREATED,
          assignedAt: null,
          assignedQrCodeId: null,
        },
      });

      return {
        ok: true as const,
        serialNumber: assignment.qrCode.serialNumber,
      };
    });
  } catch (error) {
    if (error instanceof UnassignmentDomainError) return error.result;
    return failure(
      "UNASSIGNMENT_FAILED",
      "QR ataması geri alınamadı. Lütfen tekrar deneyin.",
    );
  }
}

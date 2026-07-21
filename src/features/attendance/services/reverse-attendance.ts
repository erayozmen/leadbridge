import "server-only";

import { z } from "zod";
import { AUDIT_ACTIONS } from "@/features/audit/constants/audit-actions";
import { AUDIT_ENTITY_TYPES } from "@/features/audit/constants/audit-entity-types";
import { validateAuditReason } from "@/features/audit/lib/validate-audit-input";
import type { WriteAuditLogInput } from "@/features/audit/types/audit-log";
import type { ReverseAttendanceResult } from "@/features/attendance/types/attendance-result";
import { AuthError, type AppUser } from "@/features/auth/types/auth";

type AttendanceState = {
  id: string;
  attendedEvent: boolean;
  attendedAt: Date | null;
  attendedByUserId: string | null;
};

type ReverseAttendanceTransaction = {
  findRegistration: (id: string) => Promise<AttendanceState | null>;
  clearAttendance: (state: AttendanceState) => Promise<number>;
  writeAudit: (input: WriteAuditLogInput) => Promise<unknown>;
};

export type ReverseAttendanceDependencies = {
  requireAdmin: () => Promise<AppUser>;
  runTransaction: <T>(
    callback: (transaction: ReverseAttendanceTransaction) => Promise<T>,
  ) => Promise<T>;
};

const inputSchema = z.object({
  qrRegistrationId: z.string().trim().min(1).max(100),
  reason: z.unknown(),
}).strict();

class ReverseAttendanceDomainError extends Error {
  constructor(readonly result: Exclude<ReverseAttendanceResult, { ok: true }>) {
    super(result.code);
  }
}

const failure = (
  code: Exclude<ReverseAttendanceResult, { ok: true }>["code"],
  message: string,
) => ({ ok: false as const, code, message });

async function defaults(): Promise<ReverseAttendanceDependencies> {
  const [{ requireAdmin }, { prisma }, { writeAuditLog }] = await Promise.all([
    import("@/features/auth/server/auth"),
    import("@/lib/prisma"),
    import("@/features/audit/services/write-audit-log"),
  ]);

  return {
    requireAdmin,
    runTransaction(callback) {
      return prisma.$transaction(async (tx) => callback({
        findRegistration: (id) => tx.qrRegistration.findUnique({
          where: { id },
          select: {
            id: true,
            attendedEvent: true,
            attendedAt: true,
            attendedByUserId: true,
          },
        }),
        async clearAttendance(state) {
          return (await tx.qrRegistration.updateMany({
            where: {
              id: state.id,
              attendedEvent: true,
              attendedAt: state.attendedAt,
            },
            data: {
              attendedEvent: false,
              attendedAt: null,
              attendedByUserId: null,
            },
          })).count;
        },
        writeAudit: (input) => writeAuditLog(tx, input),
      }));
    },
  };
}

export async function reverseAttendance(
  input: unknown,
  dependencies?: ReverseAttendanceDependencies,
): Promise<ReverseAttendanceResult> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) {
    return failure("INVALID_INPUT", "Geçerli bir kayıt ve işlem nedeni girin.");
  }

  let reason: string;
  try {
    reason = validateAuditReason(
      AUDIT_ACTIONS.ATTENDANCE_REVERSED,
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
      const registration = await transaction.findRegistration(
        parsed.data.qrRegistrationId,
      );
      if (!registration) {
        throw new ReverseAttendanceDomainError(
          failure("REGISTRATION_NOT_FOUND", "Öğrenci kaydı bulunamadı."),
        );
      }
      if (!registration.attendedEvent) {
        throw new ReverseAttendanceDomainError(
          failure("NOT_ATTENDED", "Katılım daha önce geri alınmış."),
        );
      }
      if (!registration.attendedAt) {
        throw new ReverseAttendanceDomainError(
          failure(
            "ATTENDANCE_STATE_INVALID",
            "Katılım kaydı güvenli biçimde geri alınabilecek durumda değil.",
          ),
        );
      }

      if ((await transaction.clearAttendance(registration)) !== 1) {
        throw new ReverseAttendanceDomainError(
          failure(
            "ATTENDANCE_REVERSAL_CONFLICT",
            "Katılım başka bir işlem tarafından değiştirilmiş.",
          ),
        );
      }

      await transaction.writeAudit({
        actor: { type: "USER", userId: admin.id },
        action: AUDIT_ACTIONS.ATTENDANCE_REVERSED,
        entityType: AUDIT_ENTITY_TYPES.QR_REGISTRATION,
        entityId: registration.id,
        reason,
        beforeData: {
          attendedEvent: true,
          attendedAt: registration.attendedAt.toISOString(),
          attendedByUserId: registration.attendedByUserId,
        },
        afterData: {
          attendedEvent: false,
          attendedAt: null,
          attendedByUserId: null,
        },
      });

      return { ok: true as const };
    });
  } catch (error) {
    if (error instanceof ReverseAttendanceDomainError) return error.result;
    return failure(
      "ATTENDANCE_REVERSAL_FAILED",
      "Katılım geri alınamadı. Lütfen tekrar deneyin.",
    );
  }
}

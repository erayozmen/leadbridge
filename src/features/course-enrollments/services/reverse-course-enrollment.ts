import "server-only";

import { z } from "zod";
import { AUDIT_ACTIONS } from "@/features/audit/constants/audit-actions";
import { AUDIT_ENTITY_TYPES } from "@/features/audit/constants/audit-entity-types";
import { validateAuditReason } from "@/features/audit/lib/validate-audit-input";
import type { WriteAuditLogInput } from "@/features/audit/types/audit-log";
import { AuthError, type AppUser } from "@/features/auth/types/auth";
import type { ReverseCourseEnrollmentResult } from "@/features/course-enrollments/types/course-enrollment-result";

type EnrollmentState = {
  id: string;
  enrolledCourse: boolean;
  enrolledAt: Date | null;
  enrolledByUserId: string | null;
};

type ReverseEnrollmentTransaction = {
  findRegistration: (id: string) => Promise<EnrollmentState | null>;
  clearEnrollment: (state: EnrollmentState) => Promise<number>;
  writeAudit: (input: WriteAuditLogInput) => Promise<unknown>;
};

export type ReverseCourseEnrollmentDependencies = {
  requireAdmin: () => Promise<AppUser>;
  runTransaction: <T>(
    callback: (transaction: ReverseEnrollmentTransaction) => Promise<T>,
  ) => Promise<T>;
};

const inputSchema = z.object({
  qrRegistrationId: z.string().trim().min(1).max(100),
  reason: z.unknown(),
}).strict();

class ReverseEnrollmentDomainError extends Error {
  constructor(readonly result: Exclude<ReverseCourseEnrollmentResult, { ok: true }>) {
    super(result.code);
  }
}

const failure = (
  code: Exclude<ReverseCourseEnrollmentResult, { ok: true }>["code"],
  message: string,
) => ({ ok: false as const, code, message });

async function defaults(): Promise<ReverseCourseEnrollmentDependencies> {
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
            enrolledCourse: true,
            enrolledAt: true,
            enrolledByUserId: true,
          },
        }),
        async clearEnrollment(state) {
          return (await tx.qrRegistration.updateMany({
            where: {
              id: state.id,
              enrolledCourse: true,
              enrolledAt: state.enrolledAt,
            },
            data: {
              enrolledCourse: false,
              enrolledAt: null,
              enrolledByUserId: null,
            },
          })).count;
        },
        writeAudit: (input) => writeAuditLog(tx, input),
      }));
    },
  };
}

export async function reverseCourseEnrollment(
  input: unknown,
  dependencies?: ReverseCourseEnrollmentDependencies,
): Promise<ReverseCourseEnrollmentResult> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) {
    return failure("INVALID_INPUT", "Geçerli bir kayıt ve işlem nedeni girin.");
  }

  let reason: string;
  try {
    reason = validateAuditReason(
      AUDIT_ACTIONS.COURSE_ENROLLMENT_REVERSED,
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
        throw new ReverseEnrollmentDomainError(
          failure("REGISTRATION_NOT_FOUND", "Öğrenci kaydı bulunamadı."),
        );
      }
      if (!registration.enrolledCourse) {
        throw new ReverseEnrollmentDomainError(
          failure("NOT_ENROLLED", "Kurs kaydı daha önce geri alınmış."),
        );
      }
      if (!registration.enrolledAt) {
        throw new ReverseEnrollmentDomainError(
          failure(
            "ENROLLMENT_STATE_INVALID",
            "Kurs kaydı güvenli biçimde geri alınabilecek durumda değil.",
          ),
        );
      }

      if ((await transaction.clearEnrollment(registration)) !== 1) {
        throw new ReverseEnrollmentDomainError(
          failure(
            "ENROLLMENT_REVERSAL_CONFLICT",
            "Kurs kaydı başka bir işlem tarafından değiştirilmiş.",
          ),
        );
      }

      await transaction.writeAudit({
        actor: { type: "USER", userId: admin.id },
        action: AUDIT_ACTIONS.COURSE_ENROLLMENT_REVERSED,
        entityType: AUDIT_ENTITY_TYPES.QR_REGISTRATION,
        entityId: registration.id,
        reason,
        beforeData: {
          enrolledCourse: true,
          enrolledAt: registration.enrolledAt.toISOString(),
          enrolledByUserId: registration.enrolledByUserId,
        },
        afterData: {
          enrolledCourse: false,
          enrolledAt: null,
          enrolledByUserId: null,
        },
      });

      return { ok: true as const };
    });
  } catch (error) {
    if (error instanceof ReverseEnrollmentDomainError) return error.result;
    return failure(
      "ENROLLMENT_REVERSAL_FAILED",
      "Kurs kaydı geri alınamadı. Lütfen tekrar deneyin.",
    );
  }
}

import "server-only";

import { z } from "zod";
import { AUDIT_ACTIONS } from "@/features/audit/constants/audit-actions";
import { AUDIT_ENTITY_TYPES } from "@/features/audit/constants/audit-entity-types";
import { validateAuditReason } from "@/features/audit/lib/validate-audit-input";
import type { WriteAuditLogInput } from "@/features/audit/types/audit-log";
import { AuthError, type AppUser } from "@/features/auth/types/auth";
import type { DeleteStudentMatchResult } from "@/features/student-matching/types/student-match-result";

type MatchState = {
  id: string;
  vrRecordId: string;
  qrRegistrationId: string;
  vrEventId: string;
  qrRegistrationEventId: string;
};

type DeleteMatchTransaction = {
  findMatch: (matchId: string) => Promise<MatchState | null>;
  deleteMatch: (
    matchId: string,
    vrRecordId: string,
    qrRegistrationId: string,
  ) => Promise<number>;
  writeAudit: (input: WriteAuditLogInput) => Promise<unknown>;
};

export type DeleteStudentMatchDependencies = {
  requireAdmin: () => Promise<AppUser>;
  getEventId: () => Promise<string>;
  runTransaction: <T>(
    callback: (transaction: DeleteMatchTransaction) => Promise<T>,
  ) => Promise<T>;
};

const inputSchema = z.object({
  matchId: z.string().trim().min(1).max(100),
  vrRecordId: z.string().trim().min(1).max(100),
  qrRegistrationId: z.string().trim().min(1).max(100),
  reason: z.unknown(),
}).strict();

class DeleteMatchDomainError extends Error {
  constructor(readonly result: Exclude<DeleteStudentMatchResult, { ok: true }>) {
    super(result.code);
  }
}

const failure = (
  code: Exclude<DeleteStudentMatchResult, { ok: true }>["code"],
  message: string,
) => ({ ok: false as const, code, message });

async function defaults(): Promise<DeleteStudentMatchDependencies> {
  const [{ requireAdmin }, { resolveCompatibilityEvent }, { prisma }, { writeAuditLog }] = await Promise.all([
    import("@/features/auth/server/auth"),
    import("@/features/events/server/event-context"),
    import("@/lib/prisma"),
    import("@/features/audit/services/write-audit-log"),
  ]);

  return {
    requireAdmin,
    getEventId: async () => (await resolveCompatibilityEvent()).id,
    runTransaction(callback) {
      return prisma.$transaction(async (tx) => callback({
        async findMatch(matchId) {
          const match = await tx.studentMatch.findUnique({
            where: { id: matchId },
            select: {
              id: true,
              vrRecordId: true,
              qrRegistrationId: true,
              vrRecord: { select: { eventId: true } },
              qrRegistration: { select: { eventId: true } },
            },
          });
          return match ? {
            id: match.id,
            vrRecordId: match.vrRecordId,
            qrRegistrationId: match.qrRegistrationId,
            vrEventId: match.vrRecord.eventId,
            qrRegistrationEventId: match.qrRegistration.eventId,
          } : null;
        },
        async deleteMatch(matchId, vrRecordId, qrRegistrationId) {
          return (await tx.studentMatch.deleteMany({
            where: { id: matchId, vrRecordId, qrRegistrationId },
          })).count;
        },
        writeAudit: (input) => writeAuditLog(tx, input),
      }));
    },
  };
}

export async function deleteStudentMatch(
  input: unknown,
  dependencies?: DeleteStudentMatchDependencies,
): Promise<DeleteStudentMatchResult> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) {
    return failure("INVALID_INPUT", "Geçerli bir eşleşme ve işlem nedeni girin.");
  }

  let reason: string;
  try {
    reason = validateAuditReason(
      AUDIT_ACTIONS.STUDENT_MATCH_REMOVED,
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
    const eventId = await deps.getEventId();
    return await deps.runTransaction(async (transaction) => {
      const match = await transaction.findMatch(parsed.data.matchId);
      if (!match) {
        throw new DeleteMatchDomainError(
          failure("MATCH_NOT_FOUND", "Bu VR kaydına ait eşleşme bulunamadı."),
        );
      }
      if (
        match.vrRecordId !== parsed.data.vrRecordId
        || match.qrRegistrationId !== parsed.data.qrRegistrationId
        || match.vrEventId !== eventId
        || match.qrRegistrationEventId !== eventId
      ) {
        throw new DeleteMatchDomainError(
          failure("UNMATCH_CONFLICT", "Eşleşme seçilen kayıtlarla uyuşmuyor."),
        );
      }

      const count = await transaction.deleteMatch(
        match.id,
        match.vrRecordId,
        match.qrRegistrationId,
      );
      if (count !== 1) {
        throw new DeleteMatchDomainError(
          failure(
            "UNMATCH_CONFLICT",
            "Eşleşme başka bir işlem tarafından değiştirilmiş.",
          ),
        );
      }

      await transaction.writeAudit({
        actor: { type: "USER", userId: admin.id },
        action: AUDIT_ACTIONS.STUDENT_MATCH_REMOVED,
        entityType: AUDIT_ENTITY_TYPES.STUDENT_MATCH,
        entityId: match.id,
        relatedEntity: {
          type: AUDIT_ENTITY_TYPES.VR_RECORD,
          id: match.vrRecordId,
        },
        reason,
        beforeData: {
          matchId: match.id,
          vrRecordId: match.vrRecordId,
          qrRegistrationId: match.qrRegistrationId,
        },
      });

      return {
        ok: true as const,
        message: "Eşleşme başarıyla kaldırıldı.",
      };
    });
  } catch (error) {
    if (error instanceof DeleteMatchDomainError) return error.result;
    return failure(
      "UNMATCH_FAILED",
      "Eşleşme kaldırılamadı. Lütfen tekrar deneyin.",
    );
  }
}

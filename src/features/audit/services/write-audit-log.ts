import "server-only";

import { Prisma } from "@prisma/client";

import { validateAuditInput } from "@/features/audit/lib/validate-audit-input";
import type {
  AuditJsonValue,
  WriteAuditLogInput,
  WriteAuditLogResult,
} from "@/features/audit/types/audit-log";

export type AuditTransactionClient = Pick<Prisma.TransactionClient, "auditLog">;

function toPrismaJson(value: AuditJsonValue) {
  return value === null ? Prisma.JsonNull : value;
}

export async function writeAuditLog(
  tx: AuditTransactionClient,
  input: WriteAuditLogInput,
): Promise<WriteAuditLogResult> {
  const validated = validateAuditInput(input);
  const data: Prisma.AuditLogUncheckedCreateInput = {
    actorUserId: validated.actor.userId,
    actorType: validated.actor.type,
    action: validated.action,
    entityType: validated.entityType,
    entityId: validated.entityId,
    ...(validated.relatedEntity
      ? {
          relatedEntityType: validated.relatedEntity.type,
          relatedEntityId: validated.relatedEntity.id,
        }
      : {}),
    ...(validated.reason !== undefined ? { reason: validated.reason } : {}),
    ...(validated.beforeData !== undefined
      ? { beforeData: toPrismaJson(validated.beforeData) }
      : {}),
    ...(validated.afterData !== undefined
      ? { afterData: toPrismaJson(validated.afterData) }
      : {}),
    ...(validated.metadata !== undefined
      ? { metadata: toPrismaJson(validated.metadata) }
      : {}),
    ...(validated.correlationId !== undefined
      ? { correlationId: validated.correlationId }
      : {}),
  };

  return tx.auditLog.create({
    data,
    select: { id: true, createdAt: true },
  });
}

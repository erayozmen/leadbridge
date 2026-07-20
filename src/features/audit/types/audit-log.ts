import type { AuditAction } from "@/features/audit/constants/audit-actions";
import type { AuditEntityType } from "@/features/audit/constants/audit-entity-types";

export type AuditJsonValue =
  | string
  | number
  | boolean
  | null
  | AuditJsonValue[]
  | { [key: string]: AuditJsonValue };

export type AuditActor =
  | { type: "USER"; userId: string }
  | { type: "SYSTEM"; userId: null };

export type AuditRelatedEntity = {
  type: AuditEntityType;
  id: string;
};

export type WriteAuditLogInput = {
  actor: AuditActor;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: string;
  relatedEntity?: AuditRelatedEntity;
  reason?: string;
  beforeData?: AuditJsonValue;
  afterData?: AuditJsonValue;
  metadata?: AuditJsonValue;
  correlationId?: string;
};

export type WriteAuditLogResult = {
  id: string;
  createdAt: Date;
};

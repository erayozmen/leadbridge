import {
  AUDIT_ACTIONS,
  type AuditAction,
} from "@/features/audit/constants/audit-actions";
import {
  AUDIT_ENTITY_TYPES,
  type AuditEntityType,
} from "@/features/audit/constants/audit-entity-types";
import type {
  AuditJsonValue,
  WriteAuditLogInput,
} from "@/features/audit/types/audit-log";

export const AUDIT_JSON_FIELD_MAX_BYTES = 8 * 1024;
export const AUDIT_JSON_TOTAL_MAX_BYTES = 16 * 1024;

const ID_MAX_LENGTH = 200;
const CORRELATION_ID_MAX_LENGTH = 200;
const REASON_MIN_LENGTH = 10;
const REASON_MAX_LENGTH = 500;
const FORBIDDEN_JSON_KEYS = new Set(["__proto__", "prototype", "constructor"]);
const FORBIDDEN_CONTROL_CHARACTERS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;
const ACTION_VALUES = new Set<string>(Object.values(AUDIT_ACTIONS));
const ENTITY_TYPE_VALUES = new Set<string>(Object.values(AUDIT_ENTITY_TYPES));
const REASON_REQUIRED_ACTIONS = new Set<AuditAction>([
  AUDIT_ACTIONS.STUDENT_MATCH_REMOVED,
  AUDIT_ACTIONS.QR_ASSIGNMENT_REVERSED,
  AUDIT_ACTIONS.ATTENDANCE_REVERSED,
  AUDIT_ACTIONS.COURSE_ENROLLMENT_REVERSED,
  AUDIT_ACTIONS.VR_RECORD_ARCHIVED,
  AUDIT_ACTIONS.VR_RECORD_DELETED,
    AUDIT_ACTIONS.VR_RECORD_EVENT_ASSIGNED,
    AUDIT_ACTIONS.USER_ACCESS_REVOKED,
  AUDIT_ACTIONS.SCHOOL_DEACTIVATED,
  AUDIT_ACTIONS.SCHOOL_REACTIVATED,
  AUDIT_ACTIONS.EVENT_STATUS_CHANGED,
]);

export class AuditInputValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuditInputValidationError";
  }
}

function fail(message: string): never {
  throw new AuditInputValidationError(message);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function assertOnlyKeys(
  value: Record<string, unknown>,
  allowedKeys: readonly string[],
  field: string,
) {
  const allowed = new Set(allowedKeys);
  if (Object.keys(value).some((key) => !allowed.has(key))) {
    fail(`${field} contains unsupported fields`);
  }
}

function requiredString(value: unknown, field: string, maxLength = ID_MAX_LENGTH) {
  if (typeof value !== "string") fail(`${field} must be a string`);
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > maxLength) {
    fail(`${field} has an invalid length`);
  }
  if (FORBIDDEN_CONTROL_CHARACTERS.test(trimmed)) {
    fail(`${field} contains control characters`);
  }
  return trimmed;
}

function validateAction(value: unknown): AuditAction {
  if (typeof value !== "string" || !ACTION_VALUES.has(value)) {
    fail("action is not supported");
  }
  return value as AuditAction;
}

function validateEntityType(value: unknown): AuditEntityType {
  if (typeof value !== "string" || !ENTITY_TYPE_VALUES.has(value)) {
    fail("entityType is not supported");
  }
  return value as AuditEntityType;
}

function validateJsonValue(
  value: unknown,
  path: string,
  ancestors: Set<object>,
): AuditJsonValue {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) fail(`${path} contains a non-finite number`);
    return value;
  }
  if (typeof value !== "object") fail(`${path} contains a non-JSON value`);
  if (ancestors.has(value)) fail(`${path} contains a circular reference`);
  ancestors.add(value);

  try {
    if (Array.isArray(value)) {
      return value.map((item, index) =>
        validateJsonValue(item, `${path}[${index}]`, ancestors),
      );
    }
    if (!isPlainObject(value)) fail(`${path} must contain only plain objects`);

    const result: Record<string, AuditJsonValue> = {};
    for (const key of Object.keys(value)) {
      if (FORBIDDEN_JSON_KEYS.has(key)) fail(`${path} contains a forbidden key`);
      result[key] = validateJsonValue(value[key], `${path}.${key}`, ancestors);
    }
    return result;
  } finally {
    ancestors.delete(value);
  }
}

function canonicalJson(value: AuditJsonValue): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
    .join(",")}}`;
}

function jsonByteLength(value: AuditJsonValue) {
  return new TextEncoder().encode(canonicalJson(value)).byteLength;
}

function validateReason(value: unknown) {
  if (typeof value !== "string") fail("reason must be a string");
  const reason = value.trim();
  if (reason.length < REASON_MIN_LENGTH || reason.length > REASON_MAX_LENGTH) {
    fail("reason has an invalid length");
  }
  if (FORBIDDEN_CONTROL_CHARACTERS.test(reason)) {
    fail("reason contains control characters");
  }
  return reason;
}

export function validateAuditReason(action: AuditAction, value: unknown): string | undefined {
  const reason = value === undefined ? undefined : validateReason(value);
  if (REASON_REQUIRED_ACTIONS.has(action) && reason === undefined) {
    fail("reason is required for this action");
  }
  return reason;
}

export function isAuditReasonValid(action: AuditAction, value: unknown): boolean {
  try {
    return validateAuditReason(action, value) !== undefined;
  } catch {
    return false;
  }
}

export function validateAuditInput(input: unknown): WriteAuditLogInput {
  if (!isPlainObject(input)) fail("audit input must be a plain object");
  assertOnlyKeys(
    input,
    [
      "actor",
      "action",
      "entityType",
      "entityId",
      "relatedEntity",
      "reason",
      "beforeData",
      "afterData",
      "metadata",
      "correlationId",
    ],
    "audit input",
  );

  const action = validateAction(input.action);
  const entityType = validateEntityType(input.entityType);
  const entityId = requiredString(input.entityId, "entityId");

  if (!isPlainObject(input.actor)) fail("actor must be a plain object");
  assertOnlyKeys(input.actor, ["type", "userId"], "actor");
  let actor: WriteAuditLogInput["actor"];
  if (input.actor.type === "USER") {
    actor = {
      type: "USER",
      userId: requiredString(input.actor.userId, "actor.userId"),
    };
  } else if (input.actor.type === "SYSTEM") {
    if (input.actor.userId !== null) fail("SYSTEM actor must have a null userId");
    actor = { type: "SYSTEM", userId: null };
  } else {
    fail("actor.type is not supported");
  }

  let relatedEntity: WriteAuditLogInput["relatedEntity"];
  if (Object.hasOwn(input, "relatedEntity")) {
    if (!isPlainObject(input.relatedEntity)) {
      fail("relatedEntity must be a plain object");
    }
    assertOnlyKeys(input.relatedEntity, ["type", "id"], "relatedEntity");
    relatedEntity = {
      type: validateEntityType(input.relatedEntity.type),
      id: requiredString(input.relatedEntity.id, "relatedEntity.id"),
    };
  }

  const reason = validateAuditReason(
    action,
    Object.hasOwn(input, "reason") ? input.reason : undefined,
  );

  const jsonFields = ["beforeData", "afterData", "metadata"] as const;
  const validatedJson: Partial<Record<(typeof jsonFields)[number], AuditJsonValue>> = {};
  let totalJsonBytes = 0;
  for (const field of jsonFields) {
    if (!Object.hasOwn(input, field)) continue;
    const value = validateJsonValue(input[field], field, new Set());
    const bytes = jsonByteLength(value);
    if (bytes > AUDIT_JSON_FIELD_MAX_BYTES) fail(`${field} exceeds its size limit`);
    totalJsonBytes += bytes;
    validatedJson[field] = value;
  }
  if (totalJsonBytes > AUDIT_JSON_TOTAL_MAX_BYTES) {
    fail("audit JSON payload exceeds its total size limit");
  }

  let correlationId: string | undefined;
  if (Object.hasOwn(input, "correlationId")) {
    correlationId = requiredString(
      input.correlationId,
      "correlationId",
      CORRELATION_ID_MAX_LENGTH,
    );
  }

  return {
    actor,
    action,
    entityType,
    entityId,
    ...(relatedEntity ? { relatedEntity } : {}),
    ...(reason !== undefined ? { reason } : {}),
    ...validatedJson,
    ...(correlationId !== undefined ? { correlationId } : {}),
  };
}

import { describe, expect, it } from "vitest";

import { AUDIT_ACTIONS } from "@/features/audit/constants/audit-actions";
import { AUDIT_ENTITY_TYPES } from "@/features/audit/constants/audit-entity-types";
import {
  AuditInputValidationError,
  validateAuditInput,
} from "@/features/audit/lib/validate-audit-input";

function validInput() {
  return {
    actor: { type: "USER", userId: "user_1" },
    action: AUDIT_ACTIONS.ATTENDANCE_MARKED,
    entityType: AUDIT_ENTITY_TYPES.QR_REGISTRATION,
    entityId: "registration_1",
  };
}

function expectInvalid(input: unknown) {
  expect(() => validateAuditInput(input)).toThrow(AuditInputValidationError);
}

describe("validateAuditInput constants", () => {
  it("accepts defined action and entity type values", () => {
    expect(validateAuditInput(validInput())).toMatchObject({
      action: AUDIT_ACTIONS.ATTENDANCE_MARKED,
      entityType: AUDIT_ENTITY_TYPES.QR_REGISTRATION,
    });
  });

  it("rejects an unknown action", () => {
    expectInvalid({ ...validInput(), action: "UNKNOWN_ACTION" });
  });

  it("rejects an unknown entity type", () => {
    expectInvalid({ ...validInput(), entityType: "UNKNOWN_ENTITY" });
  });
});

describe("validateAuditInput actor", () => {
  it("accepts USER with a trimmed user id", () => {
    expect(
      validateAuditInput({
        ...validInput(),
        actor: { type: "USER", userId: "  user_1  " },
      }).actor,
    ).toEqual({ type: "USER", userId: "user_1" });
  });

  it("rejects USER without a usable user id", () => {
    expectInvalid({ ...validInput(), actor: { type: "USER", userId: null } });
    expectInvalid({ ...validInput(), actor: { type: "USER", userId: "  " } });
  });

  it("accepts SYSTEM with null user id", () => {
    expect(
      validateAuditInput({
        ...validInput(),
        actor: { type: "SYSTEM", userId: null },
      }).actor,
    ).toEqual({ type: "SYSTEM", userId: null });
  });

  it("rejects SYSTEM with a user id", () => {
    expectInvalid({
      ...validInput(),
      actor: { type: "SYSTEM", userId: "user_1" },
    });
  });

  it("rejects an unknown actor type", () => {
    expectInvalid({ ...validInput(), actor: { type: "SERVICE", userId: null } });
  });
});

describe("validateAuditInput related entity", () => {
  it("accepts an omitted related entity", () => {
    expect(validateAuditInput(validInput())).not.toHaveProperty("relatedEntity");
  });

  it("accepts type and trimmed id together", () => {
    expect(
      validateAuditInput({
        ...validInput(),
        relatedEntity: { type: AUDIT_ENTITY_TYPES.VR_RECORD, id: "  vr_1 " },
      }).relatedEntity,
    ).toEqual({ type: AUDIT_ENTITY_TYPES.VR_RECORD, id: "vr_1" });
  });

  it("rejects a missing related entity type or id", () => {
    expectInvalid({ ...validInput(), relatedEntity: { id: "vr_1" } });
    expectInvalid({
      ...validInput(),
      relatedEntity: { type: AUDIT_ENTITY_TYPES.VR_RECORD },
    });
  });

  it("rejects an empty related entity id", () => {
    expectInvalid({
      ...validInput(),
      relatedEntity: { type: AUDIT_ENTITY_TYPES.VR_RECORD, id: " " },
    });
  });
});

describe("validateAuditInput reason policy", () => {
  const reversalInput = () => ({
    ...validInput(),
    action: AUDIT_ACTIONS.ATTENDANCE_REVERSED,
  });

  it("requires reason for reversal actions", () => {
    expectInvalid(reversalInput());
    expectInvalid({ ...reversalInput(), reason: "   " });
  });

  it("rejects reason shorter than 10 or longer than 500 characters", () => {
    expectInvalid({ ...reversalInput(), reason: "123456789" });
    expectInvalid({ ...reversalInput(), reason: "x".repeat(501) });
  });

  it("trims a valid reason", () => {
    expect(
      validateAuditInput({
        ...reversalInput(),
        reason: "  Yanlış katılım işareti  ",
      }).reason,
    ).toBe("Yanlış katılım işareti");
  });

  it("rejects unsafe control characters but allows tabs and line breaks", () => {
    expectInvalid({ ...reversalInput(), reason: "Geçerli neden\u0001" });
    expect(
      validateAuditInput({
        ...reversalInput(),
        reason: "Birinci satır\nİkinci\tsatır",
      }).reason,
    ).toContain("\n");
  });

  it("allows an action without a reason", () => {
    expect(validateAuditInput(validInput())).not.toHaveProperty("reason");
  });

  it("validates an optional reason when supplied", () => {
    expectInvalid({ ...validInput(), reason: "short" });
  });
});

describe("validateAuditInput JSON safety", () => {
  it("accepts and clones safe nested JSON", () => {
    const beforeData = { status: "ASSIGNED", nested: [true, 12, null] };
    const result = validateAuditInput({ ...validInput(), beforeData });
    expect(result.beforeData).toEqual(beforeData);
    expect(result.beforeData).not.toBe(beforeData);
  });

  it("rejects undefined, functions and symbols", () => {
    expectInvalid({ ...validInput(), beforeData: { value: undefined } });
    expectInvalid({ ...validInput(), beforeData: { value: () => true } });
    expectInvalid({ ...validInput(), beforeData: { value: Symbol("x") } });
  });

  it("rejects Date, BigInt, Buffer, Error and class instances", () => {
    class CustomValue {}
    expectInvalid({ ...validInput(), beforeData: new Date() });
    expectInvalid({ ...validInput(), beforeData: 1n });
    expectInvalid({ ...validInput(), beforeData: Buffer.from("x") });
    expectInvalid({ ...validInput(), beforeData: new Error("private") });
    expectInvalid({ ...validInput(), beforeData: new CustomValue() });
  });

  it("rejects circular references", () => {
    const value: Record<string, unknown> = {};
    value.self = value;
    expectInvalid({ ...validInput(), beforeData: value });
  });

  it("rejects non-finite numbers", () => {
    expectInvalid({ ...validInput(), beforeData: { value: Number.NaN } });
    expectInvalid({ ...validInput(), beforeData: { value: Infinity } });
    expectInvalid({ ...validInput(), beforeData: { value: -Infinity } });
  });

  it("rejects prototype pollution keys", () => {
    for (const key of ["__proto__", "prototype", "constructor"]) {
      const value = JSON.parse(`{"${key}":"blocked"}`) as unknown;
      expectInvalid({ ...validInput(), beforeData: value });
    }
  });

  it("rejects a JSON field over 8 KB", () => {
    expectInvalid({
      ...validInput(),
      beforeData: { value: "x".repeat(8 * 1024) },
    });
  });

  it("rejects a combined JSON payload over 16 KB", () => {
    const value = { value: "x".repeat(6 * 1024) };
    expectInvalid({
      ...validInput(),
      beforeData: value,
      afterData: value,
      metadata: value,
    });
  });
});

describe("validateAuditInput basic fields", () => {
  it("trims entity and correlation ids", () => {
    const result = validateAuditInput({
      ...validInput(),
      entityId: " entity_1 ",
      correlationId: " request_1 ",
    });
    expect(result.entityId).toBe("entity_1");
    expect(result.correlationId).toBe("request_1");
  });

  it("rejects empty or oversized correlation ids", () => {
    expectInvalid({ ...validInput(), correlationId: " " });
    expectInvalid({ ...validInput(), correlationId: "x".repeat(201) });
  });

  it("rejects unsupported top-level fields instead of serializing payloads", () => {
    expectInvalid({ ...validInput(), request: { headers: {} } });
  });
});

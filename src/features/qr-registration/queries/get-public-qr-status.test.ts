import { QrCodeStatus } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { getPublicQrStatus, type PublicQrStatusDependencies } from "@/features/qr-registration/queries/get-public-qr-status";

vi.mock("server-only", () => ({}));

const token = "leadbridge-public-token";

function dependencies(
  record: {
    status: QrCodeStatus;
    archived?: boolean;
    hasAssignedVrRecord: boolean;
    hasRegistration: boolean;
  } | null,
): PublicQrStatusDependencies {
  return {
    findByTokenHash: vi.fn(async () => record
      ? { ...record, archived: record.archived ?? false }
      : null),
  };
}

describe("getPublicQrStatus", () => {
  it("returns AVAILABLE for an ASSIGNED QR linked to a VR record", async () => {
    await expect(getPublicQrStatus(token, dependencies({ status: QrCodeStatus.ASSIGNED, hasAssignedVrRecord: true, hasRegistration: false }))).resolves.toBe("AVAILABLE");
  });
  it("returns NOT_ASSIGNED for a CREATED QR", async () => {
    await expect(getPublicQrStatus(token, dependencies({ status: QrCodeStatus.CREATED, hasAssignedVrRecord: false, hasRegistration: false }))).resolves.toBe("NOT_ASSIGNED");
  });
  it("returns NOT_ASSIGNED for an inconsistent ASSIGNED QR without a VR record", async () => {
    await expect(getPublicQrStatus(token, dependencies({ status: QrCodeStatus.ASSIGNED, hasAssignedVrRecord: false, hasRegistration: false }))).resolves.toBe("NOT_ASSIGNED");
  });
  it("returns ALREADY_USED for a USED QR", async () => {
    await expect(getPublicQrStatus(token, dependencies({ status: QrCodeStatus.USED, hasAssignedVrRecord: true, hasRegistration: true }))).resolves.toBe("ALREADY_USED");
  });
  it("returns DISABLED for a disabled QR", async () => {
    await expect(getPublicQrStatus(token, dependencies({ status: QrCodeStatus.DISABLED, hasAssignedVrRecord: false, hasRegistration: false }))).resolves.toBe("DISABLED");
  });
  it("returns DISABLED for an archived QR even if its status is inconsistent", async () => {
    await expect(getPublicQrStatus(token, dependencies({
      status: QrCodeStatus.ASSIGNED,
      archived: true,
      hasAssignedVrRecord: true,
      hasRegistration: false,
    }))).resolves.toBe("DISABLED");
  });
  it("returns NOT_FOUND for an unknown token", async () => {
    await expect(getPublicQrStatus(token, dependencies(null))).resolves.toBe("NOT_FOUND");
  });
  it("rejects invalid token format before database access", async () => {
    const deps = dependencies(null);
    await expect(getPublicQrStatus("short", deps)).resolves.toBe("INVALID_TOKEN");
    expect(deps.findByTokenHash).not.toHaveBeenCalled();
  });
  it("returns only a safe status and never token material", async () => {
    const status = await getPublicQrStatus(token, dependencies({ status: QrCodeStatus.ASSIGNED, hasAssignedVrRecord: true, hasRegistration: false }));
    expect(status).toBe("AVAILABLE");
    expect(JSON.stringify(status)).not.toContain(token);
  });
  it("maps database failures to INTERNAL_ERROR without leaking details", async () => {
    const deps: PublicQrStatusDependencies = { findByTokenHash: vi.fn(async () => { throw new Error(`database failed ${token}`); }) };
    const status = await getPublicQrStatus(token, deps);
    expect(status).toBe("INTERNAL_ERROR");
    expect(status).not.toContain(token);
  });
});

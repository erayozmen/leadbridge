import { DeviceStatus, DeviceTokenKind, EventStatus } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireStaffOrAdmin, writeAuditLog, transaction, tx } = vi.hoisted(() => {
  const tx = {
    event: { findUnique: vi.fn() },
    device: { create: vi.fn() },
    deviceToken: { create: vi.fn() },
  };
  return {
    requireStaffOrAdmin: vi.fn(async () => ({ id: "staff_1" })),
    writeAuditLog: vi.fn(async () => ({ id: "audit_1", createdAt: new Date() })),
    transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    tx,
  };
});

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: transaction } }));
vi.mock("@/features/auth/server/auth", () => ({ requireStaffOrAdmin }));
vi.mock("@/features/audit/services/write-audit-log", () => ({ writeAuditLog }));

import { hashDeviceToken, normalizePairingCode } from "@/features/devices/lib/device-token";
import { createDevicePairing } from "@/features/devices/services/create-device-pairing";

const now = new Date("2026-09-28T12:00:00.000Z");

describe("createDevicePairing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tx.device.create.mockResolvedValue({ id: "device_1" });
    tx.event.findUnique.mockResolvedValue({ status: EventStatus.ACTIVE });
  });

  it("creates a pending device with a hashed, 15-minute pairing code", async () => {
    const result = await createDevicePairing({ name: "Quest 3 #1", eventId: "event_1" }, now);

    expect(requireStaffOrAdmin).toHaveBeenCalled();
    expect(tx.device.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { name: "Quest 3 #1", eventId: "event_1", status: DeviceStatus.PENDING, createdByUserId: "staff_1" },
      }),
    );
    expect(tx.deviceToken.create.mock.calls[0][0].data).toEqual({
      deviceId: "device_1",
      kind: DeviceTokenKind.PAIRING,
      tokenHash: hashDeviceToken(normalizePairingCode(result.pairingCode)!),
      expiresAt: new Date("2026-09-28T12:15:00.000Z"),
    });
    expect(JSON.stringify(writeAuditLog.mock.calls)).not.toContain(result.pairingCode.replaceAll("-", ""));
  });

  it("rejects archived or unknown events", async () => {
    tx.event.findUnique.mockResolvedValue({ status: EventStatus.ARCHIVED });
    await expect(createDevicePairing({ name: "Quest", eventId: "event_1" }, now)).rejects.toThrow("EVENT_NOT_ASSIGNABLE");
    tx.event.findUnique.mockResolvedValue(null);
    await expect(createDevicePairing({ name: "Quest", eventId: "event_x" }, now)).rejects.toThrow("EVENT_NOT_ASSIGNABLE");
    expect(tx.device.create).not.toHaveBeenCalled();
  });

  it("requires staff or admin before touching the database", async () => {
    requireStaffOrAdmin.mockRejectedValueOnce(new Error("FORBIDDEN"));
    await expect(createDevicePairing({ name: "Quest" }, now)).rejects.toThrow("FORBIDDEN");
    expect(transaction).not.toHaveBeenCalled();
  });
});

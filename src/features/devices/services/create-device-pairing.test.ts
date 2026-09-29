import { DeviceStatus, DeviceTokenKind, EventStatus } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireStaffOrAdmin, writeAuditLog, transaction, tx } = vi.hoisted(() => {
  const tx = {
    $executeRaw: vi.fn(),
    event: { findUnique: vi.fn() },
    device: { create: vi.fn(), findFirst: vi.fn() },
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
import { PAIRING_CODE_TTL_HOURS, PAIRING_CODE_TTL_MS } from "@/features/devices/lib/pairing-policy";
import { createDevicePairing } from "@/features/devices/services/create-device-pairing";

const now = new Date("2026-09-28T12:00:00.000Z");

describe("createDevicePairing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tx.device.create.mockResolvedValue({ id: "device_1" });
    tx.device.findFirst.mockResolvedValue(null);
    tx.event.findUnique.mockResolvedValue({ status: EventStatus.ACTIVE });
  });

  it("uses a 6-hour pairing code lifetime", () => {
    expect(PAIRING_CODE_TTL_HOURS).toBe(6);
    expect(PAIRING_CODE_TTL_MS).toBe(6 * 60 * 60 * 1000);
  });

  it("creates a pending device with a hashed, 6-hour pairing code", async () => {
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
      expiresAt: new Date("2026-09-28T18:00:00.000Z"),
    });
    expect(result.expiresAt).toEqual(new Date("2026-09-28T18:00:00.000Z"));
    expect(JSON.stringify(writeAuditLog.mock.calls)).not.toContain(result.pairingCode.replaceAll("-", ""));
  });

  it("rejects a name already used by a pending or active device", async () => {
    tx.device.findFirst.mockResolvedValue({ id: "device_existing" });
    await expect(createDevicePairing({ name: "quest 3 #1" }, now)).rejects.toThrow("DEVICE_NAME_IN_USE");

    expect(tx.device.findFirst).toHaveBeenCalledWith({
      where: {
        name: { equals: "quest 3 #1", mode: "insensitive" },
        status: { in: [DeviceStatus.PENDING, DeviceStatus.ACTIVE] },
      },
      select: { id: true },
    });
    expect(tx.$executeRaw).toHaveBeenCalled();
    expect(tx.device.create).not.toHaveBeenCalled();
    expect(tx.deviceToken.create).not.toHaveBeenCalled();
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

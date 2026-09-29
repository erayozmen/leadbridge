import { DeviceStatus, DeviceTokenKind } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireStaffOrAdmin, writeAuditLog, transaction, tx } = vi.hoisted(() => {
  const tx = {
    $executeRaw: vi.fn(),
    device: { findUnique: vi.fn(), update: vi.fn(), delete: vi.fn(), create: vi.fn() },
    deviceToken: { updateMany: vi.fn(), create: vi.fn() },
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
import { cancelDevicePairing, disableDevice, renewDevicePairing } from "@/features/devices/services/manage-device";

const now = new Date("2026-09-29T12:00:00.000Z");
const device = (status: DeviceStatus) => ({ id: "device_1", name: "Quest 3 #1", status });

describe("device management", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tx.deviceToken.updateMany.mockResolvedValue({ count: 2 });
  });

  describe("renewDevicePairing", () => {
    it("keeps the same device, revokes earlier codes and issues a new 6-hour code", async () => {
      tx.device.findUnique.mockResolvedValue(device(DeviceStatus.PENDING));
      const result = await renewDevicePairing({ deviceId: "device_1" }, now);

      expect(tx.$executeRaw).toHaveBeenCalled();
      expect(tx.device.create).not.toHaveBeenCalled();
      expect(tx.device.update).not.toHaveBeenCalled();
      expect(tx.deviceToken.updateMany).toHaveBeenCalledWith({
        where: { deviceId: "device_1", revokedAt: null },
        data: { revokedAt: now },
      });
      expect(tx.deviceToken.create.mock.calls[0][0].data).toEqual({
        deviceId: "device_1",
        kind: DeviceTokenKind.PAIRING,
        tokenHash: hashDeviceToken(normalizePairingCode(result.pairingCode)!),
        expiresAt: new Date("2026-09-29T18:00:00.000Z"),
      });
      // The old code is revoked before the new one is stored.
      expect(tx.deviceToken.updateMany.mock.invocationCallOrder[0]).toBeLessThan(tx.deviceToken.create.mock.invocationCallOrder[0]);
      expect(result.deviceId).toBe("device_1");
      expect(writeAuditLog).toHaveBeenCalledWith(tx, expect.objectContaining({ action: "DEVICE_PAIRING_RENEWED", entityId: "device_1" }));
      expect(JSON.stringify(writeAuditLog.mock.calls)).not.toContain(result.pairingCode.replaceAll("-", ""));
    });

    it("produces a different code on every renewal", async () => {
      tx.device.findUnique.mockResolvedValue(device(DeviceStatus.PENDING));
      const first = await renewDevicePairing({ deviceId: "device_1" }, now);
      const second = await renewDevicePairing({ deviceId: "device_1" }, now);
      expect(second.pairingCode).not.toBe(first.pairingCode);
    });

    it("re-opens pairing for a disabled device on the same record", async () => {
      tx.device.findUnique.mockResolvedValue(device(DeviceStatus.DISABLED));
      await renewDevicePairing({ deviceId: "device_1" }, now);
      expect(tx.device.update).toHaveBeenCalledWith({
        where: { id: "device_1" },
        data: { status: DeviceStatus.PENDING },
        select: { id: true },
      });
      expect(tx.device.create).not.toHaveBeenCalled();
    });

    it("refuses to renew an active device", async () => {
      tx.device.findUnique.mockResolvedValue(device(DeviceStatus.ACTIVE));
      await expect(renewDevicePairing({ deviceId: "device_1" }, now)).rejects.toThrow("DEVICE_STATE_CONFLICT");
      expect(tx.deviceToken.updateMany).not.toHaveBeenCalled();
      expect(tx.deviceToken.create).not.toHaveBeenCalled();
    });

    it("reports a missing device", async () => {
      tx.device.findUnique.mockResolvedValue(null);
      await expect(renewDevicePairing({ deviceId: "device_x" }, now)).rejects.toThrow("DEVICE_NOT_FOUND");
    });
  });

  describe("cancelDevicePairing", () => {
    it("deletes a pending device so its code can no longer be used", async () => {
      tx.device.findUnique.mockResolvedValue(device(DeviceStatus.PENDING));
      await expect(cancelDevicePairing({ deviceId: "device_1" })).resolves.toEqual({ deviceId: "device_1" });
      expect(tx.device.delete).toHaveBeenCalledWith({ where: { id: "device_1" }, select: { id: true } });
      expect(writeAuditLog).toHaveBeenCalledWith(
        tx,
        expect.objectContaining({ action: "DEVICE_PAIRING_CANCELLED", beforeData: { name: "Quest 3 #1", status: DeviceStatus.PENDING } }),
      );
    });

    it.each([DeviceStatus.ACTIVE, DeviceStatus.DISABLED])("refuses to cancel a %s device", async (status) => {
      tx.device.findUnique.mockResolvedValue(device(status));
      await expect(cancelDevicePairing({ deviceId: "device_1" })).rejects.toThrow("DEVICE_STATE_CONFLICT");
      expect(tx.device.delete).not.toHaveBeenCalled();
    });
  });

  describe("disableDevice", () => {
    it("disables an active device and revokes all of its tokens", async () => {
      tx.device.findUnique.mockResolvedValue(device(DeviceStatus.ACTIVE));
      await disableDevice({ deviceId: "device_1" }, now);

      expect(tx.device.update).toHaveBeenCalledWith({
        where: { id: "device_1" },
        data: { status: DeviceStatus.DISABLED },
        select: { id: true },
      });
      expect(tx.deviceToken.updateMany).toHaveBeenCalledWith({
        where: { deviceId: "device_1", revokedAt: null },
        data: { revokedAt: now },
      });
      expect(tx.device.delete).not.toHaveBeenCalled();
      expect(writeAuditLog).toHaveBeenCalledWith(
        tx,
        expect.objectContaining({ action: "DEVICE_DISABLED", metadata: { revokedTokenCount: 2 } }),
      );
    });

    it.each([DeviceStatus.PENDING, DeviceStatus.DISABLED])("refuses to disable a %s device", async (status) => {
      tx.device.findUnique.mockResolvedValue(device(status));
      await expect(disableDevice({ deviceId: "device_1" }, now)).rejects.toThrow("DEVICE_STATE_CONFLICT");
      expect(tx.deviceToken.updateMany).not.toHaveBeenCalled();
    });
  });

  it.each([
    ["renew", () => renewDevicePairing({ deviceId: "device_1" }, now)],
    ["cancel", () => cancelDevicePairing({ deviceId: "device_1" })],
    ["disable", () => disableDevice({ deviceId: "device_1" }, now)],
  ])("requires staff or admin to %s", async (_label, run) => {
    requireStaffOrAdmin.mockRejectedValueOnce(new Error("FORBIDDEN"));
    await expect(run()).rejects.toThrow("FORBIDDEN");
    expect(transaction).not.toHaveBeenCalled();
  });

  it("validates the device id before authorization", async () => {
    await expect(renewDevicePairing({}, now)).rejects.toThrow();
    await expect(disableDevice({ deviceId: "device_1", status: "ACTIVE" }, now)).rejects.toThrow();
    expect(transaction).not.toHaveBeenCalled();
  });
});

import { DeviceStatus, DeviceTokenKind } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { writeAuditLog, transaction, tx } = vi.hoisted(() => {
  const tx = {
    deviceToken: { findUnique: vi.fn(), updateMany: vi.fn(), create: vi.fn() },
    device: { findUnique: vi.fn(), update: vi.fn() },
  };
  return {
    writeAuditLog: vi.fn(async () => ({ id: "audit_1", createdAt: new Date() })),
    transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    tx,
  };
});

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: transaction } }));
vi.mock("@/features/audit/services/write-audit-log", () => ({ writeAuditLog }));

import { hashDeviceToken } from "@/features/devices/lib/device-token";
import { pairDevice } from "@/features/devices/services/pair-device";

const now = new Date("2026-09-28T12:00:00.000Z");
const validPairing = {
  id: "pairing_1",
  kind: DeviceTokenKind.PAIRING,
  usedAt: null,
  revokedAt: null,
  expiresAt: new Date("2026-09-28T12:10:00.000Z"),
  device: { id: "device_1", status: DeviceStatus.PENDING },
};

describe("pairDevice", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tx.deviceToken.findUnique.mockResolvedValue(validPairing);
    tx.deviceToken.updateMany.mockResolvedValue({ count: 1 });
    tx.device.findUnique.mockResolvedValue(null);
    tx.device.update.mockResolvedValue({ name: "Quest 3 #1" });
  });

  it("consumes the pairing code and stores only the access token hash", async () => {
    const result = await pairDevice({ pairingCode: "abcd-efgh-jkmn", serialNumber: "2G0Y", appVersion: "0.1.0" }, now);

    expect(tx.deviceToken.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tokenHash: hashDeviceToken("ABCDEFGHJKMN") } }),
    );
    expect(tx.deviceToken.updateMany).toHaveBeenNthCalledWith(1, {
      where: { id: "pairing_1", usedAt: null, revokedAt: null },
      data: { usedAt: now },
    });
    const created = tx.deviceToken.create.mock.calls[0][0].data;
    expect(created).toEqual({
      deviceId: "device_1",
      kind: DeviceTokenKind.ACCESS,
      tokenHash: hashDeviceToken(result.accessToken),
    });
    expect(JSON.stringify(created)).not.toContain(result.accessToken);
    expect(result.deviceId).toBe("device_1");
    expect(result.deviceName).toBe("Quest 3 #1");
  });

  it("persists a name sent by the headset", async () => {
    tx.device.update.mockResolvedValue({ name: "Salon Quest" });
    const result = await pairDevice({ pairingCode: "ABCDEFGHJKMN", name: "  Salon Quest " }, now);
    expect(tx.device.update).toHaveBeenCalledWith({
      where: { id: "device_1" },
      data: { name: "Salon Quest" },
      select: { name: true },
    });
    expect(result.deviceName).toBe("Salon Quest");
    expect(writeAuditLog).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ afterData: expect.objectContaining({ name: "Salon Quest" }) }),
    );
  });

  it("keeps the dashboard name when the headset sends none", async () => {
    await pairDevice({ pairingCode: "ABCDEFGHJKMN" }, now);
    expect(tx.device.update.mock.calls[0][0].data).not.toHaveProperty("name");
  });

  it.each(["Q", "x".repeat(81)])("rejects an invalid device name %#", async (name) => {
    await expect(pairDevice({ pairingCode: "ABCDEFGHJKMN", name }, now)).rejects.toThrow();
    expect(transaction).not.toHaveBeenCalled();
  });

  it("never writes raw codes or tokens to the audit log", async () => {
    const result = await pairDevice({ pairingCode: "ABCDEFGHJKMN" }, now);
    const audit = JSON.stringify(writeAuditLog.mock.calls);
    expect(audit).not.toContain(result.accessToken);
    expect(audit).not.toContain("ABCDEFGHJKMN");
    expect(writeAuditLog).toHaveBeenCalledWith(tx, expect.objectContaining({ action: "DEVICE_PAIRED", entityId: "device_1" }));
  });

  it.each([
    ["unknown", null],
    ["expired", { ...validPairing, expiresAt: new Date("2026-09-28T11:59:59.000Z") }],
    ["used", { ...validPairing, usedAt: now }],
    ["revoked", { ...validPairing, revokedAt: now }],
    ["access token", { ...validPairing, kind: DeviceTokenKind.ACCESS }],
    ["disabled device", { ...validPairing, device: { id: "device_1", status: DeviceStatus.DISABLED } }],
  ])("rejects a %s pairing code", async (_label, record) => {
    tx.deviceToken.findUnique.mockResolvedValue(record);
    await expect(pairDevice({ pairingCode: "ABCDEFGHJKMN" }, now)).rejects.toThrow("INVALID_PAIRING_CODE");
    expect(tx.deviceToken.create).not.toHaveBeenCalled();
  });

  it("rejects a code consumed by a concurrent request", async () => {
    tx.deviceToken.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(pairDevice({ pairingCode: "ABCDEFGHJKMN" }, now)).rejects.toThrow("INVALID_PAIRING_CODE");
  });

  it("rejects malformed codes without querying the database", async () => {
    await expect(pairDevice({ pairingCode: "not-a-code" }, now)).rejects.toThrow("INVALID_PAIRING_CODE");
    expect(transaction).not.toHaveBeenCalled();
  });

  it("rejects a serial number that belongs to another device", async () => {
    tx.device.findUnique.mockResolvedValue({ id: "device_2" });
    await expect(pairDevice({ pairingCode: "ABCDEFGHJKMN", serialNumber: "2G0Y" }, now)).rejects.toThrow("SERIAL_NUMBER_IN_USE");
  });

  it("rejects unknown fields", async () => {
    await expect(pairDevice({ pairingCode: "ABCDEFGHJKMN", role: "ADMIN" }, now)).rejects.toThrow();
  });
});

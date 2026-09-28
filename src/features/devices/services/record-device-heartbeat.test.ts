import { DeviceStatus } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { writeAuditLog, transaction, tx } = vi.hoisted(() => {
  const tx = { device: { updateMany: vi.fn() }, deviceToken: { update: vi.fn() } };
  return {
    writeAuditLog: vi.fn(async () => ({ id: "audit_1", createdAt: new Date() })),
    transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    tx,
  };
});

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: transaction } }));
vi.mock("@/features/audit/services/write-audit-log", () => ({ writeAuditLog }));

import { recordDeviceHeartbeat } from "@/features/devices/services/record-device-heartbeat";

const now = new Date("2026-09-28T12:00:00.000Z");
const device = { deviceId: "device_1", tokenId: "token_1", status: DeviceStatus.ACTIVE, appVersion: "0.1.0" };

describe("recordDeviceHeartbeat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tx.device.updateMany.mockResolvedValue({ count: 1 });
  });

  it("updates lastSeenAt, appVersion and token usage without auditing an unchanged device", async () => {
    await expect(recordDeviceHeartbeat(device, { appVersion: "0.1.0" }, now)).resolves.toEqual({
      status: DeviceStatus.ACTIVE,
      serverTime: now.toISOString(),
    });
    expect(tx.device.updateMany).toHaveBeenCalledWith({
      where: { id: "device_1", status: { not: DeviceStatus.DISABLED } },
      data: { lastSeenAt: now, appVersion: "0.1.0", status: DeviceStatus.ACTIVE },
    });
    expect(tx.deviceToken.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "token_1" }, data: { lastUsedAt: now } }));
    expect(writeAuditLog).not.toHaveBeenCalled();
  });

  it("activates a pending device and audits the transition", async () => {
    const result = await recordDeviceHeartbeat({ ...device, status: DeviceStatus.PENDING }, { appVersion: "0.1.0" }, now);
    expect(result.status).toBe(DeviceStatus.ACTIVE);
    expect(writeAuditLog).toHaveBeenCalledWith(tx, expect.objectContaining({ action: "DEVICE_ACTIVATED" }));
  });

  it("audits app version changes", async () => {
    await recordDeviceHeartbeat(device, { appVersion: "0.2.0" }, now);
    expect(writeAuditLog).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ action: "DEVICE_APP_VERSION_CHANGED", afterData: { appVersion: "0.2.0" } }),
    );
  });

  it("rejects disabled devices, including ones disabled mid-request", async () => {
    await expect(recordDeviceHeartbeat({ ...device, status: DeviceStatus.DISABLED }, { appVersion: "0.1.0" }, now)).rejects.toThrow("DEVICE_DISABLED");
    tx.device.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(recordDeviceHeartbeat(device, { appVersion: "0.1.0" }, now)).rejects.toThrow("DEVICE_DISABLED");
  });

  it("validates the heartbeat body", async () => {
    await expect(recordDeviceHeartbeat(device, {}, now)).rejects.toThrow();
    await expect(recordDeviceHeartbeat(device, { appVersion: "0.1.0", status: "DISABLED" }, now)).rejects.toThrow();
  });
});

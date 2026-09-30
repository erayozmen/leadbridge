import { DeviceCommandType, DeviceStatus, VideoStatus } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const tx = {
    $executeRaw: vi.fn(),
    video: { findUnique: vi.fn() },
    device: { findUnique: vi.fn() },
    deviceCommand: { updateMany: vi.fn(), create: vi.fn() },
  };
  return {
    tx,
    requireAdmin: vi.fn(),
    writeAuditLog: vi.fn(async () => ({ id: "audit_1", createdAt: new Date() })),
    transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
  };
});

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: mocks.transaction } }));
vi.mock("@/features/auth/server/auth", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/features/audit/services/write-audit-log", () => ({ writeAuditLog: mocks.writeAuditLog }));

import { DEVICE_ONLINE_WINDOW_SECONDS } from "@/features/devices/lib/command-policy";
import { sendPlayVideoCommand, sendStopCommand } from "@/features/devices/services/device-commands";

const { tx } = mocks;
const now = new Date("2026-10-01T10:00:00.000Z");
const secondsAgo = (seconds: number) => new Date(now.getTime() - seconds * 1000);

describe("device commands", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({ id: "admin_1" });
    tx.video.findUnique.mockResolvedValue({ id: "video_1", displayName: "Mekke", status: VideoStatus.READY });
    tx.device.findUnique.mockResolvedValue({ status: DeviceStatus.ACTIVE, lastSeenAt: secondsAgo(10) });
    tx.deviceCommand.updateMany.mockResolvedValue({ count: 1 });
    tx.deviceCommand.create.mockResolvedValue({ id: "cmd_2" });
  });

  it("queues a PLAY_VIDEO command, supersedes the device's open commands and audits it", async () => {
    await expect(sendPlayVideoCommand({ deviceId: "device_1", videoId: "video_1" }, now)).resolves.toEqual({ commandId: "cmd_2" });

    expect(tx.$executeRaw).toHaveBeenCalled();
    expect(tx.deviceCommand.updateMany).toHaveBeenCalledWith({
      where: { deviceId: "device_1", status: { in: ["PENDING", "DELIVERED", "DOWNLOADING", "PLAYING"] } },
      data: { status: "CANCELLED" },
    });
    expect(tx.deviceCommand.create).toHaveBeenCalledWith({
      data: { deviceId: "device_1", type: DeviceCommandType.PLAY_VIDEO, videoId: "video_1", createdByUserId: "admin_1" },
      select: { id: true },
    });
    expect(mocks.writeAuditLog).toHaveBeenCalledWith(tx, expect.objectContaining({
      actor: { type: "USER", userId: "admin_1" },
      action: "DEVICE_COMMAND_CREATED",
      entityId: "device_1",
      relatedEntity: { type: "VIDEO", id: "video_1" },
      afterData: { commandId: "cmd_2", type: "PLAY_VIDEO", videoName: "Mekke" },
    }));
  });

  it("keeps devices independent: only the target device's commands are superseded", async () => {
    await sendPlayVideoCommand({ deviceId: "device_2", videoId: "video_1" }, now);
    expect(tx.deviceCommand.updateMany.mock.calls[0][0].where.deviceId).toBe("device_2");
    expect(tx.deviceCommand.create.mock.calls[0][0].data.deviceId).toBe("device_2");
  });

  it("allows the same video on several devices", async () => {
    await sendPlayVideoCommand({ deviceId: "device_1", videoId: "video_1" }, now);
    await sendPlayVideoCommand({ deviceId: "device_2", videoId: "video_1" }, now);
    expect(tx.deviceCommand.create).toHaveBeenCalledTimes(2);
  });

  it.each([VideoStatus.UPLOADING, VideoStatus.FAILED, VideoStatus.ARCHIVED])("refuses a %s video", async (status) => {
    tx.video.findUnique.mockResolvedValue({ id: "video_1", displayName: "Mekke", status });
    await expect(sendPlayVideoCommand({ deviceId: "device_1", videoId: "video_1" }, now)).rejects.toThrow("VIDEO_NOT_AVAILABLE");
    expect(tx.deviceCommand.create).not.toHaveBeenCalled();
  });

  it("refuses an unknown video", async () => {
    tx.video.findUnique.mockResolvedValue(null);
    await expect(sendPlayVideoCommand({ deviceId: "device_1", videoId: "missing" }, now)).rejects.toThrow("VIDEO_NOT_AVAILABLE");
  });

  it.each([DeviceStatus.PENDING, DeviceStatus.DISABLED])("refuses a %s device", async (status) => {
    tx.device.findUnique.mockResolvedValue({ status, lastSeenAt: secondsAgo(10) });
    await expect(sendPlayVideoCommand({ deviceId: "device_1", videoId: "video_1" }, now)).rejects.toThrow("DEVICE_STATE_CONFLICT");
    expect(tx.deviceCommand.create).not.toHaveBeenCalled();
  });

  it("refuses an unknown device", async () => {
    tx.device.findUnique.mockResolvedValue(null);
    await expect(sendPlayVideoCommand({ deviceId: "nope", videoId: "video_1" }, now)).rejects.toThrow("DEVICE_NOT_FOUND");
  });

  it.each([
    ["never connected", null],
    ["silent past the online window", secondsAgo(DEVICE_ONLINE_WINDOW_SECONDS + 1)],
  ])("refuses an offline device (%s)", async (_label, lastSeenAt) => {
    tx.device.findUnique.mockResolvedValue({ status: DeviceStatus.ACTIVE, lastSeenAt });
    await expect(sendPlayVideoCommand({ deviceId: "device_1", videoId: "video_1" }, now)).rejects.toThrow("DEVICE_OFFLINE");
    await expect(sendStopCommand({ deviceId: "device_1" }, now)).rejects.toThrow("DEVICE_OFFLINE");
    expect(tx.deviceCommand.updateMany).not.toHaveBeenCalled();
    expect(tx.deviceCommand.create).not.toHaveBeenCalled();
  });

  it("queues a STOP command without a video", async () => {
    await sendStopCommand({ deviceId: "device_1" }, now);
    expect(tx.deviceCommand.create).toHaveBeenCalledWith({
      data: { deviceId: "device_1", type: DeviceCommandType.STOP, videoId: null, createdByUserId: "admin_1" },
      select: { id: true },
    });
  });

  it("rejects non-admin users (including staff) before touching the database", async () => {
    mocks.requireAdmin.mockRejectedValue(new Error("FORBIDDEN"));
    await expect(sendPlayVideoCommand({ deviceId: "device_1", videoId: "video_1" }, now)).rejects.toThrow("FORBIDDEN");
    await expect(sendStopCommand({ deviceId: "device_1" }, now)).rejects.toThrow("FORBIDDEN");
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("rejects malformed input", async () => {
    await expect(sendPlayVideoCommand({ deviceId: "device_1" }, now)).rejects.toThrow();
    await expect(sendPlayVideoCommand({ deviceId: "device_1", videoId: "video_1", extra: 1 }, now)).rejects.toThrow();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});

import { DeviceCommandType, DevicePlaybackState, DeviceStatus, VideoStatus } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const tx = {
    deviceCommand: { findUnique: vi.fn(), updateMany: vi.fn() },
    device: { update: vi.fn() },
    deviceVideo: { upsert: vi.fn() },
  };
  return {
    tx,
    findFirst: vi.fn(),
    writeAuditLog: vi.fn(async () => ({ id: "audit_1", createdAt: new Date() })),
    transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    createSignedVideoDownload: vi.fn(),
  };
});

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({
  prisma: { $transaction: mocks.transaction, deviceCommand: { findFirst: mocks.findFirst } },
}));
vi.mock("@/features/audit/services/write-audit-log", () => ({ writeAuditLog: mocks.writeAuditLog }));
vi.mock("@/features/videos/services/video-storage", () => ({ createSignedVideoDownload: mocks.createSignedVideoDownload }));

import {
  ACTIVE_POLL_SECONDS,
  DOWNLOAD_URL_TTL_SECONDS,
  IDLE_POLL_SECONDS,
  PENDING_COMMAND_TTL_SECONDS,
} from "@/features/devices/lib/command-policy";
import { createVideoDownload, listPendingCommands, reportCommandStatus } from "@/features/devices/services/agent-commands";

const { tx } = mocks;
const now = new Date("2026-10-01T10:00:00.000Z");
const recently = new Date(now.getTime() - 30_000);
const longAgo = new Date(now.getTime() - (PENDING_COMMAND_TTL_SECONDS + 1) * 1000);
const device = { deviceId: "device_1", tokenId: "token_1", status: DeviceStatus.ACTIVE, appVersion: "0.2.0" };
const readyVideo = { id: "video_1", displayName: "Mekke", sizeBytes: BigInt(7_830_161), sha256: "a".repeat(64), mimeType: "video/mp4", status: VideoStatus.READY };
const pending = (overrides: Record<string, unknown> = {}) => ({
  id: "cmd_1", type: DeviceCommandType.PLAY_VIDEO, status: "PENDING", videoId: "video_1", createdAt: recently, video: readyVideo, ...overrides,
});
const playCommand = (status: string, overrides: Record<string, unknown> = {}) => ({
  id: "cmd_1", deviceId: "device_1", type: DeviceCommandType.PLAY_VIDEO, status, videoId: "video_1",
  createdAt: recently, deliveredAt: status === "PENDING" ? null : recently, startedAt: null, ...overrides,
});
const auditActions = () => mocks.writeAuditLog.mock.calls.map((call) => (call as unknown[])[1] as { action: string }).map((entry) => entry.action);

describe("agent commands", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tx.deviceCommand.updateMany.mockResolvedValue({ count: 1 });
    mocks.createSignedVideoDownload.mockResolvedValue("https://project.supabase.co/storage/v1/object/sign/videos/x?token=signed");
  });

  describe("listPendingCommands (heartbeat)", () => {
    it("returns an empty list and the idle poll interval when nothing is queued", async () => {
      mocks.findFirst.mockResolvedValue(null);
      await expect(listPendingCommands("device_1", now)).resolves.toEqual({ commands: [], pollIntervalSeconds: IDLE_POLL_SECONDS });
    });

    it("only looks at the authenticated device's own open commands", async () => {
      mocks.findFirst.mockResolvedValue(null);
      await listPendingCommands("device_7", now);
      expect(mocks.findFirst.mock.calls[0][0].where).toEqual({ deviceId: "device_7", status: { in: ["PENDING", "DELIVERED", "DOWNLOADING"] } });
    });

    it("returns a PLAY_VIDEO command with video metadata without changing its state", async () => {
      mocks.findFirst.mockResolvedValue(pending());
      const result = await listPendingCommands("device_1", now);
      expect(result).toEqual({
        commands: [{
          id: "cmd_1",
          type: "PLAY_VIDEO",
          videoId: "video_1",
          video: { id: "video_1", displayName: "Mekke", sizeBytes: "7830161", sha256: "a".repeat(64), mimeType: "video/mp4" },
        }],
        pollIntervalSeconds: ACTIVE_POLL_SECONDS,
      });
      // Delivery is acknowledged by the Agent, so a lost response is simply re-delivered.
      expect(mocks.transaction).not.toHaveBeenCalled();
      expect(JSON.stringify(result)).not.toMatch(/storagePath|token|url/i);
    });

    it("re-delivers a DOWNLOADING command so a restarted Agent can resume", async () => {
      mocks.findFirst.mockResolvedValue(pending({ status: "DOWNLOADING", createdAt: longAgo }));
      const result = await listPendingCommands("device_1", now);
      expect(result.commands.map((command) => command.id)).toEqual(["cmd_1"]);
    });

    it("expires a command that was never acknowledged in time and audits it", async () => {
      mocks.findFirst.mockResolvedValue(pending({ createdAt: longAgo }));
      await expect(listPendingCommands("device_1", now)).resolves.toEqual({ commands: [], pollIntervalSeconds: IDLE_POLL_SECONDS });
      expect(tx.deviceCommand.updateMany).toHaveBeenCalledWith({ where: { id: "cmd_1", status: "PENDING" }, data: { status: "EXPIRED" } });
      expect(auditActions()).toEqual(["DEVICE_COMMAND_EXPIRED"]);
    });

    it("fails a command whose video is no longer READY instead of delivering it", async () => {
      mocks.findFirst.mockResolvedValue(pending({ video: { ...readyVideo, status: VideoStatus.ARCHIVED } }));
      await expect(listPendingCommands("device_1", now)).resolves.toEqual({ commands: [], pollIntervalSeconds: IDLE_POLL_SECONDS });
      expect(tx.deviceCommand.updateMany).toHaveBeenCalledWith({
        where: { id: "cmd_1", status: "PENDING" },
        data: { status: "FAILED", error: "VIDEO_NOT_AVAILABLE", failedAt: now },
      });
      expect(auditActions()).toEqual(["DEVICE_COMMAND_FAILED"]);
    });
  });

  describe("reportCommandStatus", () => {
    it("records the Agent's delivery acknowledgement", async () => {
      tx.deviceCommand.findUnique.mockResolvedValue(playCommand("PENDING"));
      await expect(reportCommandStatus(device, "cmd_1", { status: "DELIVERED" }, now)).resolves.toEqual({ status: "DELIVERED" });
      expect(tx.deviceCommand.updateMany).toHaveBeenCalledWith({ where: { id: "cmd_1", status: "PENDING" }, data: { status: "DELIVERED", deliveredAt: now } });
      expect(tx.device.update).not.toHaveBeenCalled();
      expect(auditActions()).toEqual(["DEVICE_COMMAND_DELIVERED"]);
    });

    it("records a download start on the command, the device and its video copy", async () => {
      tx.deviceCommand.findUnique.mockResolvedValue(playCommand("DELIVERED"));
      await expect(reportCommandStatus(device, "cmd_1", { status: "DOWNLOADING" }, now)).resolves.toEqual({ status: "DOWNLOADING" });
      expect(tx.deviceCommand.updateMany.mock.calls[0][0].data).toEqual({ status: "DOWNLOADING", startedAt: now });
      expect(tx.device.update).toHaveBeenCalledWith(expect.objectContaining({
        data: { playbackState: DevicePlaybackState.DOWNLOADING, currentVideoId: "video_1", playbackUpdatedAt: now },
      }));
      expect(tx.deviceVideo.upsert).toHaveBeenCalledWith(expect.objectContaining({ create: { deviceId: "device_1", videoId: "video_1", status: "DOWNLOADING" } }));
      expect(auditActions()).toEqual(["DEVICE_VIDEO_DOWNLOAD_STARTED"]);
    });

    it("marks the download complete and the copy READY when a downloaded video starts playing", async () => {
      tx.deviceCommand.findUnique.mockResolvedValue(playCommand("DOWNLOADING", { startedAt: recently }));
      await reportCommandStatus(device, "cmd_1", { status: "PLAYING" }, now);
      expect(tx.deviceVideo.upsert).toHaveBeenCalledWith(expect.objectContaining({
        update: { status: "READY", lastError: null, lastPlayedAt: now, downloadedAt: now },
      }));
      expect(tx.device.update.mock.calls[0][0].data).toEqual({ playbackState: DevicePlaybackState.PLAYING, currentVideoId: "video_1", playbackUpdatedAt: now });
      expect(auditActions()).toEqual(["DEVICE_VIDEO_DOWNLOAD_COMPLETED", "DEVICE_VIDEO_PLAYING"]);
    });

    it("plays from the device cache without recording a new download", async () => {
      tx.deviceCommand.findUnique.mockResolvedValue(playCommand("DELIVERED"));
      await reportCommandStatus(device, "cmd_1", { status: "PLAYING" }, now);
      expect(tx.deviceVideo.upsert.mock.calls[0][0].update).toEqual({ status: "READY", lastError: null, lastPlayedAt: now });
      expect(auditActions()).toEqual(["DEVICE_VIDEO_PLAYING"]);
      expect(mocks.writeAuditLog.mock.calls[0][1]).toMatchObject({ afterData: { fromDeviceCache: true } });
    });

    it("returns the device to IDLE when playback completes", async () => {
      tx.deviceCommand.findUnique.mockResolvedValue(playCommand("PLAYING", { startedAt: recently }));
      await reportCommandStatus(device, "cmd_1", { status: "COMPLETED" }, now);
      expect(tx.deviceCommand.updateMany).toHaveBeenCalledWith({ where: { id: "cmd_1", status: "PLAYING" }, data: { status: "COMPLETED", completedAt: now } });
      expect(tx.device.update.mock.calls[0][0].data).toEqual({ playbackState: DevicePlaybackState.IDLE, currentVideoId: null, playbackUpdatedAt: now });
      expect(auditActions()).toEqual(["DEVICE_COMMAND_COMPLETED"]);
    });

    it("marks the device STOPPED when a STOP command completes", async () => {
      tx.deviceCommand.findUnique.mockResolvedValue(playCommand("DELIVERED", { type: DeviceCommandType.STOP, videoId: null }));
      await reportCommandStatus(device, "cmd_1", { status: "COMPLETED" }, now);
      expect(tx.device.update.mock.calls[0][0].data).toEqual({ playbackState: DevicePlaybackState.STOPPED, currentVideoId: null, playbackUpdatedAt: now });
      expect(tx.deviceVideo.upsert).not.toHaveBeenCalled();
    });

    it("records a checksum failure on the copy and audits it", async () => {
      tx.deviceCommand.findUnique.mockResolvedValue(playCommand("DOWNLOADING"));
      await reportCommandStatus(device, "cmd_1", { status: "FAILED", error: "CHECKSUM_MISMATCH" }, now);
      expect(tx.deviceCommand.updateMany.mock.calls[0][0].data).toEqual({ status: "FAILED", failedAt: now, error: "CHECKSUM_MISMATCH" });
      expect(tx.deviceVideo.upsert).toHaveBeenCalledWith(expect.objectContaining({ update: { status: "FAILED", lastError: "CHECKSUM_MISMATCH" } }));
      expect(tx.device.update.mock.calls[0][0].data.playbackState).toBe(DevicePlaybackState.ERROR);
      expect(auditActions()).toEqual(["DEVICE_COMMAND_FAILED"]);
      expect(mocks.writeAuditLog.mock.calls[0][1]).toMatchObject({ afterData: { commandId: "cmd_1", error: "CHECKSUM_MISMATCH" } });
    });

    it("keeps a downloaded copy READY when only the player failed", async () => {
      tx.deviceCommand.findUnique.mockResolvedValue(playCommand("DOWNLOADING"));
      await reportCommandStatus(device, "cmd_1", { status: "FAILED", error: "PLAYER_NOT_STARTED" }, now);
      expect(tx.deviceVideo.upsert.mock.calls[0][0].update).toEqual({ status: "READY", lastError: null, downloadedAt: now });
      expect(auditActions()).toEqual(["DEVICE_VIDEO_DOWNLOAD_COMPLETED", "DEVICE_COMMAND_FAILED"]);
    });

    it("tells the Agent when its command was superseded", async () => {
      tx.deviceCommand.findUnique.mockResolvedValue(playCommand("CANCELLED"));
      await expect(reportCommandStatus(device, "cmd_1", { status: "PLAYING" }, now)).rejects.toThrow("COMMAND_CANCELLED");
      expect(tx.deviceCommand.updateMany).not.toHaveBeenCalled();
    });

    it("rejects any progress on an expired command", async () => {
      tx.deviceCommand.findUnique.mockResolvedValue(playCommand("EXPIRED"));
      await expect(reportCommandStatus(device, "cmd_1", { status: "PLAYING" }, now)).rejects.toThrow("COMMAND_EXPIRED");
      tx.deviceCommand.findUnique.mockResolvedValue(playCommand("PENDING", { createdAt: longAgo }));
      await expect(reportCommandStatus(device, "cmd_1", { status: "DELIVERED" }, now)).rejects.toThrow("COMMAND_EXPIRED");
      expect(tx.deviceCommand.updateMany).not.toHaveBeenCalled();
    });

    it("hides other devices' commands", async () => {
      tx.deviceCommand.findUnique.mockResolvedValue(playCommand("DELIVERED", { deviceId: "device_2" }));
      await expect(reportCommandStatus(device, "cmd_1", { status: "PLAYING" }, now)).rejects.toThrow("COMMAND_NOT_FOUND");
      tx.deviceCommand.findUnique.mockResolvedValue(null);
      await expect(reportCommandStatus(device, "cmd_x", { status: "PLAYING" }, now)).rejects.toThrow("COMMAND_NOT_FOUND");
      expect(tx.deviceCommand.updateMany).not.toHaveBeenCalled();
    });

    it.each([
      ["COMPLETED before playing", "DELIVERED", "COMPLETED"],
      ["downloading after playing", "PLAYING", "DOWNLOADING"],
      ["playing after a failure", "FAILED", "PLAYING"],
      ["anything after completion", "COMPLETED", "PLAYING"],
    ])("rejects %s", async (_label, from, to) => {
      tx.deviceCommand.findUnique.mockResolvedValue(playCommand(from));
      await expect(reportCommandStatus(device, "cmd_1", { status: to }, now)).rejects.toThrow("INVALID_COMMAND_TRANSITION");
      expect(tx.deviceCommand.updateMany).not.toHaveBeenCalled();
    });

    it("rejects a STOP command pretending to download", async () => {
      tx.deviceCommand.findUnique.mockResolvedValue(playCommand("DELIVERED", { type: DeviceCommandType.STOP, videoId: null }));
      await expect(reportCommandStatus(device, "cmd_1", { status: "DOWNLOADING" }, now)).rejects.toThrow("INVALID_COMMAND_TRANSITION");
    });

    it.each(["DELIVERED", "DOWNLOADING", "PLAYING"])("treats a repeated %s report as a no-op (idempotent)", async (status) => {
      tx.deviceCommand.findUnique.mockResolvedValue(playCommand(status));
      await expect(reportCommandStatus(device, "cmd_1", { status }, now)).resolves.toEqual({ status });
      expect(tx.deviceCommand.updateMany).not.toHaveBeenCalled();
      expect(mocks.writeAuditLog).not.toHaveBeenCalled();
    });

    it("ignores a late DELIVERED acknowledgement for a command that already moved on", async () => {
      tx.deviceCommand.findUnique.mockResolvedValue(playCommand("PLAYING"));
      await expect(reportCommandStatus(device, "cmd_1", { status: "DELIVERED" }, now)).resolves.toEqual({ status: "PLAYING" });
      expect(tx.deviceCommand.updateMany).not.toHaveBeenCalled();
    });

    it("fails safely when a concurrent update won the race", async () => {
      tx.deviceCommand.findUnique.mockResolvedValue(playCommand("DELIVERED"));
      tx.deviceCommand.updateMany.mockResolvedValue({ count: 0 });
      await expect(reportCommandStatus(device, "cmd_1", { status: "PLAYING" }, now)).rejects.toThrow("INVALID_COMMAND_TRANSITION");
      expect(mocks.writeAuditLog).not.toHaveBeenCalled();
    });

    it("validates the report body and rejects disabled devices", async () => {
      await expect(reportCommandStatus(device, "cmd_1", { status: "CANCELLED" }, now)).rejects.toThrow();
      await expect(reportCommandStatus(device, "cmd_1", { status: "EXPIRED" }, now)).rejects.toThrow();
      await expect(reportCommandStatus(device, "cmd_1", { status: "FAILED", error: "https://x/?token=abc" }, now)).rejects.toThrow();
      await expect(reportCommandStatus(device, "cmd_1", { status: "PLAYING", extra: true }, now)).rejects.toThrow();
      await expect(reportCommandStatus({ ...device, status: DeviceStatus.DISABLED }, "cmd_1", { status: "PLAYING" }, now)).rejects.toThrow("DEVICE_DISABLED");
      expect(mocks.transaction).not.toHaveBeenCalled();
    });
  });

  describe("createVideoDownload", () => {
    it("issues a short-lived signed URL only for a video with an open PLAY_VIDEO command on this device", async () => {
      mocks.findFirst.mockResolvedValue({ video: { storagePath: "uuid/Mekke.mp4", sizeBytes: BigInt(7_830_161), sha256: "a".repeat(64), status: VideoStatus.READY } });
      const download = await createVideoDownload(device, "video_1");
      expect(download).toEqual({
        url: "https://project.supabase.co/storage/v1/object/sign/videos/x?token=signed",
        expiresInSeconds: DOWNLOAD_URL_TTL_SECONDS,
        sizeBytes: "7830161",
        sha256: "a".repeat(64),
      });
      expect(mocks.findFirst.mock.calls[0][0].where).toEqual({
        deviceId: "device_1",
        videoId: "video_1",
        type: "PLAY_VIDEO",
        status: { in: ["PENDING", "DELIVERED", "DOWNLOADING"] },
      });
      expect(mocks.createSignedVideoDownload).toHaveBeenCalledWith("uuid/Mekke.mp4", DOWNLOAD_URL_TTL_SECONDS);
      expect(DOWNLOAD_URL_TTL_SECONDS).toBeLessThanOrEqual(15 * 60);
      // The signed URL is never written to the audit log.
      expect(mocks.writeAuditLog).not.toHaveBeenCalled();
      expect(Object.keys(download)).not.toContain("storagePath");
    });

    it("refuses videos that were not sent to this device", async () => {
      mocks.findFirst.mockResolvedValue(null);
      await expect(createVideoDownload(device, "video_other")).rejects.toThrow("DOWNLOAD_NOT_AUTHORIZED");
      expect(mocks.createSignedVideoDownload).not.toHaveBeenCalled();
    });

    it.each([VideoStatus.ARCHIVED, VideoStatus.FAILED, VideoStatus.UPLOADING])("refuses a %s video", async (status) => {
      mocks.findFirst.mockResolvedValue({ video: { storagePath: "p", sizeBytes: BigInt(1), sha256: null, status } });
      await expect(createVideoDownload(device, "video_1")).rejects.toThrow("VIDEO_NOT_AVAILABLE");
      expect(mocks.createSignedVideoDownload).not.toHaveBeenCalled();
    });

    it("refuses disabled devices", async () => {
      await expect(createVideoDownload({ ...device, status: DeviceStatus.DISABLED }, "video_1")).rejects.toThrow("DEVICE_DISABLED");
      expect(mocks.findFirst).not.toHaveBeenCalled();
    });
  });
});

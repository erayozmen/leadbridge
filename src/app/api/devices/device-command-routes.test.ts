import { DeviceStatus } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authenticateDevice: vi.fn(),
  recordDeviceHeartbeat: vi.fn(),
  listPendingCommands: vi.fn(),
  reportCommandStatus: vi.fn(),
  createVideoDownload: vi.fn(),
  captureTechnicalException: vi.fn(),
}));

vi.mock("@/features/devices/server/authenticate-device", () => ({ authenticateDevice: mocks.authenticateDevice }));
vi.mock("@/features/devices/services/record-device-heartbeat", () => ({ recordDeviceHeartbeat: mocks.recordDeviceHeartbeat }));
vi.mock("@/features/devices/services/agent-commands", () => ({
  listPendingCommands: mocks.listPendingCommands,
  reportCommandStatus: mocks.reportCommandStatus,
  createVideoDownload: mocks.createVideoDownload,
}));
vi.mock("@/lib/monitoring/capture", () => ({ captureTechnicalException: mocks.captureTechnicalException }));

import { POST as statusPost } from "@/app/api/devices/commands/[commandId]/status/route";
import { POST as heartbeatPost } from "@/app/api/devices/heartbeat/route";
import { POST as downloadPost } from "@/app/api/devices/videos/[videoId]/download-url/route";
import { DeviceError } from "@/features/devices/services/device-errors";
import { VideoError } from "@/features/videos/services/video-errors";
import { clearRateLimitsForTests } from "@/lib/security/rate-limit";

const device = { deviceId: "device_1", tokenId: "token_1", status: DeviceStatus.ACTIVE, appVersion: "0.2.0" };
const post = (path: string, body?: unknown) =>
  new Request(`https://www.leadbridges.com.tr${path}`, {
    method: "POST",
    headers: { authorization: "Bearer token", "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

describe("device command routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearRateLimitsForTests();
    mocks.authenticateDevice.mockResolvedValue(device);
  });

  describe("heartbeat", () => {
    it("keeps the existing fields and adds the device's pending commands and poll interval", async () => {
      mocks.recordDeviceHeartbeat.mockResolvedValue({ status: "ACTIVE", serverTime: "2026-10-01T10:00:00.000Z" });
      const command = { id: "cmd_1", type: "PLAY_VIDEO", videoId: "video_1", video: { id: "video_1", displayName: "Mekke", sizeBytes: "10", sha256: null, mimeType: "video/mp4" } };
      mocks.listPendingCommands.mockResolvedValue({ commands: [command], pollIntervalSeconds: 5 });
      const response = await heartbeatPost(post("/api/devices/heartbeat", { appVersion: "0.2.0" }));
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toEqual({ status: "ACTIVE", serverTime: "2026-10-01T10:00:00.000Z", commands: [command], pollIntervalSeconds: 5 });
      // Commands are looked up for the token's own device only, and no credential is echoed back.
      expect(mocks.listPendingCommands).toHaveBeenCalledWith("device_1");
      expect(JSON.stringify(body)).not.toMatch(/token/i);
    });

    it("rejects an invalid or revoked device token without looking at commands", async () => {
      mocks.authenticateDevice.mockResolvedValue(null);
      const response = await heartbeatPost(post("/api/devices/heartbeat", { appVersion: "0.2.0" }));
      expect(response.status).toBe(401);
      expect(mocks.listPendingCommands).not.toHaveBeenCalled();
    });

    it("still succeeds when commands cannot be loaded", async () => {
      mocks.recordDeviceHeartbeat.mockResolvedValue({ status: "ACTIVE", serverTime: "t" });
      mocks.listPendingCommands.mockRejectedValue(new Error("db"));
      const response = await heartbeatPost(post("/api/devices/heartbeat", { appVersion: "0.2.0" }));
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({ commands: [], pollIntervalSeconds: 15 });
      expect(mocks.captureTechnicalException).toHaveBeenCalled();
    });

    it("does not deliver commands to a disabled device", async () => {
      mocks.recordDeviceHeartbeat.mockRejectedValue(new DeviceError("DEVICE_DISABLED"));
      const response = await heartbeatPost(post("/api/devices/heartbeat", { appVersion: "0.2.0" }));
      expect(response.status).toBe(403);
      expect(mocks.listPendingCommands).not.toHaveBeenCalled();
    });
  });

  describe("command status", () => {
    it("requires a device token", async () => {
      mocks.authenticateDevice.mockResolvedValue(null);
      const response = await statusPost(post("/api/devices/commands/cmd_1/status", { status: "PLAYING" }), { params: Promise.resolve({ commandId: "cmd_1" }) });
      expect(response.status).toBe(401);
      expect(mocks.reportCommandStatus).not.toHaveBeenCalled();
    });

    it("forwards the report for the authenticated device", async () => {
      mocks.reportCommandStatus.mockResolvedValue({ status: "PLAYING" });
      const response = await statusPost(post("/api/devices/commands/cmd_1/status", { status: "PLAYING" }), { params: Promise.resolve({ commandId: "cmd_1" }) });
      expect(response.status).toBe(200);
      expect(mocks.reportCommandStatus).toHaveBeenCalledWith(device, "cmd_1", { status: "PLAYING" });
    });

    it.each([
      ["COMMAND_CANCELLED", 409],
      ["COMMAND_EXPIRED", 409],
      ["COMMAND_NOT_FOUND", 404],
      ["INVALID_COMMAND_TRANSITION", 409],
    ] as const)("maps %s to %i", async (code, status) => {
      mocks.reportCommandStatus.mockRejectedValue(new DeviceError(code));
      const response = await statusPost(post("/api/devices/commands/cmd_1/status", { status: "PLAYING" }), { params: Promise.resolve({ commandId: "cmd_1" }) });
      expect(response.status).toBe(status);
      await expect(response.json()).resolves.toEqual({ error: code });
    });
  });

  describe("download URL", () => {
    it("requires a device token", async () => {
      mocks.authenticateDevice.mockResolvedValue(null);
      const response = await downloadPost(post("/api/devices/videos/video_1/download-url"), { params: Promise.resolve({ videoId: "video_1" }) });
      expect(response.status).toBe(401);
      expect(mocks.createVideoDownload).not.toHaveBeenCalled();
    });

    it("returns only the signed URL and file facts, without caching", async () => {
      const previousKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key-must-not-leak";
      try {
        mocks.createVideoDownload.mockResolvedValue({ url: "https://signed", expiresInSeconds: 900, sizeBytes: "10", sha256: null });
        const response = await downloadPost(post("/api/devices/videos/video_1/download-url"), { params: Promise.resolve({ videoId: "video_1" }) });
        expect(response.status).toBe(200);
        expect(response.headers.get("cache-control")).toBe("no-store");
        expect(mocks.createVideoDownload).toHaveBeenCalledWith(device, "video_1");
        const text = await response.text();
        expect(Object.keys(JSON.parse(text)).sort()).toEqual(["expiresInSeconds", "sha256", "sizeBytes", "url"]);
        expect(text).not.toContain("service-role-key-must-not-leak");
      } finally {
        if (previousKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
        else process.env.SUPABASE_SERVICE_ROLE_KEY = previousKey;
      }
    });

    it("answers 403 for a video that was not sent to this device", async () => {
      mocks.createVideoDownload.mockRejectedValue(new DeviceError("DOWNLOAD_NOT_AUTHORIZED"));
      const response = await downloadPost(post("/api/devices/videos/video_2/download-url"), { params: Promise.resolve({ videoId: "video_2" }) });
      expect(response.status).toBe(403);
    });

    it("answers 503 when Storage is unavailable", async () => {
      mocks.createVideoDownload.mockRejectedValue(new VideoError("STORAGE_UNAVAILABLE"));
      const response = await downloadPost(post("/api/devices/videos/video_1/download-url"), { params: Promise.resolve({ videoId: "video_1" }) });
      expect(response.status).toBe(503);
    });
  });
});

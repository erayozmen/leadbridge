import { VideoStatus } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const tx = {
    video: { create: vi.fn(), findUnique: vi.fn(), updateMany: vi.fn() },
  };
  return {
    tx,
    requireAdmin: vi.fn(),
    writeAuditLog: vi.fn(async () => ({ id: "audit_1", createdAt: new Date() })),
    transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    findUnique: vi.fn(),
    createSignedVideoUpload: vi.fn(),
    getStoredVideoObject: vi.fn(),
    readStoredVideoHead: vi.fn(),
    removeStoredVideo: vi.fn(),
  };
});

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: mocks.transaction, video: { findUnique: mocks.findUnique } } }));
vi.mock("@/features/auth/server/auth", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/features/audit/services/write-audit-log", () => ({ writeAuditLog: mocks.writeAuditLog }));
vi.mock("@/features/videos/services/video-storage", () => ({
  createSignedVideoUpload: mocks.createSignedVideoUpload,
  getStoredVideoObject: mocks.getStoredVideoObject,
  readStoredVideoHead: mocks.readStoredVideoHead,
  removeStoredVideo: mocks.removeStoredVideo,
}));

import { VIDEO_MAX_UPLOAD_BYTES, VIDEO_UPLOAD_CHUNK_BYTES } from "@/features/videos/lib/video-policy";
import { archiveVideo, completeVideoUpload, createVideoUpload, failVideoUpload } from "@/features/videos/services/video-service";

const { tx } = mocks;
const FOUR_GB = 4 * 1024 ** 3;
const ftypHead = new Uint8Array([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d]);
const upload = (overrides: Record<string, unknown> = {}) => ({
  id: "video_1",
  status: VideoStatus.UPLOADING,
  storagePath: "3f2a/Mekke.mp4",
  sizeBytes: BigInt(FOUR_GB),
  mimeType: "video/mp4",
  uploadedByUserId: "admin_1",
  ...overrides,
});
const SHA = "a".repeat(64);

describe("video service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({ id: "admin_1" });
    tx.video.create.mockResolvedValue({ id: "video_1" });
    tx.video.updateMany.mockResolvedValue({ count: 1 });
    mocks.createSignedVideoUpload.mockResolvedValue({ endpoint: "https://x.supabase.co/storage/v1/upload/resumable/sign", token: "signed-token" });
    mocks.findUnique.mockResolvedValue(upload());
    mocks.getStoredVideoObject.mockResolvedValue({ sizeBytes: FOUR_GB, contentType: "video/mp4" });
    mocks.readStoredVideoHead.mockResolvedValue(ftypHead);
  });

  describe("createVideoUpload", () => {
    it("creates an UPLOADING record for a large file and returns a signed resumable session", async () => {
      const session = await createVideoUpload({ filename: "C:\\fakepath\\Mekke Turu.mp4", sizeBytes: FOUR_GB });

      const data = tx.video.create.mock.calls[0][0].data;
      expect(data).toMatchObject({
        displayName: "Mekke Turu",
        originalFilename: "Mekke Turu.mp4",
        sizeBytes: BigInt(FOUR_GB),
        mimeType: "video/mp4",
        status: VideoStatus.UPLOADING,
        uploadedByUserId: "admin_1",
      });
      expect(data.storagePath).toMatch(/^[0-9a-f-]{36}\/Mekke-Turu\.mp4$/);
      expect(mocks.createSignedVideoUpload).toHaveBeenCalledWith(data.storagePath);
      expect(session).toEqual({
        videoId: "video_1",
        upload: {
          endpoint: "https://x.supabase.co/storage/v1/upload/resumable/sign",
          token: "signed-token",
          bucket: "videos",
          objectName: data.storagePath,
          contentType: "video/mp4",
          chunkSize: VIDEO_UPLOAD_CHUNK_BYTES,
        },
      });
      expect(mocks.writeAuditLog).toHaveBeenCalledWith(tx, expect.objectContaining({ action: "VIDEO_UPLOAD_CREATED", entityType: "VIDEO" }));
      expect(JSON.stringify(mocks.writeAuditLog.mock.calls)).not.toContain("signed-token");
    });

    it("gives identical filenames distinct storage paths", async () => {
      await createVideoUpload({ filename: "Mekke.mp4", sizeBytes: 10 });
      await createVideoUpload({ filename: "Mekke.mp4", sizeBytes: 10 });
      const [first, second] = tx.video.create.mock.calls.map(([call]) => call.data.storagePath);
      expect(first).not.toBe(second);
      expect(first.endsWith("/Mekke.mp4") && second.endsWith("/Mekke.mp4")).toBe(true);
    });

    it("keeps traversal attempts inside one path segment", async () => {
      await createVideoUpload({ filename: "../../../other-bucket/evil.mp4", sizeBytes: 10 });
      const { storagePath } = tx.video.create.mock.calls[0][0].data;
      expect(storagePath.split("/")).toHaveLength(2);
      expect(storagePath).not.toContain("..");
    });

    it.each([
      ["unsupported extension", { filename: "film.mkv", sizeBytes: 10 }, "UNSUPPORTED_FORMAT"],
      ["executable disguised by name", { filename: "video.mp4.exe", sizeBytes: 10 }, "UNSUPPORTED_FORMAT"],
    ])("rejects an %s", async (_label, input, code) => {
      await expect(createVideoUpload(input)).rejects.toThrow(code);
      expect(mocks.transaction).not.toHaveBeenCalled();
    });

    it.each([
      ["empty file", { filename: "a.mp4", sizeBytes: 0 }],
      ["oversized file", { filename: "a.mp4", sizeBytes: VIDEO_MAX_UPLOAD_BYTES + 1 }],
      ["unknown fields", { filename: "a.mp4", sizeBytes: 10, storagePath: "x/y.mp4" }],
    ])("rejects an %s before authorization", async (_label, input) => {
      await expect(createVideoUpload(input)).rejects.toThrow();
      expect(mocks.requireAdmin).not.toHaveBeenCalled();
    });

    it("refuses non-admin users", async () => {
      mocks.requireAdmin.mockRejectedValue(new Error("FORBIDDEN"));
      await expect(createVideoUpload({ filename: "a.mp4", sizeBytes: 10 })).rejects.toThrow("FORBIDDEN");
      expect(mocks.transaction).not.toHaveBeenCalled();
      expect(mocks.createSignedVideoUpload).not.toHaveBeenCalled();
    });

    it("marks the record FAILED when Storage cannot issue an upload session", async () => {
      mocks.createSignedVideoUpload.mockRejectedValue(new Error("STORAGE_UNAVAILABLE"));
      await expect(createVideoUpload({ filename: "a.mp4", sizeBytes: 10 })).rejects.toThrow("STORAGE_UNAVAILABLE");
      expect(tx.video.updateMany).toHaveBeenCalledWith({ where: { id: "video_1", status: VideoStatus.UPLOADING }, data: { status: VideoStatus.FAILED } });
      expect(mocks.writeAuditLog).toHaveBeenCalledWith(tx, expect.objectContaining({ action: "VIDEO_UPLOAD_FAILED", metadata: { reason: "UPLOAD_ERROR" } }));
    });
  });

  describe("completeVideoUpload", () => {
    it("marks a verified upload READY with its checksum", async () => {
      await expect(completeVideoUpload({ videoId: "video_1", sha256: SHA })).resolves.toEqual({ status: "READY", videoId: "video_1" });
      expect(tx.video.updateMany).toHaveBeenCalledWith({
        where: { id: "video_1", status: VideoStatus.UPLOADING },
        data: { status: VideoStatus.READY, sha256: SHA },
      });
      expect(mocks.writeAuditLog).toHaveBeenCalledWith(tx, expect.objectContaining({ action: "VIDEO_UPLOAD_COMPLETED" }));
      expect(mocks.removeStoredVideo).not.toHaveBeenCalled();
    });

    it.each([
      ["OBJECT_MISSING", () => mocks.getStoredVideoObject.mockResolvedValue(null)],
      ["SIZE_MISMATCH", () => mocks.getStoredVideoObject.mockResolvedValue({ sizeBytes: FOUR_GB - 1, contentType: "video/mp4" })],
      ["INVALID_CONTENT", () => mocks.readStoredVideoHead.mockResolvedValue(new TextEncoder().encode("MZ\x90\x00 executable"))],
    ])("marks the upload FAILED on %s", async (reason, arrange) => {
      arrange();
      await expect(completeVideoUpload({ videoId: "video_1" })).resolves.toEqual({ status: "FAILED", videoId: "video_1", reason });
      expect(tx.video.updateMany).toHaveBeenCalledWith({ where: { id: "video_1", status: VideoStatus.UPLOADING }, data: { status: VideoStatus.FAILED } });
      expect(mocks.writeAuditLog).toHaveBeenCalledWith(tx, expect.objectContaining({ action: "VIDEO_UPLOAD_FAILED", metadata: { reason } }));
      if (reason === "OBJECT_MISSING") expect(mocks.removeStoredVideo).not.toHaveBeenCalled();
      else expect(mocks.removeStoredVideo).toHaveBeenCalledWith("3f2a/Mekke.mp4");
    });

    it("does not trust the declared MIME type alone", async () => {
      mocks.getStoredVideoObject.mockResolvedValue({ sizeBytes: FOUR_GB, contentType: "video/mp4" });
      mocks.readStoredVideoHead.mockResolvedValue(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0, 0, 0, 0]));
      await expect(completeVideoUpload({ videoId: "video_1" })).resolves.toMatchObject({ status: "FAILED", reason: "INVALID_CONTENT" });
    });

    it("only lets the uploading admin complete an UPLOADING video", async () => {
      mocks.findUnique.mockResolvedValue(upload({ uploadedByUserId: "admin_2" }));
      await expect(completeVideoUpload({ videoId: "video_1" })).rejects.toThrow("VIDEO_NOT_FOUND");
      mocks.findUnique.mockResolvedValue(upload({ status: VideoStatus.READY }));
      await expect(completeVideoUpload({ videoId: "video_1" })).rejects.toThrow("VIDEO_STATE_CONFLICT");
      expect(mocks.getStoredVideoObject).not.toHaveBeenCalled();
    });

    it("rejects a malformed checksum", async () => {
      await expect(completeVideoUpload({ videoId: "video_1", sha256: "not-a-hash" })).rejects.toThrow();
    });
  });

  it("records client-side upload failures", async () => {
    await failVideoUpload({ videoId: "video_1", reason: "CANCELLED" });
    expect(mocks.writeAuditLog).toHaveBeenCalledWith(tx, expect.objectContaining({ action: "VIDEO_UPLOAD_FAILED", metadata: { reason: "CANCELLED" } }));
  });

  describe("archiveVideo", () => {
    it("archives without deleting the stored file", async () => {
      tx.video.findUnique.mockResolvedValue({ status: VideoStatus.READY, displayName: "Mekke" });
      await archiveVideo({ videoId: "video_1" });
      expect(tx.video.updateMany).toHaveBeenCalledWith({ where: { id: "video_1", status: VideoStatus.READY }, data: { status: VideoStatus.ARCHIVED } });
      expect(mocks.removeStoredVideo).not.toHaveBeenCalled();
      expect(mocks.writeAuditLog).toHaveBeenCalledWith(tx, expect.objectContaining({
        action: "VIDEO_ARCHIVED",
        beforeData: { status: VideoStatus.READY, displayName: "Mekke" },
        afterData: { status: VideoStatus.ARCHIVED },
      }));
    });

    it("rejects archiving twice or an unknown video", async () => {
      tx.video.findUnique.mockResolvedValue({ status: VideoStatus.ARCHIVED, displayName: "Mekke" });
      await expect(archiveVideo({ videoId: "video_1" })).rejects.toThrow("VIDEO_STATE_CONFLICT");
      tx.video.findUnique.mockResolvedValue(null);
      await expect(archiveVideo({ videoId: "video_x" })).rejects.toThrow("VIDEO_NOT_FOUND");
    });

    it("refuses non-admin users", async () => {
      mocks.requireAdmin.mockRejectedValue(new Error("FORBIDDEN"));
      await expect(archiveVideo({ videoId: "video_1" })).rejects.toThrow("FORBIDDEN");
      expect(mocks.transaction).not.toHaveBeenCalled();
    });
  });
});

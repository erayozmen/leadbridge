import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  guardMutation: vi.fn(),
  createVideoUpload: vi.fn(),
  completeVideoUpload: vi.fn(),
  failVideoUpload: vi.fn(),
  archiveVideo: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/features/auth/server/auth", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/lib/security/request-guard", () => ({ guardMutation: mocks.guardMutation }));
vi.mock("@/features/videos/services/video-service", () => ({
  createVideoUpload: mocks.createVideoUpload,
  completeVideoUpload: mocks.completeVideoUpload,
  failVideoUpload: mocks.failVideoUpload,
  archiveVideo: mocks.archiveVideo,
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import {
  archiveVideoAction,
  completeVideoUploadAction,
  createVideoUploadAction,
  failVideoUploadAction,
} from "@/features/videos/actions/video-actions";
import { VideoError } from "@/features/videos/services/video-errors";

const archiveForm = () => {
  const data = new FormData();
  data.set("videoId", "video_1");
  return data;
};

describe("video actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({ id: "admin_1" });
    mocks.guardMutation.mockResolvedValue(true);
  });

  it("rejects non-admin users from every video mutation", async () => {
    mocks.requireAdmin.mockRejectedValue(new Error("forbidden"));
    const results = await Promise.all([
      createVideoUploadAction({ filename: "a.mp4", sizeBytes: 10 }),
      completeVideoUploadAction({ videoId: "video_1" }),
      failVideoUploadAction({ videoId: "video_1", reason: "CANCELLED" }),
      archiveVideoAction({ status: "idle", message: null }, archiveForm()),
    ]);
    expect(results.every((result) => ("ok" in result ? result.ok === false : result.status === "error"))).toBe(true);
    for (const service of [mocks.createVideoUpload, mocks.completeVideoUpload, mocks.failVideoUpload, mocks.archiveVideo]) {
      expect(service).not.toHaveBeenCalled();
    }
  });

  it("applies the shared request guard", async () => {
    mocks.guardMutation.mockResolvedValue(false);
    expect(await createVideoUploadAction({ filename: "a.mp4", sizeBytes: 10 })).toMatchObject({ ok: false });
    expect(mocks.guardMutation).toHaveBeenCalledWith("video-upload-create", expect.any(Object));
    expect(mocks.createVideoUpload).not.toHaveBeenCalled();
  });

  it("maps invalid files to a clear message", async () => {
    mocks.createVideoUpload.mockRejectedValue(new VideoError("UNSUPPORTED_FORMAT"));
    expect(await createVideoUploadAction({ filename: "a.mkv", sizeBytes: 10 })).toEqual({
      ok: false,
      message: "Yalnızca MP4, M4V veya MOV video dosyaları yüklenebilir.",
    });
  });

  it("reports rejected content after verification", async () => {
    mocks.completeVideoUpload.mockResolvedValue({ status: "FAILED", videoId: "video_1", reason: "INVALID_CONTENT" });
    const result = await completeVideoUploadAction({ videoId: "video_1" });
    expect(result).toMatchObject({ ok: false });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard/videos");
  });

  it("archives and refreshes the library", async () => {
    expect(await archiveVideoAction({ status: "idle", message: null }, archiveForm())).toEqual({ status: "success", message: "Video arşivlendi." });
    expect(mocks.archiveVideo).toHaveBeenCalledWith({ videoId: "video_1" });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard/videos");
  });
});

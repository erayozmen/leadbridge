import { createHash, randomBytes } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  encodeUploadMetadata,
  UploadAbortedError,
  UploadFailedError,
  uploadResumable,
  type ResumableUploadTarget,
} from "@/features/videos/lib/resumable-upload";

type Scripted = { status: number; storeBytes?: boolean };

/** Minimal in-memory TUS server behind a fake XMLHttpRequest. */
class FakeTusServer {
  stored: number[] = [];
  requests: Array<{ method: string; headers: Record<string, string> }> = [];
  patchScript: Scripted[] = [];
  createStatus = 201;

  static install(server: FakeTusServer) {
    class FakeXhr {
      upload: { onprogress: ((event: { loaded: number }) => void) | null } = { onprogress: null };
      status = 0;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      onabort: (() => void) | null = null;
      private method = "";
      private headers: Record<string, string> = {};
      private responseHeaders: Record<string, string> = {};
      open(method: string) { this.method = method; }
      setRequestHeader(name: string, value: string) { this.headers[name] = value; }
      getResponseHeader(name: string) { return this.responseHeaders[name] ?? null; }
      abort() { this.onabort?.(); }
      async send(body: Blob | null) {
        server.requests.push({ method: this.method, headers: { ...this.headers } });
        const bytes = body ? new Uint8Array(await body.arrayBuffer()) : null;
        await Promise.resolve();
        if (this.method === "POST") {
          this.status = server.createStatus;
          this.responseHeaders = { Location: "/storage/v1/upload/resumable/sign/upload-1" };
        } else if (this.method === "PATCH") {
          const step = server.patchScript.shift() ?? { status: 204, storeBytes: true };
          if (step.storeBytes !== false && bytes) server.stored.push(...bytes);
          this.upload.onprogress?.({ loaded: bytes?.length ?? 0 });
          if (step.status === 0) return this.onerror?.();
          this.status = step.status;
          this.responseHeaders = { "Upload-Offset": String(server.stored.length) };
        } else if (this.method === "HEAD") {
          this.status = 200;
          this.responseHeaders = { "Upload-Offset": String(server.stored.length) };
        }
        this.onload?.();
      }
    }
    vi.stubGlobal("XMLHttpRequest", FakeXhr);
  }
}

const target: ResumableUploadTarget = {
  endpoint: "https://project.supabase.co/storage/v1/upload/resumable/sign",
  token: "signed-token",
  bucket: "videos",
  objectName: "0f7c/Mekke.mp4",
  contentType: "video/mp4",
  chunkSize: 64 * 1024,
};

const fileOf = (bytes: Uint8Array) => new Blob([bytes as BlobPart]);
const sha = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

describe("uploadResumable", () => {
  let server: FakeTusServer;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout"] });
    server = new FakeTusServer();
    FakeTusServer.install(server);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("encodes TUS metadata as base64 values", () => {
    expect(encodeUploadMetadata({ objectName: "a/Çay.mp4" })).toBe(`objectName ${Buffer.from("a/Çay.mp4").toString("base64")}`);
  });

  it("uploads in chunks with the signed token and returns the SHA-256 of the stored bytes", async () => {
    const data = new Uint8Array(randomBytes(200_000));
    const progress = vi.fn();
    const result = await uploadResumable(fileOf(data), target, { onProgress: progress });

    expect(Buffer.from(server.stored).equals(Buffer.from(data))).toBe(true);
    expect(result.sha256).toBe(sha(data));
    const create = server.requests[0];
    expect(create.method).toBe("POST");
    expect(create.headers["x-signature"]).toBe("signed-token");
    expect(create.headers["x-upsert"]).toBe("false");
    expect(create.headers["Upload-Length"]).toBe("200000");
    expect(server.requests.filter((request) => request.method === "PATCH")).toHaveLength(4);
    expect(progress).toHaveBeenLastCalledWith(200_000, 200_000);
  });

  it("resumes from the server offset when a chunk response is lost", async () => {
    const data = new Uint8Array(randomBytes(150_000));
    // Second chunk reaches the server but the connection drops before the response.
    server.patchScript = [{ status: 204 }, { status: 0, storeBytes: true }];
    const pending = uploadResumable(fileOf(data), target);
    await vi.runAllTimersAsync();
    const result = await pending;

    expect(Buffer.from(server.stored).equals(Buffer.from(data))).toBe(true);
    expect(result.sha256).toBe(sha(data));
    expect(server.requests.some((request) => request.method === "HEAD")).toBe(true);
  });

  it("retries a chunk the server did not store", async () => {
    const data = new Uint8Array(randomBytes(100_000));
    server.patchScript = [{ status: 503, storeBytes: false }];
    const pending = uploadResumable(fileOf(data), target);
    await vi.runAllTimersAsync();
    await expect(pending).resolves.toEqual({ sha256: sha(data) });
    expect(Buffer.from(server.stored).equals(Buffer.from(data))).toBe(true);
  });

  it("fails fast on non-retryable errors", async () => {
    server.patchScript = [{ status: 403, storeBytes: false }];
    await expect(uploadResumable(fileOf(new Uint8Array(10)), target)).rejects.toBeInstanceOf(UploadFailedError);
  });

  it("fails when the upload cannot be created", async () => {
    server.createStatus = 400;
    await expect(uploadResumable(fileOf(new Uint8Array(10)), target)).rejects.toThrow("UPLOAD_FAILED_400");
  });

  it("gives up after the retry budget", async () => {
    server.patchScript = Array.from({ length: 10 }, () => ({ status: 500, storeBytes: false }));
    const pending = uploadResumable(fileOf(new Uint8Array(10)), target, { maxRetries: 2 });
    const assertion = expect(pending).rejects.toBeInstanceOf(UploadFailedError);
    await vi.runAllTimersAsync();
    await assertion;
  });

  it("stops when aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(uploadResumable(fileOf(new Uint8Array(10)), target, { signal: controller.signal })).rejects.toBeInstanceOf(UploadAbortedError);
  });
});

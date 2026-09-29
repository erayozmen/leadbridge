import { describe, expect, it } from "vitest";

import {
  displayNameFromFilename,
  formatBytes,
  isIsoBaseMediaFile,
  resolveVideoFormat,
  sanitizeVideoFilename,
} from "@/features/videos/lib/video-file";
import { VIDEO_FORMATS, VIDEO_MAX_UPLOAD_BYTES } from "@/features/videos/lib/video-policy";

const mp4 = VIDEO_FORMATS[0];
const box = (type: string) => new Uint8Array([0, 0, 0, 24, ...Array.from(type, (c) => c.charCodeAt(0)), 0x69, 0x73, 0x6f, 0x6d]);

describe("video file helpers", () => {
  it("allows large VR files", () => {
    expect(VIDEO_MAX_UPLOAD_BYTES).toBeGreaterThanOrEqual(10 * 1024 ** 3);
  });

  it("resolves formats from the extension only", () => {
    expect(resolveVideoFormat("Mekke.MP4")?.mimeType).toBe("video/mp4");
    expect(resolveVideoFormat("tur.mov")?.mimeType).toBe("video/quicktime");
    expect(resolveVideoFormat("film.mkv")).toBeNull();
    expect(resolveVideoFormat("video.mp4.exe")).toBeNull();
    expect(resolveVideoFormat("mp4")).toBeNull();
  });

  it.each([
    ["../../etc/passwd.mp4", "passwd.mp4"],
    ["..\\..\\windows\\system32.mp4", "system32.mp4"],
    ["C:\\Users\\Admin\\Videos\\Mekke Turu 4K.mp4", "Mekke-Turu-4K.mp4"],
    ["Şırnak Çağlayan Öğrenci Ünite İzmir.mp4", "Sirnak-Caglayan-Ogrenci-Unite-Izmir.mp4"],
    [".hidden.mp4", "hidden.mp4"],
    ["....mp4", "video.mp4"],
    ["<img src=x onerror=alert(1)>.mp4", "img-src-x-onerror-alert-1.mp4"],
  ])("sanitizes %s into a single safe path segment", (input, expected) => {
    const safe = sanitizeVideoFilename(input, mp4);
    expect(safe).toBe(expected);
    expect(safe).not.toMatch(/[\\/]|\.\./);
    expect(safe).toMatch(/^[A-Za-z0-9_-]+\.mp4$/);
  });

  it("caps very long names", () => {
    expect(sanitizeVideoFilename(`${"a".repeat(500)}.mp4`, mp4).length).toBeLessThanOrEqual(84);
  });

  it("derives a display name from the original filename", () => {
    expect(displayNameFromFilename("C:\\Videos\\Mekke Turu.mp4")).toBe("Mekke Turu");
    expect(displayNameFromFilename(".mp4")).toBe(".mp4");
  });

  it("recognizes ISO base media containers and rejects other content", () => {
    expect(isIsoBaseMediaFile(box("ftyp"))).toBe(true);
    expect(isIsoBaseMediaFile(box("moov"))).toBe(true);
    expect(isIsoBaseMediaFile(new TextEncoder().encode("MZ\x90\x00 not a video"))).toBe(false);
    expect(isIsoBaseMediaFile(new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0, 0, 0, 0]))).toBe(false);
    expect(isIsoBaseMediaFile(new Uint8Array(4))).toBe(false);
  });

  it("formats sizes", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(20 * 1024 ** 3)).toBe("20,0 GB");
  });
});

import { createHash, randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";

import { Sha256 } from "@/features/videos/lib/sha256-stream";

const reference = (data: Uint8Array) => createHash("sha256").update(data).digest("hex");

describe("incremental SHA-256", () => {
  it.each([
    ["empty", ""],
    ["abc", "abc"],
    ["two blocks", "abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq"],
  ])("matches the standard test vector: %s", (_label, text) => {
    const data = new TextEncoder().encode(text);
    expect(new Sha256().update(data).digestHex()).toBe(reference(data));
  });

  it("gives the same digest regardless of how the input is split", () => {
    const data = new Uint8Array(randomBytes(1_000_003));
    for (const chunkSize of [1, 63, 64, 65, 4096, 6 * 1024 * 1024]) {
      const hasher = new Sha256();
      for (let offset = 0; offset < data.length; offset += chunkSize) hasher.update(data.subarray(offset, offset + chunkSize));
      expect(hasher.digestHex()).toBe(reference(data));
    }
  });

  it("covers every padding boundary", () => {
    for (let length = 50; length <= 130; length += 1) {
      const data = new Uint8Array(randomBytes(length));
      expect(new Sha256().update(data).digestHex()).toBe(reference(data));
    }
  });

  it("cannot be reused after finalizing", () => {
    const hasher = new Sha256();
    hasher.digestHex();
    expect(() => hasher.update(new Uint8Array(1))).toThrow();
  });
});

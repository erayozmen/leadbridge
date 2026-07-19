import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import { hashQrToken } from "@/features/qr-registration/lib/hash-qr-token";

describe("hashQrToken", () => {
  it("produces deterministic SHA-256 hex for the same input", () => {
    const token = "leadbridge-test-token-001";
    const expected = createHash("sha256").update(token, "utf8").digest("hex");

    expect(hashQrToken(token)).toBe(expected);
    expect(hashQrToken(token)).toBe(expected);
    expect(hashQrToken(token)).toMatch(/^[a-f0-9]{64}$/);
  });

  it("produces different hashes for different tokens", () => {
    expect(hashQrToken("leadbridge-test-token-001")).not.toBe(
      hashQrToken("leadbridge-test-token-002"),
    );
  });
});

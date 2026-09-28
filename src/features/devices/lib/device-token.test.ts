import { describe, expect, it } from "vitest";

import {
  generateDeviceAccessToken,
  generatePairingCode,
  hashDeviceToken,
  normalizePairingCode,
  parseDeviceBearerToken,
} from "@/features/devices/lib/device-token";

describe("device tokens", () => {
  it("generates unique 256-bit base64url access tokens", () => {
    const token = generateDeviceAccessToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(generateDeviceAccessToken()).not.toBe(token);
  });

  it("generates grouped pairing codes that normalize back to 12 characters", () => {
    const code = generatePairingCode();
    expect(code).toMatch(/^[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/);
    expect(normalizePairingCode(code)).toBe(code.replaceAll("-", ""));
  });

  it("normalizes user-entered pairing codes and rejects malformed ones", () => {
    expect(normalizePairingCode(" abcd-efgh-jkmn ")).toBe("ABCDEFGHJKMN");
    expect(normalizePairingCode("ABCD-EFGH-IJKL")).toBeNull();
    expect(normalizePairingCode("ABCD")).toBeNull();
  });

  it("hashes tokens as SHA-256 hex without keeping the raw value", () => {
    const hash = hashDeviceToken("secret-token");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain("secret-token");
    expect(hashDeviceToken("secret-token")).toBe(hash);
  });

  it("accepts only well-formed bearer access tokens", () => {
    const token = generateDeviceAccessToken();
    expect(parseDeviceBearerToken(`Bearer ${token}`)).toBe(token);
    expect(parseDeviceBearerToken(`bearer ${token}`)).toBe(token);
    expect(parseDeviceBearerToken(token)).toBeNull();
    expect(parseDeviceBearerToken("Bearer short")).toBeNull();
    expect(parseDeviceBearerToken(null)).toBeNull();
  });
});

import { DeviceStatus, DeviceTokenKind } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { findUnique } = vi.hoisted(() => ({ findUnique: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: { deviceToken: { findUnique } } }));

import { generateDeviceAccessToken, hashDeviceToken } from "@/features/devices/lib/device-token";
import { authenticateDevice } from "@/features/devices/server/authenticate-device";

const now = new Date("2026-09-28T12:00:00.000Z");
const token = generateDeviceAccessToken();
const record = {
  id: "token_1",
  kind: DeviceTokenKind.ACCESS,
  revokedAt: null,
  expiresAt: null,
  device: { id: "device_1", status: DeviceStatus.ACTIVE, appVersion: "0.1.0" },
};

describe("authenticateDevice", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findUnique.mockResolvedValue(record);
  });

  it("looks up the token by hash and returns the device", async () => {
    await expect(authenticateDevice(`Bearer ${token}`, now)).resolves.toEqual({
      deviceId: "device_1",
      tokenId: "token_1",
      status: DeviceStatus.ACTIVE,
      appVersion: "0.1.0",
    });
    expect(findUnique.mock.calls[0][0].where).toEqual({ tokenHash: hashDeviceToken(token) });
  });

  it("rejects missing or malformed headers without querying", async () => {
    await expect(authenticateDevice(null, now)).resolves.toBeNull();
    await expect(authenticateDevice("Bearer nope", now)).resolves.toBeNull();
    expect(findUnique).not.toHaveBeenCalled();
  });

  it.each([
    ["unknown", null],
    ["revoked", { ...record, revokedAt: now }],
    ["expired", { ...record, expiresAt: now }],
    ["pairing", { ...record, kind: DeviceTokenKind.PAIRING }],
  ])("rejects a %s token", async (_label, value) => {
    findUnique.mockResolvedValue(value);
    await expect(authenticateDevice(`Bearer ${token}`, now)).resolves.toBeNull();
  });
});

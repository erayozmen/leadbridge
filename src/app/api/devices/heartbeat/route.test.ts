import { DeviceStatus } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { authenticateDevice, transaction } = vi.hoisted(() => ({
  authenticateDevice: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/features/devices/server/authenticate-device", () => ({ authenticateDevice }));
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: transaction } }));
vi.mock("@/lib/monitoring/capture", () => ({ captureTechnicalException: vi.fn() }));

import { clearRateLimitsForTests } from "@/lib/security/rate-limit";
import { POST } from "@/app/api/devices/heartbeat/route";

const request = () =>
  new Request("https://www.leadbridges.com.tr/api/devices/heartbeat", {
    method: "POST",
    headers: { authorization: "Bearer token", "content-type": "application/json" },
    body: JSON.stringify({ appVersion: "0.1.0" }),
  });

describe("POST /api/devices/heartbeat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearRateLimitsForTests();
  });

  it("answers 403 for a disabled device without touching the database", async () => {
    authenticateDevice.mockResolvedValue({ deviceId: "device_1", tokenId: "token_1", status: DeviceStatus.DISABLED, appVersion: "0.1.0" });
    const response = await POST(request());
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "DEVICE_DISABLED" });
    expect(transaction).not.toHaveBeenCalled();
  });

  it("answers 401 when the token is unknown or revoked", async () => {
    authenticateDevice.mockResolvedValue(null);
    const response = await POST(request());
    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
});

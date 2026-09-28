import { beforeEach, describe, expect, it, vi } from "vitest";
import { ZodError } from "zod";

const mocks = vi.hoisted(() => ({
  requireStaffOrAdmin: vi.fn(),
  createDevicePairing: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/features/auth/server/auth", () => ({ requireStaffOrAdmin: mocks.requireStaffOrAdmin }));
vi.mock("@/features/devices/services/create-device-pairing", () => ({ createDevicePairing: mocks.createDevicePairing }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import { createDevicePairingAction } from "@/features/devices/actions/device-actions";

const initial = { status: "idle" as const, message: null };
const form = (name: string) => {
  const data = new FormData();
  data.set("name", name);
  return data;
};

describe("createDevicePairingAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireStaffOrAdmin.mockResolvedValue({ id: "staff_1" });
  });

  it("rejects users who are not staff or admin", async () => {
    mocks.requireStaffOrAdmin.mockRejectedValue(new Error("forbidden"));
    const result = await createDevicePairingAction(initial, form("Quest 3 #1"));
    expect(result.status).toBe("error");
    expect(mocks.createDevicePairing).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("returns the pairing code once and refreshes the device list", async () => {
    const expiresAt = new Date("2026-09-28T12:15:00.000Z");
    mocks.createDevicePairing.mockResolvedValue({ deviceId: "device_1", pairingCode: "ABCD-EFGH-JKMN", expiresAt });
    const result = await createDevicePairingAction(initial, form("Quest 3 #1"));
    expect(mocks.createDevicePairing).toHaveBeenCalledWith({ name: "Quest 3 #1" });
    expect(result).toEqual({
      status: "success",
      message: "Eşleştirme kodu oluşturuldu.",
      pairing: { deviceId: "device_1", pairingCode: "ABCD-EFGH-JKMN", expiresAt: expiresAt.toISOString() },
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard/devices");
  });

  it("maps validation and unexpected failures to user-facing errors", async () => {
    mocks.createDevicePairing.mockRejectedValueOnce(new ZodError([]));
    expect((await createDevicePairingAction(initial, form("Q"))).message).toContain("2 ile 80");
    mocks.createDevicePairing.mockRejectedValueOnce(new Error("db down"));
    const result = await createDevicePairingAction(initial, form("Quest"));
    expect(result).toEqual({ status: "error", message: "Eşleştirme kodu oluşturulamadı. Lütfen tekrar deneyin." });
  });
});

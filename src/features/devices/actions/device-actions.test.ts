import { beforeEach, describe, expect, it, vi } from "vitest";
import { ZodError } from "zod";

const mocks = vi.hoisted(() => ({
  requireStaffOrAdmin: vi.fn(),
  requireAdmin: vi.fn(),
  guardMutation: vi.fn(),
  createDevicePairing: vi.fn(),
  renewDevicePairing: vi.fn(),
  cancelDevicePairing: vi.fn(),
  disableDevice: vi.fn(),
  sendPlayVideoCommand: vi.fn(),
  sendStopCommand: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/features/auth/server/auth", () => ({ requireStaffOrAdmin: mocks.requireStaffOrAdmin, requireAdmin: mocks.requireAdmin }));
vi.mock("@/lib/security/request-guard", () => ({ guardMutation: mocks.guardMutation }));
vi.mock("@/features/devices/services/create-device-pairing", () => ({ createDevicePairing: mocks.createDevicePairing }));
vi.mock("@/features/devices/services/manage-device", () => ({
  renewDevicePairing: mocks.renewDevicePairing,
  cancelDevicePairing: mocks.cancelDevicePairing,
  disableDevice: mocks.disableDevice,
}));
vi.mock("@/features/devices/services/device-commands", () => ({
  sendPlayVideoCommand: mocks.sendPlayVideoCommand,
  sendStopCommand: mocks.sendStopCommand,
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import {
  cancelDevicePairingAction,
  createDevicePairingAction,
  disableDeviceAction,
  renewDevicePairingAction,
  sendPlayVideoAction,
  sendStopAction,
} from "@/features/devices/actions/device-actions";
import { DeviceError } from "@/features/devices/services/device-errors";

const initial = { status: "idle" as const, message: null };
const form = (entries: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.set(key, value);
  return data;
};
const expiresAt = new Date("2026-09-28T18:00:00.000Z");

describe("device actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireStaffOrAdmin.mockResolvedValue({ id: "staff_1" });
    mocks.requireAdmin.mockResolvedValue({ id: "admin_1" });
    mocks.guardMutation.mockResolvedValue(true);
  });

  it("rejects users who are not staff or admin from every device mutation", async () => {
    mocks.requireStaffOrAdmin.mockRejectedValue(new Error("forbidden"));
    const results = await Promise.all([
      createDevicePairingAction(initial, form({ name: "Quest 3 #1" })),
      renewDevicePairingAction(initial, form({ deviceId: "device_1" })),
      cancelDevicePairingAction(initial, form({ deviceId: "device_1" })),
      disableDeviceAction(initial, form({ deviceId: "device_1" })),
    ]);
    expect(results.every((result) => result.status === "error")).toBe(true);
    for (const service of [mocks.createDevicePairing, mocks.renewDevicePairing, mocks.cancelDevicePairing, mocks.disableDevice]) {
      expect(service).not.toHaveBeenCalled();
    }
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("applies the shared request guard to device mutations", async () => {
    mocks.guardMutation.mockResolvedValue(false);
    const result = await disableDeviceAction(initial, form({ deviceId: "device_1" }));
    expect(result.status).toBe("error");
    expect(mocks.guardMutation).toHaveBeenCalledWith("device-disable", expect.any(Object));
    expect(mocks.disableDevice).not.toHaveBeenCalled();
  });

  it("returns a new pairing code once and refreshes the device list", async () => {
    mocks.createDevicePairing.mockResolvedValue({ deviceId: "device_1", pairingCode: "ABCD-EFGH-JKMN", expiresAt });
    const result = await createDevicePairingAction(initial, form({ name: "Quest 3 #1" }));
    expect(mocks.createDevicePairing).toHaveBeenCalledWith({ name: "Quest 3 #1" });
    expect(result).toEqual({
      status: "success",
      message: "Eşleştirme kodu oluşturuldu.",
      pairing: { deviceId: "device_1", pairingCode: "ABCD-EFGH-JKMN", expiresAt: expiresAt.toISOString() },
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard/devices");
  });

  it("points duplicate names to the renew flow", async () => {
    mocks.createDevicePairing.mockRejectedValue(new DeviceError("DEVICE_NAME_IN_USE"));
    const result = await createDevicePairingAction(initial, form({ name: "Quest 3 #1" }));
    expect(result.status).toBe("error");
    expect(result.message).toContain("Kodu Yenile");
  });

  it("renews the code of an existing device", async () => {
    mocks.renewDevicePairing.mockResolvedValue({ deviceId: "device_1", pairingCode: "WXYZ-2345-6789", expiresAt });
    const result = await renewDevicePairingAction(initial, form({ deviceId: "device_1" }));
    expect(mocks.renewDevicePairing).toHaveBeenCalledWith({ deviceId: "device_1" });
    expect(result.pairing).toEqual({ deviceId: "device_1", pairingCode: "WXYZ-2345-6789", expiresAt: expiresAt.toISOString() });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard/devices");
  });

  it("cancels pending pairings and disables active devices", async () => {
    mocks.cancelDevicePairing.mockResolvedValue({ deviceId: "device_1" });
    mocks.disableDevice.mockResolvedValue({ deviceId: "device_2" });
    expect((await cancelDevicePairingAction(initial, form({ deviceId: "device_1" }))).status).toBe("success");
    expect((await disableDeviceAction(initial, form({ deviceId: "device_2" }))).status).toBe("success");
    expect(mocks.cancelDevicePairing).toHaveBeenCalledWith({ deviceId: "device_1" });
    expect(mocks.disableDevice).toHaveBeenCalledWith({ deviceId: "device_2" });
  });

  it("maps validation, state and unexpected failures to user-facing errors", async () => {
    mocks.createDevicePairing.mockRejectedValueOnce(new ZodError([]));
    expect((await createDevicePairingAction(initial, form({ name: "Q" }))).message).toContain("2 ile 80");
    mocks.renewDevicePairing.mockRejectedValueOnce(new DeviceError("DEVICE_STATE_CONFLICT"));
    expect((await renewDevicePairingAction(initial, form({ deviceId: "device_1" }))).message).toContain("durumu değişmiş");
    mocks.disableDevice.mockRejectedValueOnce(new Error("db down"));
    expect(await disableDeviceAction(initial, form({ deviceId: "device_1" }))).toEqual({
      status: "error",
      message: "Cihaz kaldırılamadı. Lütfen tekrar deneyin.",
    });
  });

  it("sends play and stop commands for admins only", async () => {
    mocks.sendPlayVideoCommand.mockResolvedValue({ commandId: "cmd_1" });
    mocks.sendStopCommand.mockResolvedValue({ commandId: "cmd_2" });
    expect((await sendPlayVideoAction(initial, form({ deviceId: "device_1", videoId: "video_1" }))).status).toBe("success");
    expect(mocks.sendPlayVideoCommand).toHaveBeenCalledWith({ deviceId: "device_1", videoId: "video_1" });
    expect((await sendStopAction(initial, form({ deviceId: "device_1" }))).status).toBe("success");
    expect(mocks.sendStopCommand).toHaveBeenCalledWith({ deviceId: "device_1" });

    vi.clearAllMocks();
    // Staff may manage pairing but not send library videos.
    mocks.requireStaffOrAdmin.mockResolvedValue({ id: "staff_1" });
    mocks.requireAdmin.mockRejectedValue(new Error("forbidden"));
    mocks.guardMutation.mockResolvedValue(true);
    const denied = await sendPlayVideoAction(initial, form({ deviceId: "device_1", videoId: "video_1" }));
    expect(denied).toEqual({ status: "error", message: "Bu işlem yalnızca yönetici tarafından yapılabilir." });
    expect((await sendStopAction(initial, form({ deviceId: "device_1" }))).status).toBe("error");
    expect(mocks.sendPlayVideoCommand).not.toHaveBeenCalled();
    expect(mocks.sendStopCommand).not.toHaveBeenCalled();
  });

  it("requires a video selection and explains unavailable videos", async () => {
    expect((await sendPlayVideoAction(initial, form({ deviceId: "device_1" }))).message).toBe("Önce bir video seçin.");
    mocks.sendPlayVideoCommand.mockRejectedValueOnce(new DeviceError("VIDEO_NOT_AVAILABLE"));
    expect((await sendPlayVideoAction(initial, form({ deviceId: "device_1", videoId: "video_1" }))).message).toContain("artık kullanılamıyor");
    mocks.sendPlayVideoCommand.mockRejectedValueOnce(new DeviceError("DEVICE_OFFLINE"));
    expect((await sendPlayVideoAction(initial, form({ deviceId: "device_1", videoId: "video_1" }))).message).toContain("çevrimdışı");
  });
});

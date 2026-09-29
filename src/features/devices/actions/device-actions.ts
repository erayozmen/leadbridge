"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";

import { requireStaffOrAdmin } from "@/features/auth/server/auth";
import { createDevicePairing } from "@/features/devices/services/create-device-pairing";
import { DeviceError } from "@/features/devices/services/device-errors";
import {
  cancelDevicePairing,
  disableDevice,
  renewDevicePairing,
} from "@/features/devices/services/manage-device";
import { guardMutation } from "@/lib/security/request-guard";

export type DevicePairingActionState = {
  status: "idle" | "success" | "error";
  message: string | null;
  pairing?: { deviceId: string; pairingCode: string; expiresAt: string };
};

const DEVICES_PATH = "/dashboard/devices";
const MUTATION_LIMIT = { limit: 20, windowMs: 60_000 };

const text = (data: FormData, key: string) => {
  const value = data.get(key);
  return typeof value === "string" ? value : "";
};

const errorState = (message: string): DevicePairingActionState => ({ status: "error", message });

/** Shared authorization and abuse protection for every device mutation. */
async function authorize(scope: string): Promise<DevicePairingActionState | null> {
  try {
    await requireStaffOrAdmin();
  } catch {
    return errorState("Bu işlem yalnızca yönetici veya personel tarafından yapılabilir.");
  }
  if (!await guardMutation(scope, MUTATION_LIMIT)) {
    return errorState("Çok fazla işlem yapıldı. Lütfen kısa süre sonra tekrar deneyin.");
  }
  return null;
}

function failure(error: unknown, fallback: string, invalidInput = "Geçersiz istek. Sayfayı yenileyip tekrar deneyin."): DevicePairingActionState {
  if (error instanceof ZodError) return errorState(invalidInput);
  if (error instanceof DeviceError) {
    switch (error.code) {
      case "DEVICE_NAME_IN_USE":
        return errorState("Bu adla bekleyen veya aktif bir cihaz zaten var. Yeni kod için listede o cihazın satırındaki \"Kodu Yenile\" işlemini kullanın.");
      case "DEVICE_NOT_FOUND":
        return errorState("Cihaz bulunamadı. Sayfayı yenileyip tekrar deneyin.");
      case "DEVICE_STATE_CONFLICT":
        return errorState("Cihazın durumu değişmiş. Sayfayı yenileyip tekrar deneyin.");
      default:
        break;
    }
  }
  return errorState(fallback);
}

const pairingState = (
  message: string,
  result: { deviceId: string; pairingCode: string; expiresAt: Date },
): DevicePairingActionState => ({
  status: "success",
  message,
  pairing: { deviceId: result.deviceId, pairingCode: result.pairingCode, expiresAt: result.expiresAt.toISOString() },
});

export async function createDevicePairingAction(
  _state: DevicePairingActionState,
  data: FormData,
): Promise<DevicePairingActionState> {
  const denied = await authorize("device-pairing-create");
  if (denied) return denied;
  try {
    const result = await createDevicePairing({ name: text(data, "name") });
    revalidatePath(DEVICES_PATH);
    return pairingState("Eşleştirme kodu oluşturuldu.", result);
  } catch (error) {
    return failure(error, "Eşleştirme kodu oluşturulamadı. Lütfen tekrar deneyin.", "Cihaz adı 2 ile 80 karakter arasında olmalıdır.");
  }
}

export async function renewDevicePairingAction(
  _state: DevicePairingActionState,
  data: FormData,
): Promise<DevicePairingActionState> {
  const denied = await authorize("device-pairing-renew");
  if (denied) return denied;
  try {
    const result = await renewDevicePairing({ deviceId: text(data, "deviceId") });
    revalidatePath(DEVICES_PATH);
    return pairingState("Yeni eşleştirme kodu oluşturuldu; önceki kod artık geçersiz.", result);
  } catch (error) {
    return failure(error, "Kod yenilenemedi. Lütfen tekrar deneyin.");
  }
}

export async function cancelDevicePairingAction(
  _state: DevicePairingActionState,
  data: FormData,
): Promise<DevicePairingActionState> {
  const denied = await authorize("device-pairing-cancel");
  if (denied) return denied;
  try {
    await cancelDevicePairing({ deviceId: text(data, "deviceId") });
    revalidatePath(DEVICES_PATH);
    return { status: "success", message: "Eşleşme iptal edildi." };
  } catch (error) {
    return failure(error, "Eşleşme iptal edilemedi. Lütfen tekrar deneyin.");
  }
}

export async function disableDeviceAction(
  _state: DevicePairingActionState,
  data: FormData,
): Promise<DevicePairingActionState> {
  const denied = await authorize("device-disable");
  if (denied) return denied;
  try {
    await disableDevice({ deviceId: text(data, "deviceId") });
    revalidatePath(DEVICES_PATH);
    return { status: "success", message: "Cihaz kaldırıldı; erişimi iptal edildi." };
  } catch (error) {
    return failure(error, "Cihaz kaldırılamadı. Lütfen tekrar deneyin.");
  }
}

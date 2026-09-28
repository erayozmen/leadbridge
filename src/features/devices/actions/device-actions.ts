"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";

import { requireStaffOrAdmin } from "@/features/auth/server/auth";
import { createDevicePairing } from "@/features/devices/services/create-device-pairing";

export type DevicePairingActionState = {
  status: "idle" | "success" | "error";
  message: string | null;
  pairing?: { deviceId: string; pairingCode: string; expiresAt: string };
};

const text = (data: FormData, key: string) => {
  const value = data.get(key);
  return typeof value === "string" ? value : "";
};

export async function createDevicePairingAction(
  _state: DevicePairingActionState,
  data: FormData,
): Promise<DevicePairingActionState> {
  try {
    await requireStaffOrAdmin();
  } catch {
    return { status: "error", message: "Bu işlem yalnızca yönetici veya personel tarafından yapılabilir." };
  }

  try {
    const result = await createDevicePairing({ name: text(data, "name") });
    revalidatePath("/dashboard/devices");
    return {
      status: "success",
      message: "Eşleştirme kodu oluşturuldu.",
      pairing: {
        deviceId: result.deviceId,
        pairingCode: result.pairingCode,
        expiresAt: result.expiresAt.toISOString(),
      },
    };
  } catch (error) {
    if (error instanceof ZodError) {
      return { status: "error", message: "Cihaz adı 2 ile 80 karakter arasında olmalıdır." };
    }
    return { status: "error", message: "Eşleştirme kodu oluşturulamadı. Lütfen tekrar deneyin." };
  }
}

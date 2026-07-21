"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/features/auth/server/auth";
import { disableQrCode } from "@/features/qr-codes/services/disable-qr-code";
import { generateQrCodes } from "@/features/qr-codes/services/generate-qr-codes";
import { archiveAllDisabledQrCodes, archiveQrCode } from "@/features/qr-codes/services/archive-qr-codes";

export type GenerateQrCodesActionState = {
  status: "idle" | "success" | "error";
  message: string | null;
  fieldError?: string;
  csv?: string;
  fileName?: string;
  rows?: Array<{ serialNumber: string; registrationUrl: string }>;
};

async function authorizeAdmin(): Promise<GenerateQrCodesActionState | null> {
  try {
    await requireAdmin();
    return null;
  } catch {
    return {
      status: "error",
      message: "Bu işlem yalnızca yöneticiler tarafından yapılabilir.",
    };
  }
}

export async function generateQrCodesAction(
  _state: GenerateQrCodesActionState,
  formData: FormData,
): Promise<GenerateQrCodesActionState> {
  const authFailure = await authorizeAdmin();
  if (authFailure) return authFailure;

  const result = await generateQrCodes({ quantity: formData.get("quantity") });
  if (!result.ok) {
    return { status: "error", message: result.message, fieldError: result.fieldErrors?.quantity?.[0] };
  }
  revalidatePath("/dashboard/qr-codes");
  return {
    status: "success",
    message: `${result.count} QR kartı üretildi (${result.firstSerialNumber} – ${result.lastSerialNumber}).`,
    csv: result.csv,
    fileName: `leadbridge-${result.firstSerialNumber}-${result.lastSerialNumber}.csv`,
    rows: result.rows,
  };
}

export type DisableQrCodeActionState = { status: "idle" | "success" | "error"; message: string | null };

export async function disableQrCodeAction(
  _state: DisableQrCodeActionState,
  formData: FormData,
): Promise<DisableQrCodeActionState> {
  const authFailure = await authorizeAdmin();
  if (authFailure) return authFailure;

  const id = formData.get("id");
  const result = await disableQrCode(typeof id === "string" ? id : "");
  if (!result.ok) return { status: "error", message: result.message };
  revalidatePath("/dashboard/qr-codes");
  return { status: "success", message: result.message };
}

export type ArchiveQrCodeActionState = { status: "idle" | "success" | "error"; message: string | null };

export async function archiveQrCodeAction(
  _state: ArchiveQrCodeActionState,
  formData: FormData,
): Promise<ArchiveQrCodeActionState> {
  const authFailure = await authorizeAdmin();
  if (authFailure) return authFailure;

  const id = formData.get("id");
  const result = await archiveQrCode(typeof id === "string" ? id : "");
  if (!result.ok) return { status: "error", message: result.message };
  revalidatePath("/dashboard/qr-codes");
  return { status: "success", message: result.message };
}

export async function archiveAllDisabledQrCodesAction(
  _state: ArchiveQrCodeActionState,
): Promise<ArchiveQrCodeActionState> {
  void _state;
  const authFailure = await authorizeAdmin();
  if (authFailure) return authFailure;

  const result = await archiveAllDisabledQrCodes();
  if (!result.ok) return { status: "error", message: result.message };
  revalidatePath("/dashboard/qr-codes");
  return { status: "success", message: result.message };
}

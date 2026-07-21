"use server";

import { createQrRegistration } from "@/features/qr-registration/services/create-qr-registration";
import type { QrRegistrationFieldErrors } from "@/features/qr-registration/types/qr-registration-result";
import { guardMutation } from "@/lib/security/request-guard";

export type PublicQrRegistrationState = {
  status: "idle" | "success" | "error";
  message: string | null;
  fieldErrors?: Omit<QrRegistrationFieldErrors, "token">;
};

function textField(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

export async function publicQrRegistrationAction(
  _state: PublicQrRegistrationState,
  formData: FormData,
): Promise<PublicQrRegistrationState> {
  if (!await guardMutation("public-registration", { limit: 8, windowMs: 60_000 })) return { status: "error", message: "Çok fazla deneme yapıldı. Lütfen kısa süre sonra tekrar deneyin." };
  const result = await createQrRegistration({
    token: textField(formData, "token"),
    firstName: textField(formData, "firstName"),
    lastName: textField(formData, "lastName"),
    guardianName: textField(formData, "guardianName"),
    phone: textField(formData, "phone"),
    schoolId: textField(formData, "schoolId"),
  });

  if (result.ok) {
    return { status: "success", message: "Kaydınız başarıyla alınmıştır." };
  }

  const messages: Record<typeof result.code, string> = {
    INVALID_INPUT: "Lütfen form alanlarını kontrol edin.",
    QR_NOT_FOUND: "Bu kayıt bağlantısı geçerli değil.",
    QR_NOT_ASSIGNED: "Bu QR kart henüz kullanıma açılmamış.",
    QR_ALREADY_USED: "Bu QR kartla daha önce kayıt yapılmış.",
    QR_DISABLED: "Bu QR kart kullanıma kapatılmış.",
    QR_REGISTRATION_CONFLICT: "Bu QR kartla daha önce kayıt yapılmış.",
    SCHOOL_NOT_FOUND: "Seçilen okul bulunamadı. Lütfen başka bir okul seçin.",
    SCHOOL_INACTIVE: "Seçilen okul şu anda kayıt için kullanılamıyor.",
    INTERNAL_ERROR: "İşlem şu anda tamamlanamadı. Lütfen daha sonra tekrar deneyin.",
  };

  return {
    status: "error",
    message: messages[result.code],
    fieldErrors: result.fieldErrors,
  };
}

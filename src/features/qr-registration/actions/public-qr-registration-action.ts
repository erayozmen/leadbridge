"use server";

import { createQrRegistration } from "@/features/qr-registration/services/create-qr-registration";
import type { QrRegistrationFieldErrors } from "@/features/qr-registration/types/qr-registration-result";
import { guardPublicQrMutation } from "@/lib/security/public-qr-guard";
import { TURNSTILE_RESPONSE_FIELD } from "@/lib/security/public-qr-policy";

export type PublicQrRegistrationState = {
  status: "idle" | "success" | "error";
  message: string | null;
  fieldErrors?: Omit<QrRegistrationFieldErrors, "token">;
  values?: PublicQrRegistrationValues;
};

export type PublicQrRegistrationValues = { firstName: string; lastName: string; guardianName: string; phone: string; schoolId: string };

function textField(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

export async function publicQrRegistrationAction(
  _state: PublicQrRegistrationState,
  formData: FormData,
): Promise<PublicQrRegistrationState> {
  const values: PublicQrRegistrationValues = { firstName: textField(formData, "firstName"), lastName: textField(formData, "lastName"), guardianName: textField(formData, "guardianName"), phone: textField(formData, "phone"), schoolId: textField(formData, "schoolId") };
  const guard = await guardPublicQrMutation(textField(formData, TURNSTILE_RESPONSE_FIELD));
  if (!guard.allowed) return { status: "error", message: guard.reason === "RATE_LIMIT" ? "Çok fazla deneme yapıldı. Lütfen kısa süre sonra tekrar deneyin." : "Güvenlik doğrulaması tamamlanamadı. Lütfen tekrar deneyin.", values };
  const result = await createQrRegistration({
    token: textField(formData, "token"),
    ...values,
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
    values,
  };
}

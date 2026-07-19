import { CircleAlert } from "lucide-react";

import type { PublicQrStatus } from "@/features/qr-registration/queries/get-public-qr-status";

const messages: Record<Exclude<PublicQrStatus, "AVAILABLE">, string> = {
  NOT_FOUND: "Bu kayıt bağlantısı geçerli değil.",
  INVALID_TOKEN: "Bu kayıt bağlantısı geçerli değil.",
  NOT_ASSIGNED: "Bu QR kart henüz kullanıma açılmamış.",
  ALREADY_USED: "Bu QR kartla daha önce kayıt yapılmış.",
  DISABLED: "Bu QR kart kullanıma kapatılmış.",
  INTERNAL_ERROR: "İşlem şu anda tamamlanamadı. Lütfen daha sonra tekrar deneyin.",
};

export function QrRegistrationStatus({ status }: { status: Exclude<PublicQrStatus, "AVAILABLE"> }) {
  return (
    <div className="py-8 text-center" role="status">
      <span className="mx-auto grid size-12 place-items-center rounded-full bg-muted text-muted-foreground"><CircleAlert /></span>
      <h2 className="mt-5 text-xl font-semibold">Kayıt formu kullanılamıyor</h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{messages[status]}</p>
    </div>
  );
}

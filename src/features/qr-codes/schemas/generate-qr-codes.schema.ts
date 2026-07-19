import { z } from "zod";

export const generateQrCodesSchema = z.object({
  quantity: z.coerce
    .number()
    .int("Adet tam sayı olmalıdır.")
    .min(1, "En az 1 QR kartı üretilebilir.")
    .max(500, "Tek seferde en fazla 500 QR kartı üretilebilir."),
});

export type GenerateQrCodesInput = z.input<typeof generateQrCodesSchema>;

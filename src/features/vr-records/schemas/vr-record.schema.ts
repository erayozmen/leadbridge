import { z } from "zod";

const requiredText = (label: string, max: number) =>
  z
    .string()
    .trim()
    .min(1, `${label} zorunludur.`)
    .max(max, `${label} en fazla ${max} karakter olabilir.`);

const optionalPhone = z
  .string()
  .trim()
  .max(30, "Telefon en fazla 30 karakter olabilir.")
  .refine(
    (value) => value.length === 0 || /^[+\d][\d\s()+-]{6,29}$/.test(value),
    "Geçerli bir telefon numarası girin.",
  )
  .transform((value) => (value.length === 0 ? null : value));

export const vrRecordSchema = z.object({
  eventId: z.string().trim().max(200).optional(),
  firstName: requiredText("Ad", 80),
  lastName: requiredText("Soyad", 80),
  schoolId: requiredText("Okul", 100),
  phone: optionalPhone.optional().transform((value) => value ?? null),
});

export type VrRecordInput = z.input<typeof vrRecordSchema>;
export type VrRecordData = z.output<typeof vrRecordSchema>;

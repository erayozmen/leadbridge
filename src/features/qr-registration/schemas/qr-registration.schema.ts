import { z } from "zod";

const personNamePattern = /^[\p{L}\s.'-]+$/u;
const phonePattern = /^\+?[\d\s()-]{10,20}$/;

const trimmedText = (fieldName: string, maxLength: number) =>
  z
    .string()
    .trim()
    .min(1, `${fieldName} is required`)
    .max(maxLength, `${fieldName} must be at most ${maxLength} characters`);

const personName = (fieldName: string) =>
  trimmedText(fieldName, 80).regex(
    personNamePattern,
    `${fieldName} contains unsupported characters`,
  );

export const qrRegistrationSchema = z.object({
  token: trimmedText("Token", 256).min(16, "Token is invalid"),
  firstName: personName("First name"),
  lastName: personName("Last name"),
  guardianName: personName("Guardian name"),
  phone: trimmedText("Phone", 24)
    .regex(phonePattern, "Phone number is invalid")
    .refine((value) => value.replace(/\D/g, "").length >= 10, {
      message: "Phone number is invalid",
    }),
  schoolId: trimmedText("School", 100).regex(/^[A-Za-z0-9_-]+$/, "School is invalid"),
});

export type QrRegistrationInput = z.input<typeof qrRegistrationSchema>;
export type QrRegistrationData = z.output<typeof qrRegistrationSchema>;

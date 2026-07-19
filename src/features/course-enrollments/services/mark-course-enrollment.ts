import "server-only";

import { z } from "zod";
import { AuthError, type AppUser } from "@/features/auth/types/auth";
import type { CourseEnrollmentResult } from "@/features/course-enrollments/types/course-enrollment-result";

type RegistrationState = { id: string; enrolledCourse: boolean };
export type MarkCourseEnrollmentDependencies = {
  requireAdmin: () => Promise<AppUser>;
  findRegistration: (id: string) => Promise<RegistrationState | null>;
  updateIfNotEnrolled: (id: string, data: { enrolledCourse: true; enrolledAt: Date; enrolledByUserId: string }) => Promise<number>;
};
const failure = (code: Exclude<CourseEnrollmentResult, { ok: true }>["code"], message: string) => ({ ok: false as const, code, message });

async function defaults(): Promise<MarkCourseEnrollmentDependencies> {
  const [{ requireAdmin }, { prisma }] = await Promise.all([import("@/features/auth/server/auth"), import("@/lib/prisma")]);
  return {
    requireAdmin,
    findRegistration: (id) => prisma.qrRegistration.findUnique({ where: { id }, select: { id: true, enrolledCourse: true } }),
    async updateIfNotEnrolled(id, data) { return (await prisma.qrRegistration.updateMany({ where: { id, enrolledCourse: false }, data })).count; },
  };
}

export async function markCourseEnrollment(input: { qrRegistrationId: string }, dependencies?: MarkCourseEnrollmentDependencies): Promise<CourseEnrollmentResult> {
  const parsed = z.object({ qrRegistrationId: z.string().trim().min(1).max(100) }).safeParse(input);
  if (!parsed.success) return failure("INVALID_INPUT", "Geçerli bir öğrenci kaydı seçin.");
  const deps = dependencies ?? await defaults(); let admin: AppUser;
  try { admin = await deps.requireAdmin(); } catch (error) { return failure("UNAUTHORIZED", error instanceof AuthError ? "Bu işlem yalnızca yöneticiler tarafından yapılabilir." : "Yetkilendirme doğrulanamadı."); }
  try {
    const existing = await deps.findRegistration(parsed.data.qrRegistrationId);
    if (!existing) return failure("REGISTRATION_NOT_FOUND", "Öğrenci kaydı bulunamadı.");
    if (existing.enrolledCourse) return failure("ALREADY_ENROLLED", "Öğrenci daha önce dil kursuna kayıtlı olarak işaretlenmiş.");
    const enrolledAt = new Date();
    const count = await deps.updateIfNotEnrolled(existing.id, { enrolledCourse: true, enrolledAt, enrolledByUserId: admin.id });
    if (count === 1) return { ok: true, enrolledAt };
    const current = await deps.findRegistration(existing.id);
    if (!current) return failure("REGISTRATION_NOT_FOUND", "Öğrenci kaydı bulunamadı.");
    if (current.enrolledCourse) return failure("ALREADY_ENROLLED", "Öğrenci başka bir yönetici tarafından kayıtlı olarak işaretlenmiş.");
    return failure("ENROLLMENT_CONFLICT", "Kurs kayıt durumu başka bir işlem tarafından değiştirildi.");
  } catch { return failure("ENROLLMENT_FAILED", "Dil kursu kaydı işaretlenemedi. Lütfen tekrar deneyin."); }
}

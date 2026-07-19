import "server-only";

import { Prisma, SchoolStatus } from "@prisma/client";
import { z } from "zod";

import { AuthError } from "@/features/auth/types/auth";
import { cleanSchoolName, normalizeSchoolName } from "@/features/schools/lib/normalize-school-name";
import type { SchoolMutationDependencies, SchoolResult } from "@/features/schools/types/school-result";

const nameSchema = z.string().trim().min(2, "Okul adı en az 2 karakter olmalıdır.").max(160, "Okul adı en fazla 160 karakter olabilir.");
const idSchema = z.string().trim().min(1).max(100);
const fail = (code: Exclude<SchoolResult, { ok: true }>["code"], message: string, fieldErrors?: { name?: string[] }): SchoolResult => ({ ok: false, code, message, fieldErrors });

async function defaults(): Promise<SchoolMutationDependencies> {
  const [{ requireAdmin }, { prisma }] = await Promise.all([import("@/features/auth/server/auth"), import("@/lib/prisma")]);
  return {
    requireAdmin,
    create: (data) => prisma.school.create({ data, select: { id: true } }),
    update: async (id, data) => (await prisma.school.updateMany({ where: { id }, data })).count,
    setStatus: async (id, status) => (await prisma.school.updateMany({ where: { id }, data: { status } })).count,
  };
}

async function authorize(deps: SchoolMutationDependencies): Promise<SchoolResult | null> {
  try { await deps.requireAdmin(); return null; } catch (error) { return fail("UNAUTHORIZED", error instanceof AuthError ? "Bu işlem yalnızca yöneticiler tarafından yapılabilir." : "Yetkilendirme doğrulanamadı."); }
}
function duplicate(error: unknown) { return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"; }

export async function createSchool(input: { name: unknown }, dependencies?: SchoolMutationDependencies): Promise<SchoolResult> {
  const parsed = nameSchema.safeParse(input.name); if (!parsed.success) return fail("INVALID_INPUT", "Okul adını kontrol edin.", { name: parsed.error.issues.map(({ message }) => message) });
  const deps = dependencies ?? await defaults(); const denied = await authorize(deps); if (denied) return denied;
  const name = cleanSchoolName(parsed.data);
  try { await deps.create({ name, normalizedName: normalizeSchoolName(name) }); return { ok: true, message: "Okul oluşturuldu." }; }
  catch (error) { return duplicate(error) ? fail("SCHOOL_ALREADY_EXISTS", "Bu okul zaten kayıtlı.") : fail("CREATE_FAILED", "Okul oluşturulamadı."); }
}

export async function updateSchool(input: { id: unknown; name: unknown }, dependencies?: SchoolMutationDependencies): Promise<SchoolResult> {
  const id = idSchema.safeParse(input.id); const parsed = nameSchema.safeParse(input.name); if (!id.success || !parsed.success) return fail("INVALID_INPUT", "Okul bilgilerini kontrol edin.", parsed.success ? undefined : { name: parsed.error.issues.map(({ message }) => message) });
  const deps = dependencies ?? await defaults(); const denied = await authorize(deps); if (denied) return denied;
  const name = cleanSchoolName(parsed.data);
  try { const count = await deps.update(id.data, { name, normalizedName: normalizeSchoolName(name) }); return count === 1 ? { ok: true, message: "Okul güncellendi." } : fail("SCHOOL_NOT_FOUND", "Okul bulunamadı."); }
  catch (error) { return duplicate(error) ? fail("SCHOOL_ALREADY_EXISTS", "Bu okul zaten kayıtlı.") : fail("UPDATE_FAILED", "Okul güncellenemedi."); }
}

export async function setSchoolStatus(input: { id: unknown; status: unknown }, dependencies?: SchoolMutationDependencies): Promise<SchoolResult> {
  const id = idSchema.safeParse(input.id); const status = z.enum(SchoolStatus).safeParse(input.status); if (!id.success || !status.success) return fail("INVALID_INPUT", "Okul durumu geçersiz.");
  const deps = dependencies ?? await defaults(); const denied = await authorize(deps); if (denied) return denied;
  try { return await deps.setStatus(id.data, status.data) === 1 ? { ok: true, message: status.data === SchoolStatus.ACTIVE ? "Okul aktifleştirildi." : "Okul pasifleştirildi." } : fail("SCHOOL_NOT_FOUND", "Okul bulunamadı."); }
  catch { return fail("STATUS_FAILED", "Okul durumu güncellenemedi."); }
}

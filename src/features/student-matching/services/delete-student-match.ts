import "server-only";

import { z } from "zod";
import { AuthError } from "@/features/auth/types/auth";
import type { DeleteStudentMatchResult } from "@/features/student-matching/types/student-match-result";

export type DeleteStudentMatchDependencies = { requireAdmin: () => Promise<unknown>; deleteMatch: (id: string) => Promise<number> };
const failure = (code: Exclude<DeleteStudentMatchResult, { ok: true }>["code"], message: string) => ({ ok: false as const, code, message });

async function defaults(): Promise<DeleteStudentMatchDependencies> {
  const [{ requireAdmin }, { prisma }] = await Promise.all([import("@/features/auth/server/auth"), import("@/lib/prisma")]);
  return { requireAdmin, async deleteMatch(id) { return (await prisma.studentMatch.deleteMany({ where: { id } })).count; } };
}

export async function deleteStudentMatch(id: string, dependencies?: DeleteStudentMatchDependencies): Promise<DeleteStudentMatchResult> {
  if (!z.string().trim().min(1).max(100).safeParse(id).success) return failure("INVALID_INPUT", "Geçerli bir eşleşme seçin.");
  const deps = dependencies ?? (await defaults());
  try { await deps.requireAdmin(); } catch (error) {
    if (error instanceof AuthError) return failure("UNAUTHORIZED", "Bu işlem yalnızca yöneticiler tarafından yapılabilir.");
    return failure("UNAUTHORIZED", "Yetkilendirme doğrulanamadı.");
  }
  try {
    const count = await deps.deleteMatch(id);
    return count === 1 ? { ok: true, message: "Eşleşme kaldırıldı. Kayıtlar silinmedi." } : failure("MATCH_NOT_FOUND", "Eşleşme bulunamadı veya daha önce kaldırıldı.");
  } catch {
    return failure("UNMATCH_FAILED", "Eşleşme kaldırılamadı. Lütfen tekrar deneyin.");
  }
}

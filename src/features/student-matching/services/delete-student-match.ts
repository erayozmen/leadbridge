import "server-only";

import { z } from "zod";
import { AuthError } from "@/features/auth/types/auth";
import type { DeleteStudentMatchResult } from "@/features/student-matching/types/student-match-result";

type MatchState = { id: string; vrRecordId: string };

export type DeleteStudentMatchDependencies = {
  requireAdmin: () => Promise<unknown>;
  findMatch: (matchId: string) => Promise<MatchState | null>;
  deleteMatch: (matchId: string, vrRecordId: string) => Promise<number>;
};

const inputSchema = z.object({
  matchId: z.string().trim().min(1).max(100),
  vrRecordId: z.string().trim().min(1).max(100),
}).strict();

const failure = (
  code: Exclude<DeleteStudentMatchResult, { ok: true }>['code'],
  message: string,
) => ({ ok: false as const, code, message });

async function defaults(): Promise<DeleteStudentMatchDependencies> {
  const [{ requireAdmin }, { prisma }] = await Promise.all([
    import("@/features/auth/server/auth"),
    import("@/lib/prisma"),
  ]);

  return {
    requireAdmin,
    findMatch: (matchId) => prisma.studentMatch.findUnique({
      where: { id: matchId },
      select: { id: true, vrRecordId: true },
    }),
    async deleteMatch(matchId, vrRecordId) {
      return (await prisma.studentMatch.deleteMany({ where: { id: matchId, vrRecordId } })).count;
    },
  };
}

export async function deleteStudentMatch(
  input: unknown,
  dependencies?: DeleteStudentMatchDependencies,
): Promise<DeleteStudentMatchResult> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return failure("INVALID_INPUT", "Geçerli bir eşleşme seçin.");

  const deps = dependencies ?? (await defaults());
  try {
    await deps.requireAdmin();
  } catch (error) {
    if (error instanceof AuthError) {
      return failure("UNAUTHORIZED", "Bu işlem yalnızca yöneticiler tarafından yapılabilir.");
    }
    return failure("UNAUTHORIZED", "Yetkilendirme doğrulanamadı.");
  }

  try {
    const match = await deps.findMatch(parsed.data.matchId);
    if (!match || match.vrRecordId !== parsed.data.vrRecordId) {
      return failure("MATCH_NOT_FOUND", "Bu VR kaydına ait eşleşme bulunamadı.");
    }

    const count = await deps.deleteMatch(match.id, parsed.data.vrRecordId);
    if (count !== 1) {
      return failure("UNMATCH_CONFLICT", "Eşleşme başka bir işlem tarafından değiştirilmiş.");
    }

    return { ok: true, message: "Eşleşme kaldırıldı. Ana kayıtlar silinmedi." };
  } catch {
    return failure("UNMATCH_FAILED", "Eşleşme kaldırılamadı. Lütfen tekrar deneyin.");
  }
}

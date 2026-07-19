import "server-only";

import { Prisma } from "@prisma/client";
import { z } from "zod";

import { AuthError, type AppUser } from "@/features/auth/types/auth";
import type { CreateStudentMatchResult } from "@/features/student-matching/types/student-match-result";

const schema = z.object({ vrRecordId: z.string().trim().min(1).max(100), qrRegistrationId: z.string().trim().min(1).max(100) });
type Tx = {
  findVr: (id: string) => Promise<{ id: string; matched: boolean } | null>;
  findRegistration: (id: string) => Promise<{ id: string; matched: boolean } | null>;
  create: (data: { vrRecordId: string; qrRegistrationId: string; matchedByUserId: string; matchedAt: Date }) => Promise<{ id: string; matchedAt: Date }>;
};
export type CreateStudentMatchDependencies = {
  requireAdmin: () => Promise<AppUser>;
  runTransaction: <T>(callback: (tx: Tx) => Promise<T>) => Promise<T>;
};

class DomainError extends Error {
  constructor(readonly result: Exclude<CreateStudentMatchResult, { ok: true }>) { super(result.code); }
}
const failure = (code: Exclude<CreateStudentMatchResult, { ok: true }>["code"], message: string) => ({ ok: false as const, code, message });

async function defaults(): Promise<CreateStudentMatchDependencies> {
  const [{ requireAdmin }, { prisma }] = await Promise.all([import("@/features/auth/server/auth"), import("@/lib/prisma")]);
  return {
    requireAdmin,
    runTransaction: (callback) => prisma.$transaction((tx) => callback({
      async findVr(id) {
        const record = await tx.vrRecord.findUnique({ where: { id }, select: { id: true, studentMatch: { select: { id: true } } } });
        return record ? { id: record.id, matched: Boolean(record.studentMatch) } : null;
      },
      async findRegistration(id) {
        const record = await tx.qrRegistration.findUnique({ where: { id }, select: { id: true, studentMatch: { select: { id: true } } } });
        return record ? { id: record.id, matched: Boolean(record.studentMatch) } : null;
      },
      create: (data) => tx.studentMatch.create({ data, select: { id: true, matchedAt: true } }),
    })),
  };
}

export async function createStudentMatch(input: { vrRecordId: string; qrRegistrationId: string }, dependencies?: CreateStudentMatchDependencies): Promise<CreateStudentMatchResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return failure("INVALID_INPUT", "Geçerli kayıtlar seçin.");
  const deps = dependencies ?? (await defaults());
  let user: AppUser;
  try { user = await deps.requireAdmin(); } catch (error) {
    if (error instanceof AuthError) return failure("UNAUTHORIZED", "Bu işlem yalnızca yöneticiler tarafından yapılabilir.");
    return failure("UNAUTHORIZED", "Yetkilendirme doğrulanamadı.");
  }
  try {
    const match = await deps.runTransaction(async (tx) => {
      const vr = await tx.findVr(parsed.data.vrRecordId);
      if (!vr) throw new DomainError(failure("VR_RECORD_NOT_FOUND", "VR kaydı bulunamadı."));
      if (vr.matched) throw new DomainError(failure("VR_ALREADY_MATCHED", "VR kaydı zaten eşleştirilmiş."));
      const registration = await tx.findRegistration(parsed.data.qrRegistrationId);
      if (!registration) throw new DomainError(failure("QR_REGISTRATION_NOT_FOUND", "QR kaydı bulunamadı."));
      if (registration.matched) throw new DomainError(failure("QR_REGISTRATION_ALREADY_MATCHED", "QR kaydı zaten eşleştirilmiş."));
      return tx.create({ vrRecordId: vr.id, qrRegistrationId: registration.id, matchedByUserId: user.id, matchedAt: new Date() });
    });
    return { ok: true, match };
  } catch (error) {
    if (error instanceof DomainError) return error.result;
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return failure("MATCH_CONFLICT", "Kayıtlardan biri başka bir işlemde eşleştirildi.");
    return failure("MATCH_FAILED", "Eşleştirme tamamlanamadı. Lütfen tekrar deneyin.");
  }
}

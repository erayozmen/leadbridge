import "server-only";

import { z } from "zod";
import {
  LANGUAGE_SCHOOL_BATCH_LIMIT,
  type LanguageSchoolMatchStatus,
  type LanguageSchoolStudentInput,
} from "@/features/course-enrollments/integrations/language-school-contract";

export { LANGUAGE_SCHOOL_BATCH_LIMIT } from "@/features/course-enrollments/integrations/language-school-contract";
export type { LanguageSchoolStudentInput } from "@/features/course-enrollments/integrations/language-school-contract";
export type LanguageSchoolBatchResult =
  | { status: "SUCCESS"; results: Array<{ leadBridgeRegistrationId: string; matchStatus: LanguageSchoolMatchStatus }> }
  | { status: "INTEGRATION_UNAVAILABLE" | "INVALID_REQUEST" | "PROVIDER_ERROR"; results: [] };
export type ProviderBatchResponse = { results: Array<{ leadBridgeRegistrationId: string; matchStatus: LanguageSchoolMatchStatus }> };

export interface LanguageSchoolLookupProvider {
  lookupStudents(input: { students: LanguageSchoolStudentInput[] }): Promise<ProviderBatchResponse>;
}

const studentSchema = z.object({
  leadBridgeRegistrationId: z.string().trim().min(1).max(100), firstName: z.string().trim().min(1).max(80), lastName: z.string().trim().min(1).max(80),
  normalizedPhone: z.string().regex(/^\d{10,15}$/),
}).strict();
const batchSchema = z.object({ students: z.array(studentSchema).min(1).max(LANGUAGE_SCHOOL_BATCH_LIMIT) }).strict();

export function validateLanguageSchoolBatch(input: unknown): { ok: true; students: LanguageSchoolStudentInput[] } | { ok: false } {
  const parsed = batchSchema.safeParse(input); if (!parsed.success) return { ok: false };
  if (new Set(parsed.data.students.map(({ leadBridgeRegistrationId }) => leadBridgeRegistrationId)).size !== parsed.data.students.length) return { ok: false };
  return { ok: true, students: parsed.data.students };
}

export async function lookupLanguageSchoolStudents(
  input: unknown,
  dependencies?: { requireAdmin: () => Promise<unknown>; provider?: LanguageSchoolLookupProvider },
): Promise<LanguageSchoolBatchResult> {
  const validated = validateLanguageSchoolBatch(input); if (!validated.ok) return { status: "INVALID_REQUEST", results: [] };
  const resolved = dependencies ?? await (async () => { const { requireAdmin } = await import("@/features/auth/server/auth"); return { requireAdmin, provider: undefined }; })();
  try { await resolved.requireAdmin(); } catch { return { status: "INTEGRATION_UNAVAILABLE", results: [] }; }
  if (!resolved.provider) return { status: "INTEGRATION_UNAVAILABLE", results: [] };
  try {
    const response = await resolved.provider.lookupStudents({ students: validated.students });
    const allowedIds = new Set(validated.students.map(({ leadBridgeRegistrationId }) => leadBridgeRegistrationId));
    const safeById = new Map<string, LanguageSchoolMatchStatus>();
    for (const item of response.results) if (allowedIds.has(item.leadBridgeRegistrationId) && ["FOUND", "NOT_FOUND", "AMBIGUOUS", "ERROR"].includes(item.matchStatus)) safeById.set(item.leadBridgeRegistrationId, item.matchStatus);
    return { status: "SUCCESS", results: validated.students.map(({ leadBridgeRegistrationId }) => ({ leadBridgeRegistrationId, matchStatus: safeById.get(leadBridgeRegistrationId) ?? "ERROR" })) };
  } catch { return { status: "PROVIDER_ERROR", results: [] }; }
}

export async function lookupLanguageSchoolStudent(input: LanguageSchoolStudentInput, dependencies?: { requireAdmin: () => Promise<unknown>; provider?: LanguageSchoolLookupProvider }) {
  const result = await lookupLanguageSchoolStudents({ students: [input] }, dependencies);
  return result.status === "SUCCESS" ? { status: "SUCCESS" as const, result: result.results[0] } : { status: result.status, result: null };
}

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
  | { status: "INTEGRATION_UNAVAILABLE" | "INVALID_REQUEST" | "PROVIDER_ERROR" | "PROVIDER_TIMEOUT" | "RATE_LIMITED"; results: [] };
export type ProviderBatchResponse = { results: Array<{ leadBridgeRegistrationId: string; matchStatus: LanguageSchoolMatchStatus }> };

export interface LanguageSchoolLookupProvider {
  lookupStudents(input: { students: LanguageSchoolStudentInput[] }): Promise<ProviderBatchResponse>;
}

export class LanguageSchoolProviderError extends Error {
  constructor(readonly kind: "TIMEOUT" | "RATE_LIMIT" | "UNAVAILABLE" | "MALFORMED") { super(kind); this.name = "LanguageSchoolProviderError"; }
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([promise, new Promise<T>((_, reject) => { timeout = setTimeout(() => reject(new LanguageSchoolProviderError("TIMEOUT")), timeoutMs); })]);
  } finally { if (timeout) clearTimeout(timeout); }
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
  dependencies?: { requireAdmin: () => Promise<unknown>; provider?: LanguageSchoolLookupProvider; timeoutMs?: number; maxAttempts?: number },
): Promise<LanguageSchoolBatchResult> {
  const validated = validateLanguageSchoolBatch(input); if (!validated.ok) return { status: "INVALID_REQUEST", results: [] };
  const resolved = dependencies ?? await (async () => { const { requireAdmin } = await import("@/features/auth/server/auth"); return { requireAdmin, provider: undefined }; })();
  try { await resolved.requireAdmin(); } catch { return { status: "INTEGRATION_UNAVAILABLE", results: [] }; }
  if (!resolved.provider) return { status: "INTEGRATION_UNAVAILABLE", results: [] };
  try {
    let response: ProviderBatchResponse | undefined;
    const attempts = Math.min(Math.max(resolved.maxAttempts ?? 2, 1), 3);
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try { response = await withTimeout(resolved.provider.lookupStudents({ students: validated.students }), resolved.timeoutMs ?? 5_000); break; }
      catch (error) { if (error instanceof LanguageSchoolProviderError && error.kind === "RATE_LIMIT") throw error; if (attempt === attempts) throw error; }
    }
    if (!response || !Array.isArray(response.results)) throw new LanguageSchoolProviderError("MALFORMED");
    const allowedIds = new Set(validated.students.map(({ leadBridgeRegistrationId }) => leadBridgeRegistrationId));
    const safeById = new Map<string, LanguageSchoolMatchStatus>();
    for (const item of response.results) if (allowedIds.has(item.leadBridgeRegistrationId) && ["FOUND", "NOT_FOUND", "AMBIGUOUS", "ERROR"].includes(item.matchStatus)) safeById.set(item.leadBridgeRegistrationId, item.matchStatus);
    return { status: "SUCCESS", results: validated.students.map(({ leadBridgeRegistrationId }) => ({ leadBridgeRegistrationId, matchStatus: safeById.get(leadBridgeRegistrationId) ?? "ERROR" })) };
  } catch (error) {
    if (error instanceof LanguageSchoolProviderError && error.kind === "TIMEOUT") return { status: "PROVIDER_TIMEOUT", results: [] };
    if (error instanceof LanguageSchoolProviderError && error.kind === "RATE_LIMIT") return { status: "RATE_LIMITED", results: [] };
    return { status: "PROVIDER_ERROR", results: [] };
  }
}

export async function lookupLanguageSchoolStudent(input: LanguageSchoolStudentInput, dependencies?: { requireAdmin: () => Promise<unknown>; provider?: LanguageSchoolLookupProvider; timeoutMs?: number; maxAttempts?: number }) {
  const result = await lookupLanguageSchoolStudents({ students: [input] }, dependencies);
  return result.status === "SUCCESS" ? { status: "SUCCESS" as const, result: result.results[0] } : { status: result.status, result: null };
}

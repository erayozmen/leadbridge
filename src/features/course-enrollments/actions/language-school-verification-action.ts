"use server";
import { requireAdmin } from "@/features/auth/server/auth";
import type { LanguageSchoolBatchResult } from "@/features/course-enrollments/integrations/language-school-provider";
export async function verifyLanguageSchoolBatchAction(): Promise<LanguageSchoolBatchResult> {
  try { await requireAdmin(); } catch { return { status: "INTEGRATION_UNAVAILABLE", results: [] }; }
  return { status: "INTEGRATION_UNAVAILABLE", results: [] };
}

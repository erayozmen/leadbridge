import { describe, expect, it } from "vitest";
import {
  canViewLanguageSchoolVerification,
  languageSchoolIntegrationAvailable,
  languageSchoolResultLabels,
} from "@/features/course-enrollments/components/language-school-verification-panel";
describe("language school verification visibility", () => {
  it("is visible to ADMIN", () => expect(canViewLanguageSchoolVerification("ADMIN")).toBe(true));
  it("is hidden from STAFF", () => expect(canViewLanguageSchoolVerification("STAFF")).toBe(false));
  it("keeps integration controls disabled without a provider", () => expect(languageSchoolIntegrationAvailable).toBe(false));
  it("defines safe labels for every provider result", () => {
    expect(languageSchoolResultLabels).toEqual({
      FOUND: "Eşleşti",
      NOT_FOUND: "Eşleşmedi",
      AMBIGUOUS: "Belirsiz",
      ERROR: "Kontrol edilemedi",
    });
  });
});

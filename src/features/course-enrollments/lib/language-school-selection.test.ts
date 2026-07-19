import { describe, expect, it } from "vitest";
import {
  canRunLanguageSchoolLookup,
  getLanguageSchoolStudentEligibility,
  selectAllLanguageSchoolStudents,
  toggleLanguageSchoolSelection,
} from "@/features/course-enrollments/lib/language-school-selection";

const record = (overrides: Partial<{ id: string; firstName: string; lastName: string; phone: string }> = {}) => ({
  id: "registration-1",
  firstName: "Ayşe",
  lastName: "Yılmaz",
  phone: "+90 (532) 123 45 67",
  ...overrides,
});

describe("language school student selection", () => {
  it("allows students with the minimum provider fields", () => {
    expect(getLanguageSchoolStudentEligibility(record())).toEqual({
      eligible: true,
      student: {
        leadBridgeRegistrationId: "registration-1",
        firstName: "Ayşe",
        lastName: "Yılmaz",
        normalizedPhone: "905321234567",
      },
    });
  });

  it.each([
    ["missing id", { id: "" }],
    ["missing first name", { firstName: "" }],
    ["missing last name", { lastName: "" }],
    ["invalid phone", { phone: "123" }],
  ])("rejects a student with %s", (_label, overrides) => {
    expect(getLanguageSchoolStudentEligibility(record(overrides))).toMatchObject({ eligible: false });
  });

  it("selects and deselects one eligible student", () => {
    const selectable = new Set(["registration-1"]);
    const selected = toggleLanguageSchoolSelection(new Set(), "registration-1", selectable);
    expect([...selected.selectedIds]).toEqual(["registration-1"]);
    expect([...toggleLanguageSchoolSelection(selected.selectedIds, "registration-1", selectable).selectedIds]).toEqual([]);
  });

  it("does not select an ineligible student", () => {
    expect(toggleLanguageSchoolSelection(new Set(), "registration-1", new Set()).selectedIds.size).toBe(0);
  });

  it("selects all eligible students and clears through an empty selection", () => {
    const selected = selectAllLanguageSchoolStudents(["one", "two"]);
    expect([...selected.selectedIds]).toEqual(["one", "two"]);
    expect(new Set<string>().size).toBe(0);
  });

  it("caps select all at 100 and reports the limit", () => {
    const result = selectAllLanguageSchoolStudents(
      Array.from({ length: 101 }, (_, index) => `registration-${index}`),
    );
    expect(result.selectedIds.size).toBe(100);
    expect(result.limitReached).toBe(true);
  });

  it("does not add a 101st student", () => {
    const selected = new Set(Array.from({ length: 100 }, (_, index) => `registration-${index}`));
    const result = toggleLanguageSchoolSelection(selected, "registration-100", new Set(["registration-100"]));
    expect(result.selectedIds.size).toBe(100);
    expect(result.limitReached).toBe(true);
  });

  it("enables lookup only for 1 to 100 students with an available provider", () => {
    expect(canRunLanguageSchoolLookup(1, true)).toBe(true);
    expect(canRunLanguageSchoolLookup(100, true)).toBe(true);
    expect(canRunLanguageSchoolLookup(0, true)).toBe(false);
    expect(canRunLanguageSchoolLookup(101, true)).toBe(false);
    expect(canRunLanguageSchoolLookup(10, false)).toBe(false);
  });
});

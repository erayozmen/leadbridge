import { describe, expect, it } from "vitest";
import { buildSchoolBackfillEntries, cleanSchoolName, normalizeSchoolName, resolveSchoolDisplayName } from "@/features/schools/lib/normalize-school-name";

describe("school name normalization", () => {
  it("trims names", () => expect(cleanSchoolName("  Okul  ")).toBe("Okul"));
  it("collapses consecutive whitespace", () => expect(cleanSchoolName("A   B\n C")).toBe("A B C"));
  it("normalizes Turkish case safely", () => expect(normalizeSchoolName(" İSTANBUL IŞIK LİSESİ ")).toBe(normalizeSchoolName("istanbul ışık lisesi")));
  it("deduplicates backfill variants", () => expect(buildSchoolBackfillEntries([" Okul ", "OKUL", "okul"])).toHaveLength(1));
  it("ignores empty backfill values", () => expect(buildSchoolBackfillEntries(["", "   "])).toEqual([]));
  it("is idempotent for already normalized input", () => { const once = buildSchoolBackfillEntries(["A Okulu", "a okulu"]); expect(buildSchoolBackfillEntries(once.map(({ name }) => name))).toEqual(once); });
  it("prefers the relation school name", () => expect(resolveSchoolDisplayName({ name: "Merkezi Ad" }, "Eski Ad")).toBe("Merkezi Ad"));
  it("falls back to the legacy school name", () => expect(resolveSchoolDisplayName(null, "Eski Ad")).toBe("Eski Ad"));
});

import { describe, expect, it } from "vitest";
import { ACADEMY_LOOKUP_BATCH_SIZE, buildAcademyLookupBatches } from "./batch";

describe("Academy lookup batching", () => {
  it("honors the Academy request contract without losing candidates", () => {
    const candidates = Array.from({ length: 205 }, (_, index) => index);
    const batches = buildAcademyLookupBatches(candidates);
    expect(batches.map((batch) => batch.length)).toEqual([ACADEMY_LOOKUP_BATCH_SIZE, ACADEMY_LOOKUP_BATCH_SIZE, 5]);
    expect(batches.flat()).toEqual(candidates);
  });
  it("does not create empty batches", () => expect(buildAcademyLookupBatches([])).toEqual([]));
});

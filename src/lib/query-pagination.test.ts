import { describe, expect, it } from "vitest";
import { parsePageSize, parsePositivePage, parseSort } from "@/lib/query-pagination";

describe("query pagination", () => {
  it.each([0, -1, 1.5, "x", undefined])( "normalizes invalid page %s", value => expect(parsePositivePage(value)).toBe(1));
  it.each([25, 50, 100])( "accepts page size %s", value => expect(parsePageSize(value)).toBe(value));
  it.each([20, 500, "all", undefined])( "rejects page size %s", value => expect(parsePageSize(value)).toBe(25));
  it("allowlists sort values", () => expect(parseSort("unknown", ["newest", "oldest"] as const, "newest")).toBe("newest"));
});

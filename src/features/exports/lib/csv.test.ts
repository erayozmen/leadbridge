import { describe, expect, it } from "vitest";
import { buildCsv, safeCsvCell } from "@/features/exports/lib/csv";

describe("CSV güvenliği", () => {
  it("formula injection başlangıçlarını etkisizleştirir", () => expect(safeCsvCell("=1+1")).toBe("\"'=1+1\""));
  it("UTF-8 BOM ve Türkçe metin üretir", () => expect(buildCsv(["Okul"], [["Şişli"]])).toBe("\uFEFF\"Okul\"\r\n\"Şişli\""));
});

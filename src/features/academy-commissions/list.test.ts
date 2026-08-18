import { AcademyMatchStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { buildCommissionWhere, commissionFilterHref, commissionStatusWhere, parseCommissionFilter } from "./filters";
describe("commission filters", () => {
  it("defaults to matched", () => { expect(parseCommissionFilter()).toBe("matched"); expect(parseCommissionFilter("invalid")).toBe("matched"); });
  it("maps matched", () => { expect(commissionStatusWhere("matched")).toEqual({ status: AcademyMatchStatus.MATCHED }); });
  it("maps unmatched to not found and ambiguous", () => { expect(commissionStatusWhere("unmatched")).toEqual({ status: { in: [AcademyMatchStatus.NOT_FOUND, AcademyMatchStatus.AMBIGUOUS] } }); });
  it("preserves search and resets pagination on filter change", () => { expect(commissionFilterHref("unmatched", "Ada")).toBe("/dashboard/commissions?filter=unmatched&search=Ada"); expect(commissionFilterHref("unmatched", "Ada")).not.toContain("page="); });
  it("combines search with the selected status filter", () => { const where = buildCommissionWhere(" Ada ", "unmatched"); expect(where.status).toEqual({ in: [AcademyMatchStatus.NOT_FOUND, AcademyMatchStatus.AMBIGUOUS] }); expect(where.OR).toHaveLength(3); expect(JSON.stringify(where.OR)).toContain("Ada"); });
});

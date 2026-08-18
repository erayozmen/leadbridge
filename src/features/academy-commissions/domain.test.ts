import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { calculateCommissionAdjustment } from "./domain";
describe("academy commission delta", () => {
  it.each([["10000", "0", "10000", "2500"], ["10000", "10000", "0", "0"], ["14000", "10000", "4000", "1000"], ["10000", "14000", "-4000", "-1000"]])("calculates immutable adjustment", (current, previous, delta, commission) => { const result = calculateCommissionAdjustment(new Prisma.Decimal(current), new Prisma.Decimal(previous)); expect(result.delta.toString()).toBe(delta); expect(result.commission.toString()).toBe(commission); });
});

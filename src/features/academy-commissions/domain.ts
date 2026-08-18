import { Prisma } from "@prisma/client";
export const ACADEMY_COMMISSION_RATE = new Prisma.Decimal("0.25");
export function calculateCommissionAdjustment(current: Prisma.Decimal, previous: Prisma.Decimal) {
  const delta = current.minus(previous);
  return { delta, commission: delta.mul(ACADEMY_COMMISSION_RATE).toDecimalPlaces(2) };
}

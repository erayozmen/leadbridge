export const ACADEMY_LOOKUP_BATCH_SIZE = 100;

export function buildAcademyLookupBatches<T>(items: readonly T[], size = ACADEMY_LOOKUP_BATCH_SIZE): T[][] {
  if (!Number.isInteger(size) || size < 1) throw new Error("Batch size must be a positive integer");
  const batches: T[][] = [];
  for (let index = 0; index < items.length; index += size) batches.push(items.slice(index, index + size));
  return batches;
}

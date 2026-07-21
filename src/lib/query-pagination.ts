export const PAGE_SIZE_OPTIONS = [25, 50, 100] as const;
export type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];

export function parsePositivePage(value: unknown): number {
  const page = typeof value === "number" ? value : Number(value);
  return Number.isSafeInteger(page) && page > 0 ? page : 1;
}

export function parsePageSize(value: unknown): PageSize {
  const pageSize = typeof value === "number" ? value : Number(value);
  return PAGE_SIZE_OPTIONS.includes(pageSize as PageSize) ? pageSize as PageSize : 25;
}

export function parseSort<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && allowed.includes(value as T) ? value as T : fallback;
}

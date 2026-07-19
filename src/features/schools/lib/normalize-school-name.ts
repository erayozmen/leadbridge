export function cleanSchoolName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

export function normalizeSchoolName(name: string): string {
  return cleanSchoolName(name).toLocaleLowerCase("tr-TR");
}

export function buildSchoolBackfillEntries(values: string[]): Array<{ name: string; normalizedName: string }> {
  const entries = new Map<string, string>();
  for (const value of values) {
    const name = cleanSchoolName(value);
    if (!name) continue;
    const normalizedName = normalizeSchoolName(name);
    if (!entries.has(normalizedName)) entries.set(normalizedName, name);
  }
  return [...entries].map(([normalizedName, name]) => ({ name, normalizedName }));
}

export function resolveSchoolDisplayName(relation: { name: string } | null, legacyName: string): string {
  return relation?.name ?? legacyName;
}

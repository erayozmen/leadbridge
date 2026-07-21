const DANGEROUS_PREFIX = /^[=+\-@\t\r]/;

export function safeCsvCell(value: unknown): string {
  const raw = value === null || value === undefined ? "" : String(value);
  const safe = DANGEROUS_PREFIX.test(raw) ? `'${raw}` : raw;
  return `"${safe.replaceAll('"', '""')}"`;
}

export function buildCsv(headers: string[], rows: unknown[][]): string {
  return `\uFEFF${[headers, ...rows].map(row => row.map(safeCsvCell).join(",")).join("\r\n")}`;
}

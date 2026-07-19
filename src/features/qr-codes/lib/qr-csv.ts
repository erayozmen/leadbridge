export function createQrCsv(
  rows: Array<{ serialNumber: string; registrationUrl: string }>,
): string {
  const escape = (value: string) => `"${value.replaceAll('"', '""')}"`;
  return [
    "serialNumber,registrationUrl",
    ...rows.map((row) => `${escape(row.serialNumber)},${escape(row.registrationUrl)}`),
  ].join("\r\n");
}

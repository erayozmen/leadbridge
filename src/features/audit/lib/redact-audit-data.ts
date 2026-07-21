const SENSITIVE_KEYS = /(?:token|hash|password|secret|authorization|cookie|phone|email|firstName|lastName|school)/i;

export function redactAuditData(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactAuditData);
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value).map(([key, nested]) => [
      key,
      SENSITIVE_KEYS.test(key) ? "[MASKELENDİ]" : redactAuditData(nested),
    ]),
  );
}

/**
 * Client-side secret redaction utilities.
 * Aligns with backend sensitive logging policy.
 */

/** Fields that should be redacted regardless of nesting depth */
const SENSITIVE_KEYS = new Set([
  "password",
  "passwd",
  "secret",
  "token",
  "access_token",
  "refresh_token",
  "api_key",
  "apikey",
  "authorization",
  "auth",
  "private_key",
  "privatekey",
  "client_secret",
  "clientsecret",
  "credentials",
  "credential",
  "ssn",
  "cvv",
  "card_number",
  "cardnumber",
  "account_number",
  "accountnumber",
]);

export const REDACTED_PLACEHOLDER = "[REDACTED]";

function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEYS.has(key.toLowerCase().replace(/[-_\s]/g, ""));
}

/**
 * Recursively redact sensitive fields from an object.
 * Returns a new object; the original is never mutated.
 */
export function redactObject(value: unknown): unknown {
  if (value === null || typeof value !== "object") return value;

  if (Array.isArray(value)) {
    return value.map(redactObject);
  }

  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    result[k] = isSensitiveKey(k) ? REDACTED_PLACEHOLDER : redactObject(v);
  }
  return result;
}

/**
 * Redact a JSON string.
 * Returns the redacted JSON string, or the original string if it is not valid JSON.
 */
export function redactJson(jsonString: string): string {
  try {
    const parsed = JSON.parse(jsonString);
    return JSON.stringify(redactObject(parsed), null, 2);
  } catch {
    return jsonString;
  }
}

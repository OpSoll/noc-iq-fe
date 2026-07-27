/**
 * Telemetry privacy guard — recursively strips sensitive fields before emission.
 * Centrally configured blocked field list.
 */

const DEFAULT_BLOCKED_FIELDS: Set<string> = new Set([
  "token",
  "access_token",
  "refresh_token",
  "secret",
  "api_key",
  "apikey",
  "api-key",
  "client_secret",
  "clientsecret",
  "client-secret",
  "password",
  "passwd",
  "private_key",
  "privatekey",
  "private-key",
  "authorization",
  "auth",
  "ssn",
  "social_security",
  "email",
  "phone",
  "phone_number",
  "phonenumber",
  "credit_card",
  "card_number",
  "cardnumber",
  "cvv",
  "account_number",
  "accountnumber",
  "wallet_private_key",
  "walletprivatekey",
  "wallet_private",
  "mnemonic",
  "seed_phrase",
  "seedphrase",
]);

const SANITIZED = "[REDACTED]";

let blockedFields: Set<string> = new Set(DEFAULT_BLOCKED_FIELDS);

export function getBlockedFields(): readonly string[] {
  return [...blockedFields];
}

export function setBlockedFields(fields: string[]): void {
  blockedFields = new Set(fields.map((f) => f.toLowerCase()));
}

export function resetBlockedFields(): void {
  blockedFields = new Set(DEFAULT_BLOCKED_FIELDS);
}

function isBlocked(key: string): boolean {
  return blockedFields.has(key.toLowerCase().replace(/[-_\s]/g, ""));
}

/**
 * Recursively sanitize an object, stripping blocked fields.
 * Returns a new object; original is never mutated.
 */
export function sanitize<T>(obj: T): T {
  if (obj === null || typeof obj !== "object") return obj;

  if (Array.isArray(obj)) {
    return obj.map(sanitize) as T;
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (isBlocked(key)) {
      result[key] = SANITIZED;
    } else {
      result[key] = sanitize(value);
    }
  }
  return result as T;
}

/**
 * Sanitize a telemetry payload before emission.
 */
export function sanitizeForEmission<T>(payload: T): T {
  try {
    return sanitize(payload);
  } catch {
    return payload;
  }
}

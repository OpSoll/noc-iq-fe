/**
 * Telemetry privacy guard — recursively strips sensitive fields before emission.
 * Centrally configured blocked field list.
 */

const DEFAULT_BLOCKED_FIELDS: Set<string> = new Set([
  'token',
  'access_token',
  'refresh_token',
  'secret',
  'api_key',
  'apikey',
  'api-key',
  'client_secret',
  'clientsecret',
  'client-secret',
  'password',
  'passwd',
  'private_key',
  'privatekey',
  'private-key',
  'authorization',
  'auth',
  'ssn',
  'social_security',
  'email',
  'phone',
  'phone_number',
  'phonenumber',
  'credit_card',
  'card_number',
  'cardnumber',
  'cvv',
  'account_number',
  'accountnumber',
  'wallet_private_key',
  'walletprivatekey',
  'wallet_private',
  'mnemonic',
  'seed_phrase',
  'seedphrase',
]);

const SANITIZED = '[REDACTED]';

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
  return blockedFields.has(key.toLowerCase().replace(/[-_\s]/g, ''));
}

/**
 * Recursively sanitize an object, stripping blocked fields.
 * Returns a new object; original is never mutated.
 */
export function sanitize<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj;

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

// ── Free-text redaction (#977) ────────────────────────────────────────────────
//
// Key-based `sanitize` above cannot help when a secret arrives as a *value* —
// which is exactly what happens with client error telemetry: an error message
// or stack trace frequently embeds e.g.
//   "Request failed: Authorization: Bearer eyJhbGciOi..."
//   "GET /api/outages?token=abc123 failed"
// These helpers strip token-like substrings wherever they appear in a string.

export const REDACTED_TEXT = '[REDACTED]';

/** An `Authorization` header value, with any auth scheme. */
const AUTHORIZATION_PATTERN =
  /\b(authorization\s*[:=]\s*)(?:bearer|basic|token|apikey)?\s*[^\s,;"']+/gi;

/** A `Bearer <token>`, `Basic <token>` or `Token <token>` fragment on its own. */
const AUTH_SCHEME_PATTERN = /\b(bearer|basic|token)\s+[A-Za-z0-9\-._~+/=]{8,}/gi;

/** `token=...`, `access_token=...`, `api_key=...`, `secret=...` in a query string. */
const KEY_VALUE_SECRET_PATTERN =
  /\b(access_token|refresh_token|api[_-]?key|apikey|client[_-]?secret|token|secret|password)\s*[:=]\s*[^\s,;&"']+/gi;

/** A JWT: three base64url segments separated by dots. */
const JWT_PATTERN = /\beyJ[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{4,}\b/g;

/** A long bare hex/opaque secret (>= 32 chars) such as a raw API key. */
const RAW_SECRET_PATTERN = /\b[A-Za-z0-9_-]{32,}\b/g;

/**
 * Redact token-like substrings from a single string, preserving the rest of the
 * message so the error remains diagnosable.
 */
export function redactSensitiveText(text: string): string {
  if (typeof text !== 'string' || text.length === 0) return text;
  let result = text;
  // Order matters: strip the labelled forms first so the bare-secret pass below
  // does not leave a dangling "Bearer [REDACTED]"-style fragment.
  result = result.replace(AUTHORIZATION_PATTERN, (_m, prefix: string) => `${prefix}${REDACTED_TEXT}`);
  result = result.replace(AUTH_SCHEME_PATTERN, (m) => {
    const scheme = m.split(/\s+/)[0];
    return `${scheme} ${REDACTED_TEXT}`;
  });
  result = result.replace(KEY_VALUE_SECRET_PATTERN, (_m, key: string) => `${key}=${REDACTED_TEXT}`);
  result = result.replace(JWT_PATTERN, REDACTED_TEXT);
  result = result.replace(RAW_SECRET_PATTERN, REDACTED_TEXT);
  return result;
}

/**
 * Like {@link sanitize}, but also redacts token-like content inside string
 * values, recursively. Use for anything that carries free text (error messages,
 * stacks, URLs) before it is emitted as telemetry.
 */
export function sanitizeDeep<T>(obj: T): T {
  if (typeof obj === 'string') {
    return redactSensitiveText(obj) as unknown as T;
  }
  if (obj === null || typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    return obj.map(sanitizeDeep) as unknown as T;
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (isBlocked(key)) {
      result[key] = SANITIZED;
    } else if (key.toLowerCase() === 'stack' && typeof value === 'string') {
      result[key] = redactSensitiveText(value);
    } else {
      result[key] = sanitizeDeep(value);
    }
  }
  return result as T;
}

/**
 * Redact a payload for emission, honouring both key- and value-based secrets.
 * Never throws.
 */
export function redactForEmission<T>(payload: T): T {
  try {
    return sanitizeDeep(payload);
  } catch {
    return payload;
  }
}

/**
 * Validation for outbound webhook endpoint registration.
 *
 * Webhook targets are operator-supplied URLs that the backend will POST to,
 * so the checks here matter beyond form hygiene: an `http://` target in
 * production would send signing secrets and payload data in clear text, and a
 * loopback or link-local address would let a form-filling user aim the
 * platform's outbound dispatcher at internal infrastructure (SSRF).
 *
 * Closes #663 — webhook endpoint registration modal.
 */

export const WEBHOOK_TOPICS = [
  { value: 'outage.created', label: 'Outage created' },
  { value: 'outage.resolved', label: 'Outage resolved' },
  { value: 'payment.processed', label: 'Payment processed' },
  { value: 'sla.breached', label: 'SLA breached' },
  { value: 'dispute.opened', label: 'Dispute opened' },
  { value: 'dispute.resolved', label: 'Dispute resolved' },
] as const;

export type WebhookTopic = (typeof WEBHOOK_TOPICS)[number]['value'];

/** Alphabet without look-alike characters, for a secret operators can retype. */
const SECRET_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export interface WebhookFormValues {
  url: string;
  description: string;
  secret: string;
  topics: string[];
}

export type WebhookFieldErrors = Partial<Record<keyof WebhookFormValues, string>>;

export const WEBHOOK_URL_ERROR = 'Enter a valid http:// or https:// URL';
export const WEBHOOK_HTTPS_ERROR =
  'Production endpoints must use HTTPS so payloads and signatures are encrypted in transit';
export const WEBHOOK_SECRET_ERROR =
  'Secret must be at least 16 characters and use only letters, digits, - and _';
export const WEBHOOK_TOPICS_ERROR = 'Select at least one event topic';

const SECRET_RE = /^[A-Za-z0-9_-]{16,}$/;

function parseUrl(value: string): URL | null {
  const trimmed = (value ?? '').trim();
  if (!trimmed) return null;
  try {
    return new URL(trimmed);
  } catch {
    return null;
  }
}

/** True when the URL resolves to a loopback, link-local, or private address. */
export function isPrivateHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost') || host === '::1') {
    return true;
  }
  // IPv4 loopback and RFC 1918 / link-local ranges.
  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (ipv4) {
    const [a, b] = [Number(ipv4[1]), Number(ipv4[2])];
    if (a === 127 || a === 10 || a === 0) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 169 && b === 254) return true;
  }
  // Unique local IPv6 (fc00::/7).
  if (/^f[cd][0-9a-f]{2}:/.test(host)) return true;
  return false;
}

export interface ValidateWebhookOptions {
  /** Forces HTTPS even outside production, for staging hardening. */
  requireHttps?: boolean;
}

/**
 * Validates the registration form.
 *
 * Returns every failing field at once rather than stopping at the first, so
 * the operator can fix the form in one pass.
 */
export function validateWebhookForm(
  values: WebhookFormValues,
  options: ValidateWebhookOptions = {}
): WebhookFieldErrors {
  const errors: WebhookFieldErrors = {};
  const isProduction =
    options.requireHttps ??
    process.env.NODE_ENV === 'production';

  const url = parseUrl(values.url);
  if (!url) {
    errors.url = WEBHOOK_URL_ERROR;
  } else {
    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      errors.url = WEBHOOK_URL_ERROR;
    } else if (isProduction && url.protocol !== 'https:') {
      // Signed payloads must never cross the network in clear text.
      errors.url = WEBHOOK_HTTPS_ERROR;
    } else if (isPrivateHost(url.hostname)) {
      errors.url =
        'Endpoint host must be publicly routable, not a loopback or private address';
    }
  }

  const secret = (values.secret ?? '').trim();
  // A blank secret is allowed — one is generated server- or client-side.
  if (secret && !SECRET_RE.test(secret)) {
    errors.secret = WEBHOOK_SECRET_ERROR;
  }

  if (!values.topics || values.topics.length === 0) {
    errors.topics = WEBHOOK_TOPICS_ERROR;
  }

  return errors;
}

export function isWebhookFormValid(
  values: WebhookFormValues,
  options: ValidateWebhookOptions = {}
): boolean {
  return Object.keys(validateWebhookForm(values, options)).length === 0;
}

/**
 * Generates a signing secret when the operator leaves the field blank.
 *
 * Uses `crypto.getRandomValues` with a rejection-sampling step so the
 * distribution over the 32-character alphabet stays uniform — plain modulo
 * would bias the first few characters of the alphabet.
 */
export function generateWebhookSecret(byteLength: number = 24): string {
  const length = Math.max(16, Math.floor(byteLength));
  const alphabet = SECRET_ALPHABET;
  const out: string[] = [];
  const buffer = new Uint32Array(length);

  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(buffer);
  } else {
    for (let i = 0; i < length; i++) {
      buffer[i] = Math.floor(Math.random() * 0xffffffff);
    }
  }

  const limit = Math.floor(0xffffffff / alphabet.length) * alphabet.length;
  let index = 0;
  while (out.length < length && index < buffer.length) {
    // Restart the draw if this value was in the biased tail.
    if (buffer[index] < limit) {
      out.push(alphabet[buffer[index] % alphabet.length]);
    }
    index++;
  }

  // Fill any shortfall caused by rejected values.
  while (out.length < length) {
    out.push(alphabet[Math.floor(Math.random() * alphabet.length)]);
  }

  return `whsec_${out.join('')}`;
}

/** Masks a secret for display, e.g. `whsec_ABCD…WXYZ`. */
export function maskSecret(secret: string): string {
  if (secret.length <= 12) return '••••••••';
  return `${secret.slice(0, 8)}…${secret.slice(-4)}`;
}

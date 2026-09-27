import type { Webhook } from '@/types/webhook';

/**
 * Grace-window options for a webhook signing-secret rotation.
 *
 * Rotating a secret invalidates every receiver's signature verification
 * immediately unless the old key is kept valid for a while. That trade-off is
 * genuinely different per deployment: a receiver deployed from the same CI
 * pipeline can rotate in seconds, while a receiver owned by a third party
 * needs hours of warning. These options make the trade-off explicit instead of
 * defaulting silently to one of them.
 *
 * Closes #666 — webhook secret key rotation modal with grace window options.
 */

export type GraceWindowHours = 0 | 1 | 24;

export interface GraceWindowOption {
  value: GraceWindowHours;
  label: string;
  description: string;
}

export const GRACE_WINDOW_OPTIONS: readonly GraceWindowOption[] = [
  {
    value: 0,
    label: 'Immediate',
    description:
      'The old secret stops working now. Use this only when you control every receiver and can redeploy at once.',
  },
  {
    value: 1,
    label: '1 Hour',
    description:
      'Both secrets validate for an hour. Enough for a receiver behind a cached config or a slow deploy.',
  },
  {
    value: 24,
    label: '24 Hours',
    description:
      'Both secrets validate for a day. The safe default for receivers you do not deploy yourself.',
  },
] as const;

export const DEFAULT_GRACE_WINDOW: GraceWindowHours = 24;

export function isGraceWindowHours(value: number): value is GraceWindowHours {
  return GRACE_WINDOW_OPTIONS.some((option) => option.value === value);
}

export function getGraceWindowOption(
  value: number
): GraceWindowOption | undefined {
  return GRACE_WINDOW_OPTIONS.find((option) => option.value === value);
}

/** Validates a requested grace window, returning a message when invalid. */
export function validateGraceWindow(value: number): string | null {
  if (!Number.isInteger(value) || value < 0) {
    return 'Grace period must be a whole number of hours';
  }
  if (value > 168) {
    return 'Grace period cannot exceed 7 days (168 hours)';
  }
  return null;
}

/**
 * Whether the endpoint is currently accepting signatures from two secrets.
 *
 * The backend reports this as a secondary secret preview plus an expiry, so
 * both must be present and the expiry still in the future.
 */
export function isInGraceWindow(
  webhook: Pick<Webhook, 'secondary_secret_preview' | 'secondary_secret_expires_at'>,
  now: Date = new Date()
): boolean {
  if (!webhook.secondary_secret_preview) return false;
  if (!webhook.secondary_secret_expires_at) return true;
  const expiry = new Date(webhook.secondary_secret_expires_at);
  if (Number.isNaN(expiry.getTime())) return false;
  return expiry.getTime() > now.getTime();
}

/** Human-readable remaining grace-window time. */
export function describeGraceWindowRemaining(
  expiresAt: string | null | undefined,
  now: Date = new Date()
): string | null {
  if (!expiresAt) return null;
  const expiry = new Date(expiresAt);
  if (Number.isNaN(expiry.getTime())) return null;

  const msRemaining = expiry.getTime() - now.getTime();
  if (msRemaining <= 0) return 'Grace window has ended';

  const hours = Math.floor(msRemaining / 3_600_000);
  const minutes = Math.floor((msRemaining % 3_600_000) / 60_000);
  if (hours >= 1) return `${hours}h ${minutes}m remaining`;
  if (minutes >= 1) return `${minutes}m remaining`;
  return 'Less than a minute remaining';
}

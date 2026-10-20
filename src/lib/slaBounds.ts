/**
 * Bounds for the SLA threshold inputs (#989).
 *
 * The config form let a user type any number — a negative threshold, a
 * fractional minute, an absurd magnitude — with no hint about what the backend
 * considers sensible, so the mistake only surfaced as a rejected save (or not at
 * all). These specs drive both the input attributes (`min`, `step`, `max`) and
 * the helper text, and back an inline range check so the user is told before
 * saving.
 *
 * Pure and side-effect free so it can be unit tested without rendering the form.
 */

export interface NumericBoundSpec {
  /** Human label used in helper and error copy. */
  label: string;
  /** Smallest accepted value. */
  min: number;
  /** Largest accepted value. */
  max: number;
  /** Increment the spinner and validation use. */
  step: number;
  /** Unit name rendered after the value, e.g. "minutes". */
  unit?: string;
}

export const SLA_BOUNDS = {
  threshold_minutes: {
    label: 'Threshold',
    min: 1,
    max: 60 * 24 * 30, // 30 days
    step: 1,
    unit: 'minutes',
  },
  reward_base: {
    label: 'Reward base',
    min: 0,
    max: 1_000_000,
    step: 0.01,
    unit: 'USDC',
  },
  penalty_per_minute: {
    label: 'Penalty per minute',
    min: 0,
    max: 100_000,
    step: 0.01,
    unit: 'USDC',
  },
} as const satisfies Record<string, NumericBoundSpec>;

export type SlaBoundKey = keyof typeof SLA_BOUNDS;

/** `1 to 43,200 minutes` — a short description of the accepted range. */
export function describeBounds(spec: NumericBoundSpec): string {
  const range = `${spec.min.toLocaleString('en-US')} to ${spec.max.toLocaleString(
    'en-US'
  )}`;
  return spec.unit ? `${range} ${spec.unit}` : range;
}

/** Helper text shown beneath the input. */
export function getBoundsHint(key: SlaBoundKey): string {
  const spec = SLA_BOUNDS[key];
  const step =
    spec.step < 1 ? `Whole steps of ${spec.step}` : `Whole ${spec.unit ?? 'units'}`;
  return `Enter ${describeBounds(spec)}. ${step}.`;
}

/**
 * Returns an inline error for a value outside the accepted range, or `null`
 * when the value is valid. Non-finite input (empty field -> `Number('') === 0`
 * is handled by the caller) is reported as required.
 */
export function validateBound(
  key: SlaBoundKey,
  value: number
): string | null {
  const spec = SLA_BOUNDS[key];
  if (!Number.isFinite(value)) {
    return `${spec.label} must be a number.`;
  }
  if (value < spec.min || value > spec.max) {
    return `${spec.label} must be between ${describeBounds(spec)}.`;
  }
  return null;
}

/**
 * Validates every SLA field at once, returning a map of field -> error. An empty
 * map means the form may be saved.
 */
export function validateSlaConfig(
  values: Partial<Record<SlaBoundKey, number>>
): Partial<Record<SlaBoundKey, string>> {
  const errors: Partial<Record<SlaBoundKey, string>> = {};
  (Object.keys(SLA_BOUNDS) as SlaBoundKey[]).forEach((key) => {
    const value = values[key];
    if (value === undefined) return;
    const error = validateBound(key, value);
    if (error) errors[key] = error;
  });
  return errors;
}

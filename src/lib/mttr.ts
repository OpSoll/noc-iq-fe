export const MINUTES_PER_HOUR = 60;

export type MttrValidation = {
  valid: boolean;
  error: string | null;
};

/**
 * Parses a single duration field. Blank fields count as zero so a user can fill
 * in only hours or only minutes; anything non-numeric yields NaN.
 */
function parsePart(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : NaN;

  const trimmed = value.trim();
  if (trimmed === "") return 0;

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : NaN;
}

/**
 * Converts an hours/minutes pair into total MTTR minutes.
 * Returns NaN when either field is not a number.
 */
export function toMttrMinutes(
  hours: string | number | null | undefined,
  minutes: string | number | null | undefined,
): number {
  const h = parsePart(hours);
  const m = parsePart(minutes);

  if (Number.isNaN(h) || Number.isNaN(m)) return NaN;

  return h * MINUTES_PER_HOUR + m;
}

/**
 * Splits total MTTR minutes back into whole hours and remaining minutes, so the
 * helper fields can be rehydrated from a raw-minutes value.
 */
export function splitMttrMinutes(totalMinutes: number | null | undefined): {
  hours: number;
  minutes: number;
} {
  if (
    totalMinutes === null ||
    totalMinutes === undefined ||
    !Number.isFinite(totalMinutes) ||
    totalMinutes <= 0
  ) {
    return { hours: 0, minutes: 0 };
  }

  const hours = Math.floor(totalMinutes / MINUTES_PER_HOUR);
  // Rounded to shed floating-point noise from fractional inputs (e.g. 90.0000001).
  const minutes = Math.round((totalMinutes - hours * MINUTES_PER_HOUR) * 100) / 100;

  return { hours, minutes };
}

/**
 * MTTR must be a positive number — a resolved outage cannot have taken zero time.
 */
export function validateMttrMinutes(totalMinutes: number): MttrValidation {
  if (!Number.isFinite(totalMinutes)) {
    return { valid: false, error: "Enter MTTR as a number." };
  }

  if (totalMinutes <= 0) {
    return { valid: false, error: "MTTR must be greater than 0 minutes." };
  }

  return { valid: true, error: null };
}

/** Human-readable summary of a minutes total, e.g. `90 minutes (1h 30m)`. */
export function formatMttrSummary(totalMinutes: number): string {
  if (!Number.isFinite(totalMinutes) || totalMinutes <= 0) return "—";

  const { hours, minutes } = splitMttrMinutes(totalMinutes);
  const label = totalMinutes === 1 ? "minute" : "minutes";

  if (hours === 0) return `${totalMinutes} ${label}`;
  if (minutes === 0) return `${totalMinutes} ${label} (${hours}h)`;

  return `${totalMinutes} ${label} (${hours}h ${minutes}m)`;
}

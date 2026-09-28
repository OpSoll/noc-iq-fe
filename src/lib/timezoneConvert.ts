/**
 * Timezone offset conversion for bulk import (#634).
 *
 * Converts naive timestamps (logged in a source timezone) to UTC ISO strings
 * before the import payload is sent to the backend.
 */

export type SourceTimezone = 'UTC' | 'EST' | 'PST' | 'CET' | 'Local';

/** Fixed offsets from UTC in minutes (standard time; no DST for simplicity). */
export const TIMEZONE_OFFSETS_MINUTES: Record<Exclude<SourceTimezone, 'Local'>, number> = {
  UTC: 0,
  EST: -5 * 60,
  PST: -8 * 60,
  CET: 1 * 60,
};

export const SOURCE_TIMEZONES: SourceTimezone[] = [
  'UTC',
  'EST',
  'PST',
  'CET',
  'Local',
];

export function getOffsetMinutes(
  tz: SourceTimezone,
  at: Date = new Date(),
): number {
  if (tz === 'Local') {
    return -at.getTimezoneOffset();
  }
  return TIMEZONE_OFFSETS_MINUTES[tz];
}

/**
 * Parse a timestamp string as wall-clock time in `sourceTz` and return UTC ISO.
 * Accepts `YYYY-MM-DDTHH:mm:ss`, `YYYY-MM-DD HH:mm:ss`, or date-only.
 */
export function convertTimestampToUtc(
  value: string,
  sourceTz: SourceTimezone,
): string {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;

  // Already has explicit Z or offset — leave as-is (normalize to ISO).
  if (/[zZ]$/.test(trimmed) || /[+-]\d{2}:\d{2}$/.test(trimmed)) {
    const d = new Date(trimmed);
    if (Number.isNaN(d.getTime())) {
      throw new Error(`Invalid timestamp: ${value}`);
    }
    return d.toISOString();
  }

  const normalized = trimmed.replace(' ', 'T');
  const match = normalized.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2}))?)?$/,
  );
  if (!match) {
    throw new Error(`Unrecognized timestamp format: ${value}`);
  }

  const [, ys, ms, ds, hs = '0', mins = '0', ss = '0'] = match;
  const year = Number(ys);
  const month = Number(ms);
  const day = Number(ds);
  const hour = Number(hs);
  const minute = Number(mins);
  const second = Number(ss);

  // Interpret components as UTC then subtract source offset.
  const asUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  const offsetMin = getOffsetMinutes(sourceTz, new Date(asUtc));
  const utcMs = asUtc - offsetMin * 60_000;
  return new Date(utcMs).toISOString();
}

export interface TimestampPreview {
  original: string;
  utc: string;
  error?: string;
}

export function previewTimestampConversions(
  values: string[],
  sourceTz: SourceTimezone,
): TimestampPreview[] {
  return values.map((original) => {
    try {
      return { original, utc: convertTimestampToUtc(original, sourceTz) };
    } catch (err) {
      return {
        original,
        utc: '',
        error: err instanceof Error ? err.message : String(err),
      };
    }
  });
}

/** Convert mapped row timestamp fields in-place for the import payload. */
export function convertRowTimestampsToUtc(
  rows: Record<string, string>[],
  timestampFields: string[],
  sourceTz: SourceTimezone,
): Record<string, string>[] {
  if (sourceTz === 'UTC') {
    return rows.map((row) => {
      const next = { ...row };
      for (const field of timestampFields) {
        if (next[field]) {
          next[field] = convertTimestampToUtc(next[field], 'UTC');
        }
      }
      return next;
    });
  }
  return rows.map((row) => {
    const next = { ...row };
    for (const field of timestampFields) {
      if (next[field]) {
        next[field] = convertTimestampToUtc(next[field], sourceTz);
      }
    }
    return next;
  });
}

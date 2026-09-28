'use client';

/**
 * Timezone selector for the bulk import wizard (#634).
 */

import {
  SOURCE_TIMEZONES,
  type SourceTimezone,
  previewTimestampConversions,
} from '@/lib/timezoneConvert';

export interface TimezoneSelectorProps {
  value: SourceTimezone;
  onChange: (tz: SourceTimezone) => void;
  /** Sample timestamp strings from the CSV for a live UTC preview. */
  sampleTimestamps?: string[];
  className?: string;
}

const LABELS: Record<SourceTimezone, string> = {
  UTC: 'UTC',
  EST: 'Eastern (EST, UTC−5)',
  PST: 'Pacific (PST, UTC−8)',
  CET: 'Central Europe (CET, UTC+1)',
  Local: 'Browser local timezone',
};

export function TimezoneSelector({
  value,
  onChange,
  sampleTimestamps = [],
  className,
}: TimezoneSelectorProps) {
  const previews = previewTimestampConversions(
    sampleTimestamps.slice(0, 5),
    value,
  );

  return (
    <div className={className} data-testid="timezone-selector">
      <label
        htmlFor="csv-source-timezone"
        className="mb-1 block text-sm font-medium text-foreground"
      >
        CSV source timezone
      </label>
      <select
        id="csv-source-timezone"
        value={value}
        onChange={(e) => onChange(e.target.value as SourceTimezone)}
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        aria-describedby="csv-tz-help"
      >
        {SOURCE_TIMEZONES.map((tz) => (
          <option key={tz} value={tz}>
            {LABELS[tz]}
          </option>
        ))}
      </select>
      <p id="csv-tz-help" className="mt-1 text-xs text-muted-foreground">
        Timestamps in the file are interpreted in this zone and converted to UTC
        before upload.
      </p>

      {previews.length > 0 && (
        <div className="mt-3 rounded-md border border-border bg-muted/40 p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            UTC preview
          </p>
          <ul className="space-y-1 font-mono text-xs">
            {previews.map((p, i) => (
              <li key={`${p.original}-${i}`} className="flex flex-wrap gap-2">
                <span className="text-muted-foreground">{p.original}</span>
                <span aria-hidden>→</span>
                {p.error ? (
                  <span className="text-destructive">{p.error}</span>
                ) : (
                  <span className="text-foreground">{p.utc}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default TimezoneSelector;

// Closes #448: quick-preset date range helpers for the SLA dashboard filters.
//
// Pure date math extracted out of SLADashboardView so the presets are easy to
// unit test without rendering the component or mocking next/navigation.

export type DateRangePreset = 'today' | '7d' | '30d' | 'mtd';

export const DATE_RANGE_PRESETS: { key: DateRangePreset; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: '7d', label: 'Last 7 Days' },
  { key: '30d', label: 'Last 30 Days' },
  { key: 'mtd', label: 'MTD' },
];

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Resolves a preset key into a concrete { date_from, date_to } window, anchored on `now`. */
export function computePresetRange(
  preset: DateRangePreset,
  now: Date = new Date()
): { date_from: string; date_to: string } {
  const to = new Date(now);
  const from = new Date(now);

  switch (preset) {
    case 'today':
      break;
    case '7d':
      from.setDate(from.getDate() - 7);
      break;
    case '30d':
      from.setDate(from.getDate() - 30);
      break;
    case 'mtd':
      from.setDate(1);
      break;
  }

  return { date_from: toIsoDate(from), date_to: toIsoDate(to) };
}

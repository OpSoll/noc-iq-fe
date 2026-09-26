/**
 * Client-side classification of a dispute's free-text `reason` into a
 * category, for filtering and display. The backend doesn't (yet) store a
 * structured category field, so this derives one from keywords in the
 * reason text the operator entered when flagging the dispute.
 */

export type DisputeCategory =
  'mttr_error' | 'threshold_mismatch' | 'outage_timing' | 'other';

export const DISPUTE_CATEGORIES: DisputeCategory[] = [
  'mttr_error',
  'threshold_mismatch',
  'outage_timing',
  'other',
];

export const DISPUTE_CATEGORY_LABELS: Record<DisputeCategory, string> = {
  mttr_error: 'MTTR Error',
  threshold_mismatch: 'Threshold Mismatch',
  outage_timing: 'Outage Timing',
  other: 'Other',
};

const CATEGORY_KEYWORDS: Array<[Exclude<DisputeCategory, 'other'>, RegExp]> = [
  ['mttr_error', /\bmttr\b|resolution time|time.?to.?resolv/i],
  ['threshold_mismatch', /threshold|tier mismatch|wrong tier|sla tier/i],
  ['outage_timing', /outage time|start time|end time|duration|timing/i],
];

/**
 * Classifies a dispute's reason text into a {@link DisputeCategory}.
 * Falls back to "other" when no keyword pattern matches.
 */
export function classifyDisputeCategory(
  reason: string | null | undefined
): DisputeCategory {
  const text = reason ?? '';
  for (const [category, pattern] of CATEGORY_KEYWORDS) {
    if (pattern.test(text)) return category;
  }
  return 'other';
}

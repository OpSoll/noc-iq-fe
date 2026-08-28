import type { Outage, Severity } from "@/types/outages";

// Closes #453: MTTR distribution histogram bucketing logic

export type MttrBucketKey = "lt15" | "15to30" | "30to60" | "gt60";

export interface MttrBucket {
  key: MttrBucketKey;
  label: string;
  min: number;
  /** Exclusive upper bound; `null` means unbounded. */
  max: number | null;
  count: number;
}

export const MTTR_BUCKET_DEFS: Array<Omit<MttrBucket, "count">> = [
  { key: "lt15", label: "<15m", min: 0, max: 15 },
  { key: "15to30", label: "15-30m", min: 15, max: 30 },
  { key: "30to60", label: "30-60m", min: 30, max: 60 },
  { key: "gt60", label: ">60m", min: 60, max: null },
];

/** Which MTTR bucket a duration (in minutes) falls into. */
export function bucketForMttrMinutes(mttrMinutes: number): MttrBucketKey {
  if (!Number.isFinite(mttrMinutes) || mttrMinutes < 15) return "lt15";
  if (mttrMinutes < 30) return "15to30";
  if (mttrMinutes < 60) return "30to60";
  return "gt60";
}

export interface MttrHistogramFilters {
  severity?: Severity;
  dateFrom?: string;
  dateTo?: string;
}

function resolvedWithinRange(outage: Outage, dateFrom?: string, dateTo?: string): boolean {
  if (!outage.resolved_at) return false;
  const resolvedTime = new Date(outage.resolved_at).getTime();
  if (Number.isNaN(resolvedTime)) return false;

  if (dateFrom) {
    const fromTime = new Date(dateFrom).getTime();
    if (!Number.isNaN(fromTime) && resolvedTime < fromTime) return false;
  }
  if (dateTo) {
    // Include the entire "to" day.
    const toTime = new Date(dateTo).getTime() + 24 * 60 * 60 * 1000 - 1;
    if (!Number.isNaN(toTime) && resolvedTime > toTime) return false;
  }
  return true;
}

/** MTTR in minutes for a resolved outage, preferring the recorded SLA result. */
export function outageMttrMinutes(outage: Outage): number | null {
  if (outage.sla_status && Number.isFinite(outage.sla_status.mttr_minutes)) {
    return outage.sla_status.mttr_minutes;
  }
  if (outage.resolved_at && outage.detected_at) {
    const detected = new Date(outage.detected_at).getTime();
    const resolved = new Date(outage.resolved_at).getTime();
    if (!Number.isNaN(detected) && !Number.isNaN(resolved) && resolved >= detected) {
      return (resolved - detected) / 60_000;
    }
  }
  return null;
}

/**
 * Groups resolved outages into MTTR buckets (<15m, 15-30m, 30-60m, >60m),
 * optionally filtered by severity tier and a resolved-date range.
 */
export function buildMttrHistogram(
  outages: Outage[],
  filters: MttrHistogramFilters = {},
): MttrBucket[] {
  const buckets: MttrBucket[] = MTTR_BUCKET_DEFS.map((def) => ({ ...def, count: 0 }));
  const byKey = new Map(buckets.map((b) => [b.key, b]));

  for (const outage of outages) {
    if (outage.status !== "resolved") continue;
    if (filters.severity && outage.severity !== filters.severity) continue;
    if (!resolvedWithinRange(outage, filters.dateFrom, filters.dateTo)) continue;

    const mttr = outageMttrMinutes(outage);
    if (mttr === null) continue;

    const bucket = byKey.get(bucketForMttrMinutes(mttr));
    if (bucket) bucket.count += 1;
  }

  return buckets;
}

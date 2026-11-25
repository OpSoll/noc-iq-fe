
export interface SiteSubscriberMetadata {
  site_id: string;
  subscriber_count: number;
}

export function calculateAffectedSubscribers(
  metadata: SiteSubscriberMetadata | null | undefined,
): number | null {
  if (!metadata) return null;

  const count = Number(metadata.subscriber_count);

  if (!Number.isFinite(count) || count < 0) {
    return null;
  }

  return Math.round(count);
}


import { apiClient } from "@/lib/apiClient";

export interface SiteSubscriberMetadata {
  site_id: string;
  subscriber_count: number;
}

export async function getSiteSubscriberMetadata(
  siteId: string,
  signal?: AbortSignal,
): Promise<SiteSubscriberMetadata> {
  const response = await apiClient.get<SiteSubscriberMetadata>(
    `/sites/${encodeURIComponent(siteId)}/subscriber-metadata`,
    { signal },
  );

  return response.data;
}

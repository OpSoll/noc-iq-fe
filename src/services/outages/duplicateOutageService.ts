
import { apiClient } from "@/lib/apiClient";

export interface ExistingOpenOutage {
  id: string;
  site_id: string;
  site_name?: string;
  title?: string;
  status: string;
  created_at?: string;
}

export async function getOpenOutagesBySite(
  siteId: string,
  signal?: AbortSignal,
): Promise<ExistingOpenOutage[]> {
  const response = await apiClient.get<ExistingOpenOutage[]>(
    "/outages",
    {
      params: {
        site_id: siteId,
        status: "OPEN",
      },
      signal,
    },
  );

  return response.data;
}

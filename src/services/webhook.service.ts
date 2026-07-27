import { fetchClient } from "@/lib/fetchClient";

export interface ReplayWebhookDeliveryResponse {
  id: string;
  status: string;
  replayedAt: string;
}

export async function replayWebhookDelivery(
  deliveryId: string,
): Promise<ReplayWebhookDeliveryResponse> {
  return fetchClient.post<ReplayWebhookDeliveryResponse>(
    `/api/v1/webhooks/deliveries/${deliveryId}/replay`,
  );
}
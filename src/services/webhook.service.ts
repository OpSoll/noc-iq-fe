import { api } from "@/lib/api";

export interface ReplayWebhookDeliveryResponse {
  id: string;
  status: string;
  replayedAt: string;
}

export async function replayWebhookDelivery(
  deliveryId: string,
): Promise<ReplayWebhookDeliveryResponse> {
  const { data } = await api.post<ReplayWebhookDeliveryResponse>(
    `/webhooks/deliveries/${deliveryId}/replay`,
  );
  return data;
}
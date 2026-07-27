import { useMutation } from "@tanstack/react-query";

import {
  replayWebhookDelivery,
} from "@/services/webhook.service";

export function useWebhookReplay() {
  return useMutation({
    mutationFn: (
      deliveryId: string,
    ) =>
      replayWebhookDelivery(
        deliveryId,
      ),
  });
}
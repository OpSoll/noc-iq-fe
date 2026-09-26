import { api } from '@/lib/api';
import type {
  Webhook,
  WebhookDelivery,
  CreateWebhookPayload,
  UpdateWebhookPayload,
  RotateSecretPayload,
} from '@/types/webhook';

export const fetchWebhooks = async (): Promise<Webhook[]> => {
  const res = await api.get<Webhook[]>('/webhooks');
  return res.data;
};

export const createWebhook = async (
  payload: CreateWebhookPayload
): Promise<Webhook> => {
  const res = await api.post<Webhook>('/webhooks', payload);
  return res.data;
};

export const updateWebhook = async (
  id: string,
  payload: UpdateWebhookPayload
): Promise<Webhook> => {
  const res = await api.patch<Webhook>(`/webhooks/${id}`, payload);
  return res.data;
};

export const deleteWebhook = async (id: string): Promise<void> => {
  await api.delete(`/webhooks/${id}`);
};

export const fetchWebhookDeliveries = async (
  webhookId: string
): Promise<WebhookDelivery[]> => {
  const res = await api.get<WebhookDelivery[]>(
    `/webhooks/${webhookId}/deliveries`
  );
  return res.data;
};

export const retryDelivery = async (
  webhookId: string,
  deliveryId: string
): Promise<void> => {
  await api.post(`/webhooks/${webhookId}/deliveries/${deliveryId}/retry`);
};

export interface WebhookPingResult {
  statusCode: number;
  latencyMs: number;
}

/**
 * Sends a `ping` test event to `url` and reports the HTTP status code and
 * round-trip latency, so a URL can be verified before the webhook is saved.
 */
export const testWebhookConnection = async (
  url: string
): Promise<WebhookPingResult> => {
  const res = await api.post<{ status_code: number; latency_ms: number }>(
    '/webhooks/test',
    { url }
  );
  return { statusCode: res.data.status_code, latencyMs: res.data.latency_ms };
};

/**
 * Rotates a webhook's signing secret. The old secret keeps validating
 * incoming-compatible signatures for `grace_period_hours` (default 24h) so
 * receivers have time to pick up the new one before the old one stops
 * working.
 */
export const rotateWebhookSecret = async (
  webhookId: string,
  payload: RotateSecretPayload
): Promise<Webhook> => {
  const res = await api.post<Webhook>(
    `/webhooks/${webhookId}/rotate-secret`,
    payload
  );
  return res.data;
};

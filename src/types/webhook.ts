export interface Webhook {
  id: string;
  url: string;
  events: string[];
  active: boolean;
  created_at: string;
}

export interface WebhookDelivery {
  id: string;
  webhook_id: string;
  event: string;
  status: "success" | "failed" | "pending";
  response_code: number | null;
  created_at: string;
  /** The JSON payload sent to the endpoint. */
  request_body?: unknown;
  /** The endpoint's response body, if any. */
  response_body?: unknown;
}

export interface CreateWebhookPayload {
  url: string;
  events: string[];
}

export interface UpdateWebhookPayload {
  url?: string;
  events?: string[];
  active?: boolean;
}

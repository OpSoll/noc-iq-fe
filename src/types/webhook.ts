export interface Webhook {
  id: string;
  url: string;
  events: string[];
  active: boolean;
  created_at: string;
  /** Masked preview of the current signing secret (e.g. "whsec_...ab12"). Never the full secret. */
  secret_preview?: string;
  /** Masked preview of the secondary (post-rotation) signing secret, while both are valid. */
  secondary_secret_preview?: string | null;
  /** When the secondary secret stops being accepted and the rotation grace window ends. */
  secondary_secret_expires_at?: string | null;
}

export interface RotateSecretPayload {
  /** Hours both the old and new secret remain valid for, to avoid breaking receivers mid-rotation. */
  grace_period_hours: number;
}

export interface WebhookDelivery {
  id: string;
  webhook_id: string;
  event: string;
  status: "success" | "failed" | "pending";
  response_code: number | null;
  created_at: string;
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

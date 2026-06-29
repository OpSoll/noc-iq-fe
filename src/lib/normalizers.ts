export type OutageNormalized = {
  id: string;
  siteName: string;
  severity: string;
  status: string;
  detectedAt: string;
  resolvedAt: string | null;
};

export type PaymentNormalized = {
  id: string;
  transactionHash: string;
  amount: number;
  assetCode: string;
  status: string;
  createdAt: string;
};

export type WebhookNormalized = {
  id: string;
  url: string;
  eventType: string;
  status: string;
  lastDeliveryAt: string | null;
};

export function normalizeOutage(raw: Record<string, unknown>): OutageNormalized {
  return {
    id: String(raw.id ?? ""),
    siteName: String(raw.site_name ?? raw.siteName ?? ""),
    severity: String(raw.severity ?? "low"),
    status: String(raw.status ?? "open"),
    detectedAt: String(raw.detected_at ?? raw.detectedAt ?? ""),
    resolvedAt: raw.resolved_at ? String(raw.resolved_at) : raw.resolvedAt ? String(raw.resolvedAt) : null,
  };
}

export function normalizePayment(raw: Record<string, unknown>): PaymentNormalized {
  return {
    id: String(raw.id ?? ""),
    transactionHash: String(raw.transaction_hash ?? raw.transactionHash ?? ""),
    amount: Number(raw.amount ?? 0),
    assetCode: String(raw.asset_code ?? raw.assetCode ?? "XLM"),
    status: String(raw.status ?? "pending"),
    createdAt: String(raw.created_at ?? raw.createdAt ?? ""),
  };
}

export function normalizeWebhook(raw: Record<string, unknown>): WebhookNormalized {
  return {
    id: String(raw.id ?? ""),
    url: String(raw.url ?? ""),
    eventType: String(raw.event_type ?? raw.eventType ?? ""),
    status: String(raw.status ?? "active"),
    lastDeliveryAt: raw.last_delivery_at ? String(raw.last_delivery_at) : raw.lastDeliveryAt ? String(raw.lastDeliveryAt) : null,
  };
}

import type { Outage } from "@/types/outages";
import type { Payment } from "@/types/payment";
import type { Webhook, WebhookDelivery } from "@/types/webhook";
import type { SLADispute } from "@/types/sla";

export interface ContractFixture<T> {
  version: string;
  label: string;
  capturedAt: string;
  backendVersion: string;
  data: T;
}

export const AUTH_FIXTURES: ContractFixture<{ id: string; email: string; role: string }> = {
  version: "1.0",
  label: "auth-user-profile",
  capturedAt: "2026-06-20T12:00:00Z",
  backendVersion: "v1.1",
  data: { id: "user-001", email: "operator@example.com", role: "admin" },
};

export const OUTAGE_FIXTURES: ContractFixture<Outage[]> = {
  version: "1.0",
  label: "outage-list",
  capturedAt: "2026-06-20T12:00:00Z",
  backendVersion: "v1.1",
  data: [
    { id: "fix-1", site_name: "Lagos Node 1", site_id: "NG-LA-01", severity: "critical", status: "open", detected_at: "2026-06-22T14:00:00Z", description: "Total upstream failure", affected_services: ["DNS", "BGP"], affected_subscribers: 15000 },
    { id: "fix-2", site_name: "Nairobi Core", site_id: "KE-NB-01", severity: "high", status: "resolved", detected_at: "2026-06-21T06:00:00Z", resolved_at: "2026-06-21T08:45:00Z", description: "Fiber cut", affected_services: ["BGP"], affected_subscribers: 8000 },
  ],
};

export const SLA_FIXTURES: ContractFixture<SLADispute[]> = {
  version: "1.1",
  label: "sla-disputes",
  capturedAt: "2026-06-20T12:00:00Z",
  backendVersion: "v1.1",
  data: [
    { id: "fix-disp-1", outage_id: "fix-1", status: "open", reason: "MTTR threshold disputed", created_at: "2026-06-23T10:00:00Z" },
    { id: "fix-disp-2", outage_id: "fix-1", status: "under_review", reason: "SLA calculation error", created_at: "2026-06-23T11:00:00Z" },
  ],
};

export const PAYMENT_FIXTURES: ContractFixture<Payment[]> = {
  version: "1.0",
  label: "payment-list",
  capturedAt: "2026-06-20T12:00:00Z",
  backendVersion: "v1.1",
  data: [
    { id: "fix-pay-1", outage_id: "fix-1", type: "penalty", amount: 5000, asset_code: "XLM", transaction_hash: "tx-fix-1", from_address: "GA...", to_address: "GB...", status: "completed", created_at: "2026-06-22T15:00:00Z" },
  ],
};

export const WEBHOOK_FIXTURES: ContractFixture<Webhook[]> = {
  version: "1.0",
  label: "webhook-list",
  capturedAt: "2026-06-20T12:00:00Z",
  backendVersion: "v1.1",
  data: [
    { id: "fix-wh-1", url: "https://hooks.example.com/webhook", events: ["outage.created"], active: true, created_at: "2026-06-01T00:00:00Z" },
  ],
};

export const WEBHOOK_DELIVERY_FIXTURES: ContractFixture<WebhookDelivery[]> = {
  version: "1.0",
  label: "webhook-deliveries",
  capturedAt: "2026-06-20T12:00:00Z",
  backendVersion: "v1.1",
  data: [
    { id: "fix-del-1", webhook_id: "fix-wh-1", event: "outage.created", status: "success", response_code: 200, created_at: "2026-06-22T14:01:00Z" },
  ],
};

export const AUDIT_FIXTURES: ContractFixture<Array<{ action: string; timestamp: string; user: string }>> = {
  version: "1.0",
  label: "audit-trail",
  capturedAt: "2026-06-20T12:00:00Z",
  backendVersion: "v1.1",
  data: [
    { action: "outage.create", timestamp: "2026-06-22T14:00:00Z", user: "operator@example.com" },
    { action: "outage.resolve", timestamp: "2026-06-21T08:45:00Z", user: "engineer@example.com" },
  ],
};

export const ALL_FIXTURES: Record<string, ContractFixture<unknown>> = {
  auth: AUTH_FIXTURES,
  outages: OUTAGE_FIXTURES,
  sla: SLA_FIXTURES,
  payments: PAYMENT_FIXTURES,
  webhooks: WEBHOOK_FIXTURES,
  "webhook-deliveries": WEBHOOK_DELIVERY_FIXTURES,
  audit: AUDIT_FIXTURES,
};

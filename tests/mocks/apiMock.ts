import type { Outage } from "@/types/outages";
import type { Webhook, WebhookDelivery } from "@/types/webhook";
import type { Payment } from "@/types/payment";
import type { SLADispute } from "@/types/sla";
import type { DashboardMetrics } from "@/types/dashboard";

export type ScenarioPack =
  | "outages"
  | "payments"
  | "webhooks"
  | "analytics"
  | "empty";

export interface ScenarioConfig {
  label: string;
  latency?: number;
  errorRate?: number;
  partialPayload?: boolean;
}

const DEFAULT_CONFIG: ScenarioConfig = {
  label: "default",
  latency: 0,
  errorRate: 0,
  partialPayload: false,
};

export class ApiMock {
  private config: ScenarioConfig;

  constructor(config: Partial<ScenarioConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  setConfig(config: Partial<ScenarioConfig>) {
    this.config = { ...this.config, ...config };
  }

  private async applyScenario<T>(data: T): Promise<T> {
    if (this.config.latency) {
      await new Promise((r) => setTimeout(r, this.config.latency));
    }
    if (this.config.errorRate && Math.random() < this.config.errorRate) {
      throw new Error("Simulated API error");
    }
    return data;
  }

  private maybePartial<T extends Record<string, unknown>>(obj: T): Partial<T> {
    if (this.config.partialPayload) {
      const keys = Object.keys(obj);
      const keep = keys.slice(0, Math.floor(keys.length / 2));
      const partial: Partial<T> = {};
      for (const k of keep) {
        partial[k as keyof T] = obj[k];
      }
      return partial;
    }
    return obj;
  }

  // Outage scenarios
  async getOutages(pack: ScenarioPack = "outages"): Promise<Outage[]> {
    const data = this.getOutagePack(pack);
    return this.applyScenario(data);
  }

  async getOutage(id: string): Promise<Outage | null> {
    const outages = this.getOutagePack("outages");
    return this.applyScenario(outages.find((o) => o.id === id) ?? null);
  }

  private getOutagePack(pack: ScenarioPack): Outage[] {
    const base: Outage[] = [
      {
        id: "mock-1", site_name: "Lagos Node 1", severity: "critical", status: "open",
        detected_at: "2026-06-22T14:00:00Z", description: "Total upstream failure",
        affected_services: ["DNS", "BGP"], affected_subscribers: 15000,
      },
      {
        id: "mock-2", site_name: "Nairobi Core", severity: "high", status: "resolved",
        detected_at: "2026-06-21T06:00:00Z", resolved_at: "2026-06-21T08:45:00Z",
        description: "Fiber cut", affected_services: ["BGP"],
      },
    ];
    if (pack === "empty") return [];
    return base;
  }

  // Payment scenarios
  async getPayments(pack: ScenarioPack = "payments"): Promise<Payment[]> {
    const data = this.getPaymentPack(pack);
    return this.applyScenario(data);
  }

  private getPaymentPack(pack: ScenarioPack): Payment[] {
    if (pack === "empty") return [];
    return [
      { id: "pay-1", outage_id: "mock-1", type: "penalty", amount: 5000, asset_code: "XLM", transaction_hash: "tx1", from_address: "GA...", to_address: "GB...", status: "completed", created_at: "2026-06-22T15:00:00Z" },
      { id: "pay-2", outage_id: "mock-2", type: "reward", amount: 2000, asset_code: "XLM", transaction_hash: "tx2", from_address: "GA...", to_address: "GB...", status: "completed", created_at: "2026-06-21T09:00:00Z" },
    ];
  }

  // Webhook scenarios
  async getWebhooks(pack: ScenarioPack = "webhooks"): Promise<Webhook[]> {
    const data = this.getWebhookPack(pack);
    return this.applyScenario(data);
  }

  async getDeliveries(pack: ScenarioPack = "webhooks"): Promise<WebhookDelivery[]> {
    if (pack === "empty") return this.applyScenario([]);
    return this.applyScenario([
      { id: "del-1", webhook_id: "wh-1", event: "outage.created", status: "success", response_code: 200, created_at: "2026-06-22T14:01:00Z" },
      { id: "del-2", webhook_id: "wh-1", event: "outage.resolved", status: "failed", response_code: 500, created_at: "2026-06-22T15:00:00Z" },
      { id: "del-3", webhook_id: "wh-1", event: "sla.breached", status: "failed", response_code: null, created_at: "2026-06-22T15:01:00Z" },
    ]);
  }

  private getWebhookPack(pack: ScenarioPack): Webhook[] {
    if (pack === "empty") return [];
    return [
      { id: "wh-1", url: "https://hooks.example.com/webhook", events: ["outage.created", "outage.resolved", "sla.breached"], active: true, created_at: "2026-06-01T00:00:00Z" },
      { id: "wh-2", url: "https://hooks.example.com/backup", events: ["outage.created"], active: false, created_at: "2026-06-10T00:00:00Z" },
    ];
  }

  // Analytics scenarios
  async getDashboardMetrics(pack: ScenarioPack = "analytics"): Promise<DashboardMetrics> {
    if (pack === "empty") {
      return this.applyScenario({
        sla_compliance_percentage: 0, penalties: { total: 0, count: 0 },
        rewards: { total: 0, count: 0 }, trends: [],
      });
    }
    return this.applyScenario({
      sla_compliance_percentage: 94.5, penalties: { total: 15000, count: 3 },
      rewards: { total: 8000, count: 5 },
      trends: [
        { period: "2026-06-21", compliance_percentage: 95.0, penalties: 5000, rewards: 2000 },
        { period: "2026-06-22", compliance_percentage: 94.0, penalties: 10000, rewards: 6000 },
      ],
    });
  }

  // SLA Dispute scenarios
  async getDisputes(pack: ScenarioPack = "outages"): Promise<SLADispute[]> {
    if (pack === "empty") return this.applyScenario([]);
    return this.applyScenario([
      { id: "disp-1", outage_id: "mock-1", status: "open", reason: "MTTR threshold disputed", created_at: "2026-06-23T10:00:00Z" },
      { id: "disp-2", outage_id: "mock-1", status: "under_review", reason: "SLA calculation error", created_at: "2026-06-23T11:00:00Z" },
      { id: "disp-3", outage_id: "mock-2", status: "resolved", reason: "Resolved in favor of operator", created_at: "2026-06-22T09:00:00Z", resolved_at: "2026-06-22T12:00:00Z", resolution_note: "Approved" },
      { id: "disp-4", outage_id: "mock-2", status: "rejected", reason: "Insufficient evidence", created_at: "2026-06-21T08:00:00Z", resolved_at: "2026-06-21T16:00:00Z", resolution_note: "Rejected" },
    ]);
  }
}

export function createMockApi(config?: Partial<ScenarioConfig>) {
  return new ApiMock(config);
}

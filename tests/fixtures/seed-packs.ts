import type { Outage } from "@/types/outages";
import type { Webhook, WebhookDelivery } from "@/types/webhook";

export interface SeedPack {
  name: string;
  description: string;
  outages: Outage[];
  webhooks: Webhook[];
  deliveries: WebhookDelivery[];
}

export const PACK_NORMAL: SeedPack = {
  name: "normal",
  description: "All systems operational, minimal activity",
  outages: [],
  webhooks: [
    { id: "wh-1", url: "https://hooks.example.com/normal", events: ["outage.created"], active: true, created_at: "2026-06-01T00:00:00Z" },
  ],
  deliveries: [],
};

export const PACK_DEGRADED: SeedPack = {
  name: "degraded",
  description: "Several low-to-medium severity outages in progress",
  outages: [
    { id: "out-1", site_name: "Lagos Node 2", site_id: "NG-LA-02", severity: "medium", status: "open", detected_at: "2026-06-23T08:30:00Z", description: "Intermittent packet loss on backbone link", affected_services: ["DNS", "VoIP"], affected_subscribers: 1200, assigned_to: "ops-team" },
    { id: "out-2", site_name: "Accra Hub", site_id: "GH-AC-01", severity: "low", status: "open", detected_at: "2026-06-23T10:15:00Z", description: "Minor latency spike on CDN egress", affected_services: ["CDN"], affected_subscribers: 450 },
  ],
  webhooks: [
    { id: "wh-2", url: "https://hooks.example.com/degraded", events: ["outage.created", "outage.resolved"], active: true, created_at: "2026-06-01T00:00:00Z" },
  ],
  deliveries: [
    { id: "del-1", webhook_id: "wh-2", event: "outage.created", status: "success", response_code: 200, created_at: "2026-06-23T08:31:00Z" },
  ],
};

export const PACK_INCIDENT_HEAVY: SeedPack = {
  name: "incident-heavy",
  description: "Multiple critical outages with SLA violations and payment history",
  outages: [
    { id: "out-10", site_name: "Lagos Node 1", site_id: "NG-LA-01", severity: "critical", status: "open", detected_at: "2026-06-22T14:00:00Z", description: "Total upstream provider failure — all traffic affected", affected_services: ["DNS", "VoIP", "CDN", "BGP"], affected_subscribers: 15000, assigned_to: "senior-ops" },
    { id: "out-11", site_name: "Nairobi Core", site_id: "KE-NB-01", severity: "high", status: "resolved", detected_at: "2026-06-21T06:00:00Z", resolved_at: "2026-06-21T08:45:00Z", description: "Fiber cut on primary trunk", affected_services: ["BGP", "VoIP"], affected_subscribers: 8000, root_cause: "Third-party construction damage", resolution_notes: "Failover to secondary link activated" },
    { id: "out-12", site_name: "Cairo Edge", site_id: "EG-CA-01", severity: "medium", status: "open", detected_at: "2026-06-23T01:00:00Z", description: "SSL certificate expired on edge proxy", affected_services: ["CDN"], affected_subscribers: 3000 },
  ],
  webhooks: [
    { id: "wh-3", url: "https://hooks.example.com/incidents", events: ["outage.created", "outage.resolved", "sla.breached"], active: true, created_at: "2026-06-01T00:00:00Z" },
    { id: "wh-4", url: "https://hooks.example.com/backup", events: ["outage.created"], active: false, created_at: "2026-06-10T00:00:00Z" },
  ],
  deliveries: [
    { id: "del-10", webhook_id: "wh-3", event: "outage.created", status: "success", response_code: 200, created_at: "2026-06-22T14:01:00Z" },
    { id: "del-11", webhook_id: "wh-3", event: "outage.resolved", status: "success", response_code: 200, created_at: "2026-06-21T08:46:00Z" },
    { id: "del-12", webhook_id: "wh-3", event: "sla.breached", status: "failed", response_code: 500, created_at: "2026-06-22T16:00:00Z" },
    { id: "del-13", webhook_id: "wh-3", event: "sla.breached", status: "pending", response_code: null, created_at: "2026-06-23T01:05:00Z" },
  ],
};

export const ALL_PACKS: Record<string, SeedPack> = {
  normal: PACK_NORMAL,
  degraded: PACK_DEGRADED,
  "incident-heavy": PACK_INCIDENT_HEAVY,
};

export function getSeedPack(name: string): SeedPack | undefined {
  return ALL_PACKS[name];
}

export function listSeedPacks(): { name: string; description: string }[] {
  return Object.values(ALL_PACKS).map((p) => ({ name: p.name, description: p.description }));
}

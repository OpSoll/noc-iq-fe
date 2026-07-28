export const queryKeys = {
  outages: {
    all: ["outages"] as const,
    list: (params?: Record<string, unknown>) => ["outages", "list", params] as const,
    detail: (id: string) => ["outages", "detail", id] as const,
  },
  payments: {
    all: ["payments"] as const,
    list: (params?: Record<string, unknown>) => ["payments", "list", params] as const,
    detail: (id: string) => ["payments", "detail", id] as const,
  },
  webhooks: {
    all: ["webhooks"] as const,
    list: (params?: Record<string, unknown>) => ["webhooks", "list", params] as const,
    detail: (id: string) => ["webhooks", "detail", id] as const,
  },
  dashboard: {
    metrics: (filters?: Record<string, unknown>) => ["dashboard-metrics", filters] as const,
  },
  sla: {
    config: () => ["sla", "config"] as const,
  },
  analytics: {
    anomalies: (params?: Record<string, unknown>) => ["analytics", "anomalies", params] as const,
  },
} as const;

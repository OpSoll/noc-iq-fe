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
    /** Root key – invalidating this clears every dashboard query. */
    all: ["dashboard"] as const,
    /** Primary metrics keyed by filter set. */
    metrics: (filters?: Record<string, unknown>) =>
      ["dashboard", "metrics", filters] as const,
    /** Comparison-window metrics keyed by filter set. */
    compare: (filters?: Record<string, unknown>) =>
      ["dashboard", "compare", filters] as const,
  },
  sla: {
    config: () => ["sla", "config"] as const,
  },
  analytics: {
    anomalies: (params?: Record<string, unknown>) => ["analytics", "anomalies", params] as const,
  },
  wallet: {
    all: ["wallet"] as const,
    detail: (userId: string) => ["wallet", "detail", userId] as const,
    status: (userId: string) => ["wallet", "status", userId] as const,
    balance: (address: string) => ["wallet", "balance", address] as const,
  },
} as const;

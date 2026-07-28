export interface DomainConfig {
  staleTime: number;
  refetchInterval: number;
  refetchOnWindowFocus: boolean;
}

const DEFAULT: DomainConfig = { staleTime: 30_000, refetchInterval: 60_000, refetchOnWindowFocus: true };

const configs: Record<string, DomainConfig> = {
  outages: { ...DEFAULT, staleTime: 30_000, refetchInterval: 60_000 },
  payments: { ...DEFAULT, staleTime: 60_000, refetchInterval: 120_000 },
  webhooks: { ...DEFAULT, staleTime: 30_000, refetchInterval: 60_000 },
  analytics: { ...DEFAULT, staleTime: 120_000, refetchInterval: 300_000 },
};

export function getDomainConfig(domain: string): DomainConfig {
  return configs[domain] ?? DEFAULT;
}

export const domainConfigs = configs;

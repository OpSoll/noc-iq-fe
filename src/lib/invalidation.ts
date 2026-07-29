import { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";

type QueryKeyPattern = readonly unknown[];

interface InvalidationEntry {
  mutationType: string;
  invalidate: QueryKeyPattern[];
}

/**
 * Centralised invalidation map.
 *
 * Dashboard mutations invalidate the entire `["dashboard"]` root key
 * so both primary metrics and comparison windows are refreshed in one
 * pass – no need to enumerate each sub-key.
 *
 * Wallet mutations only touch wallet keys; they do NOT cascade into
 * dashboard because wallet funding changes don't alter SLA analytics.
 */
const invalidationMap: InvalidationEntry[] = [
  { mutationType: "outage.create", invalidate: [queryKeys.outages.all, queryKeys.dashboard.all] },
  { mutationType: "outage.update", invalidate: [queryKeys.outages.all, queryKeys.dashboard.all] },
  { mutationType: "outage.resolve", invalidate: [queryKeys.outages.all, queryKeys.dashboard.all, queryKeys.sla.config()] },
  { mutationType: "outage.delete", invalidate: [queryKeys.outages.all, queryKeys.dashboard.all] },
  { mutationType: "payment.process", invalidate: [queryKeys.payments.all, queryKeys.dashboard.all] },
  { mutationType: "payment.refund", invalidate: [queryKeys.payments.all, queryKeys.dashboard.all] },
  { mutationType: "payment.retry", invalidate: [queryKeys.payments.all, queryKeys.dashboard.all] },
  { mutationType: "payment.reconcile", invalidate: [queryKeys.payments.all, queryKeys.dashboard.all] },
  { mutationType: "webhook.create", invalidate: [queryKeys.webhooks.all] },
  { mutationType: "webhook.update", invalidate: [queryKeys.webhooks.all] },
  { mutationType: "webhook.delete", invalidate: [queryKeys.webhooks.all] },
  { mutationType: "webhook.replay", invalidate: [queryKeys.webhooks.all] },
  { mutationType: "sla.update", invalidate: [queryKeys.sla.config(), queryKeys.dashboard.all] },
  { mutationType: "wallet.create", invalidate: [queryKeys.wallet.all] },
  { mutationType: "wallet.link", invalidate: [queryKeys.wallet.all] },
];

export function getInvalidations(mutationType: string): QueryKeyPattern[] {
  return invalidationMap.find((e) => e.mutationType === mutationType)?.invalidate ?? [];
}

export async function invalidateForMutation(queryClient: QueryClient, mutationType: string): Promise<void> {
  const keys = getInvalidations(mutationType);
  await Promise.all(keys.map((k) => queryClient.invalidateQueries({ queryKey: k as readonly unknown[] })));
}

export { invalidationMap };

import { QueryClient } from "@tanstack/react-query";

type QueryKeyPattern = (string | Record<string, unknown>)[];

interface InvalidationEntry {
  mutationType: string;
  invalidate: QueryKeyPattern[];
}

const invalidationMap: InvalidationEntry[] = [
  { mutationType: "outage.create", invalidate: [["outages"], ["dashboard-metrics"]] },
  { mutationType: "outage.update", invalidate: [["outages"], ["dashboard-metrics"]] },
  { mutationType: "outage.resolve", invalidate: [["outages"], ["dashboard-metrics"], ["sla"]] },
  { mutationType: "outage.delete", invalidate: [["outages"], ["dashboard-metrics"]] },
  { mutationType: "payment.process", invalidate: [["payments"], ["dashboard-metrics"]] },
  { mutationType: "payment.refund", invalidate: [["payments"], ["dashboard-metrics"]] },
  { mutationType: "webhook.create", invalidate: [["webhooks"]] },
  { mutationType: "webhook.update", invalidate: [["webhooks"]] },
  { mutationType: "webhook.delete", invalidate: [["webhooks"]] },
  { mutationType: "sla.update", invalidate: [["sla"], ["dashboard-metrics"]] },
];

export function getInvalidations(mutationType: string): QueryKeyPattern[] {
  return invalidationMap.find((e) => e.mutationType === mutationType)?.invalidate ?? [];
}

export async function invalidateForMutation(queryClient: QueryClient, mutationType: string): Promise<void> {
  const keys = getInvalidations(mutationType);
  await Promise.all(keys.map((k) => queryClient.invalidateQueries({ queryKey: k as readonly unknown[] })));
}

export { invalidationMap };

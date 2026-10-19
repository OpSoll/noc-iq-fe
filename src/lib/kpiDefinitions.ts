/**
 * KPI metric definitions (#1017).
 *
 * Centralised so the definition shown in a tooltip is written once and cannot
 * drift between the MTTR/MTBF cards, the SLA KPI cards and any future consumer.
 * Each entry is a concise, accurate statement of how the metric is computed.
 */

export const KPI_DEFINITIONS = {
  mttr: 'Average time from detection to resolution, computed over outages resolved in the selected period.',
  mtbf: 'Average gap between consecutive outage detections in the selected period.',
  slaCompliance:
    'Percentage of outages in the period that met their severity SLA target (resolved within the threshold).',
  totalPenalties:
    'Sum of penalty payments charged for SLA violations in the period.',
  totalRewards:
    'Sum of reward payments granted for beating the SLA target in the period.',
  netBalance:
    'Total rewards minus total penalties for the period.',
  violationRate:
    'Percentage of outages in the period whose mean time to repair exceeded the SLA threshold.',
} as const;

export type KpiDefinitionKey = keyof typeof KPI_DEFINITIONS;

/** Returns the definition for a metric key, or undefined when unknown. */
export function getKpiDefinition(
  key: string
): string | undefined {
  return (KPI_DEFINITIONS as Record<string, string>)[key];
}

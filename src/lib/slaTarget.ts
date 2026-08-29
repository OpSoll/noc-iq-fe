// Closes #449: shared SLA compliance target/threshold helpers.
//
// The operational target percentage a compliance point is measured against.
// Centralized here so the dashboard chart, its tooltip copy, and the PDF
// export (#450) all agree on the same target instead of hardcoding it in
// multiple places.
export const DEFAULT_SLA_COMPLIANCE_TARGET = 99.9;

/** Percentage-point variance of a value relative to the target (positive = above target). */
export function getComplianceVariance(
  value: number,
  target: number = DEFAULT_SLA_COMPLIANCE_TARGET
): number {
  return value - target;
}

export function isAboveTarget(
  value: number,
  target: number = DEFAULT_SLA_COMPLIANCE_TARGET
): boolean {
  return value >= target;
}

/** Human-readable variance string, e.g. "+0.4pp vs target" or "-2.1pp vs target". */
export function formatComplianceVariance(
  value: number,
  target: number = DEFAULT_SLA_COMPLIANCE_TARGET
): string {
  const variance = getComplianceVariance(value, target);
  const sign = variance >= 0 ? '+' : '';
  return `${sign}${variance.toFixed(1)}pp vs ${target}% target`;
}

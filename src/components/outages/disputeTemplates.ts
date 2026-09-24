/**
 * Structured resolution-note templates (opsoll/noc-iq-fe#494).
 *
 * Selecting a template in the dispute resolution flow fills the resolution
 * notes text area with a consistent, high-quality starting draft that the
 * administrator can refine before submitting.
 */

export interface ResolutionTemplate {
  id: string;
  label: string;
  note: string;
}

export const RESOLUTION_TEMPLATES: ResolutionTemplate[] = [
  {
    id: "sla-calculation-error-accepted",
    label: "SLA Calculation Error Accepted",
    note:
      "SLA recalculation confirmed a calculation error in the original result. " +
      "Dispute accepted: the SLA outcome has been corrected and the affected " +
      "penalty/reward payment will be adjusted accordingly.",
  },
  {
    id: "maintenance-window-exclusion",
    label: "Maintenance Window Exclusion",
    note:
      "The reported outage fell within the contracted maintenance window and " +
      "is therefore excluded from SLA calculations per the service agreement. " +
      "No penalty adjustment is applied.",
  },
  {
    id: "dispute-rejected-invalid-evidence",
    label: "Dispute Rejected - Invalid Evidence",
    note:
      "Dispute rejected: the submitted evidence does not meet the contractual " +
      "evidence requirements and does not alter the SLA outcome. The original " +
      "SLA result stands.",
  },
];

/** Look up a template's note by its id. Unknown ids return null. */
export function getResolutionTemplate(
  id: string,
): ResolutionTemplate | null {
  return RESOLUTION_TEMPLATES.find((t) => t.id === id) ?? null;
}

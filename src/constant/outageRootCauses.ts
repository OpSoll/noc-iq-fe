
export const OUTAGE_ROOT_CAUSES = [
  {
    value: "HARDWARE",
    label: "Hardware",
    description: "Equipment failure or faulty network hardware",
  },
  {
    value: "FIBER_CUT",
    label: "Fiber Cut",
    description: "Fiber cable damage or transmission path disruption",
  },
  {
    value: "POWER",
    label: "Power",
    description: "Power outage, battery, rectifier, or generator failure",
  },
  {
    value: "THIRD_PARTY",
    label: "Third-Party",
    description: "External provider, carrier, vendor, or infrastructure failure",
  },
  {
    value: "OTHER",
    label: "Other",
    description: "Other or currently undetermined root cause",
  },
] as const;

export type OutageRootCause =
  (typeof OUTAGE_ROOT_CAUSES)[number]["value"];

export function getRootCauseLabel(
  value?: OutageRootCause | null,
): string {
  if (!value) return "Unclassified";

  return (
    OUTAGE_ROOT_CAUSES.find((cause) => cause.value === value)?.label ??
    "Unclassified"
  );
}

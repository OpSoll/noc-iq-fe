
export type SlaClassification = {
  label: string;
  color: "success" | "warning" | "danger" | "neutral";
  description: string;
};

export type SlaAvailability = {
  percentage: string;
  nines: number;
  classification: SlaClassification;
  downtime: {
    monthlyMinutes: number;
    yearlyMinutes: number;
  };
};

const SLA_LEVELS = [
  {
    threshold: 99.9,
    label: "3 Nines",
    color: "success" as const,
    description: "99.9% availability target",
  },
  {
    threshold: 99,
    label: "2 Nines",
    color: "warning" as const,
    description: "99% availability target",
  },
  {
    threshold: 95,
    label: "Standard",
    color: "warning" as const,
    description: "Below three nines",
  },
  {
    threshold: 0,
    label: "Low Availability",
    color: "danger" as const,
    description: "Availability needs attention",
  },
];

export function calculateNines(availability: number): number {
  const safe = Math.min(100, Math.max(0, availability));

  if (safe >= 100) return Infinity;
  if (safe <= 0) return 0;

  return -Math.log10(1 - safe / 100);
}

export function classifySla(availability: number): SlaClassification {
  const safe = Math.min(100, Math.max(0, availability));

  const level = SLA_LEVELS.find(({ threshold }) => safe >= threshold);

  return {
    label: level?.label ?? "Unknown",
    color: level?.color ?? "neutral",
    description: level?.description ?? "Availability classification",
  };
}

export function calculateDowntimeBudget(availability: number) {
  const safe = Math.min(100, Math.max(0, availability));
  const downtimeFraction = 1 - safe / 100;

  const monthlyMinutes = 30 * 24 * 60;
  const yearlyMinutes = 365 * 24 * 60;

  return {
    monthlyMinutes: downtimeFraction * monthlyMinutes,
    yearlyMinutes: downtimeFraction * yearlyMinutes,
  };
}

export function getSlaAvailability(
  availability: number,
): SlaAvailability {
  const safe = Number.isFinite(availability)
    ? Math.min(100, Math.max(0, availability))
    : 0;

  return {
    percentage: safe.toFixed(4),
    nines: calculateNines(safe),
    classification: classifySla(safe),
    downtime: calculateDowntimeBudget(safe),
  };
}

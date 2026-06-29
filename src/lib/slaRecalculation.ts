export type SlaRecalculationProvenance = {
  outageId: string;
  originalResult: { status: string; mttrMinutes: number; thresholdMinutes: number; amount: number };
  recalculatedResult: { status: string; mttrMinutes: number; thresholdMinutes: number; amount: number };
  reason: string;
  recalculatedBy: string;
  recalculatedAt: string;
};

export type ProvenanceIndicator = {
  label: string;
  originalValue: string | number;
  newValue: string | number;
  changed: boolean;
};

export function computeRecalculation(
  outageId: string,
  original: SlaRecalculationProvenance["originalResult"],
  overrideMttr?: number,
  overrideThreshold?: number,
): Omit<SlaRecalculationProvenance, "recalculatedBy" | "recalculatedAt"> {
  const recalculated = {
    status: overrideMttr && overrideMttr <= (overrideThreshold ?? original.thresholdMinutes) ? "met" : original.status,
    mttrMinutes: overrideMttr ?? original.mttrMinutes,
    thresholdMinutes: overrideThreshold ?? original.thresholdMinutes,
    amount: original.amount,
  };
  const reasons: string[] = [];
  if (overrideMttr !== undefined) reasons.push("MTTR overridden");
  if (overrideThreshold !== undefined) reasons.push("Threshold adjusted");

  return {
    outageId,
    originalResult: original,
    recalculatedResult: recalculated,
    reason: reasons.join("; ") || "No change",
  };
}

export function getProvenanceIndicators(provenance: SlaRecalculationProvenance): ProvenanceIndicator[] {
  return [
    { label: "SLA Status", originalValue: provenance.originalResult.status, newValue: provenance.recalculatedResult.status, changed: provenance.originalResult.status !== provenance.recalculatedResult.status },
    { label: "MTTR (min)", originalValue: provenance.originalResult.mttrMinutes, newValue: provenance.recalculatedResult.mttrMinutes, changed: provenance.originalResult.mttrMinutes !== provenance.recalculatedResult.mttrMinutes },
    { label: "Threshold (min)", originalValue: provenance.originalResult.thresholdMinutes, newValue: provenance.recalculatedResult.thresholdMinutes, changed: provenance.originalResult.thresholdMinutes !== provenance.recalculatedResult.thresholdMinutes },
  ];
}

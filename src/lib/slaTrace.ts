export type DecisionTrace = {
  outageId: string;
  slaStatus: "met" | "violated";
  mttrMinutes: number;
  thresholdMinutes: number;
  paymentAmount: number;
  reasonCodes: ReasonCode[];
};

export type ReasonCode = {
  code: string;
  label: string;
  description: string;
  severity: "info" | "warning" | "error";
};

const reasonCodeMap: Record<string, ReasonCode> = {
  MTTR_EXCEEDED: { code: "MTTR_EXCEEDED", label: "MTTR Threshold Exceeded", description: "Mean time to repair exceeded the SLA threshold", severity: "error" },
  MTTR_MET: { code: "MTTR_MET", label: "MTTR Within Threshold", description: "Outage resolved within SLA window", severity: "info" },
  SEVERITY_ADJUSTMENT: { code: "SEVERITY_ADJUSTMENT", label: "Severity Adjustment Applied", description: "SLA adjusted based on outage severity", severity: "warning" },
  BUSINESS_HOURS: { code: "BUSINESS_HOURS", label: "Business Hours Considered", description: "SLA calculation adjusted for business hours", severity: "info" },
  MANUAL_OVERRIDE: { code: "MANUAL_OVERRIDE", label: "Manual Override Applied", description: "SLA result was manually overridden by an admin", severity: "warning" },
};

export function getReasonCode(code: string): ReasonCode {
  return reasonCodeMap[code] || { code, label: code, description: "Unknown reason code", severity: "info" };
}

export function resolveReasonCodes(trace: DecisionTrace): DecisionTrace {
  const codes: ReasonCode[] = [];
  if (trace.slaStatus === "violated") codes.push(getReasonCode("MTTR_EXCEEDED"));
  else codes.push(getReasonCode("MTTR_MET"));
  return { ...trace, reasonCodes: codes };
}

export function renderReasonCodes(codes: ReasonCode[]): string {
  return codes.map((c) => `[${c.severity.toUpperCase()}] ${c.label}: ${c.description}`).join("\n");
}

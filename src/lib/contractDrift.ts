export type ContractDriftWarning = {
  endpoint: string;
  expectedType: string;
  actualType: string;
  field: string;
  severity: "info" | "warning" | "error";
};

export type DriftReport = {
  adminMessage: string;
  warnings: ContractDriftWarning[];
  criticalCount: number;
};

export function detectContractDrift(expected: Record<string, string>, actual: Record<string, unknown>): ContractDriftWarning[] {
  const warnings: ContractDriftWarning[] = [];
  for (const [field, expectedType] of Object.entries(expected)) {
    const actualType = typeof actual[field];
    if (actualType !== expectedType && !(actual[field] === null && expectedType === "string")) {
      warnings.push({
        endpoint: "unknown",
        field,
        expectedType,
        actualType,
        severity: expectedType === "string" && actualType === "number" ? "warning" : "error",
      });
    }
  }
  return warnings;
}

export function buildDriftReport(endpoint: string, expected: Record<string, string>, actual: Record<string, unknown>): DriftReport {
  const warnings = detectContractDrift(expected, actual).map((w) => ({ ...w, endpoint }));
  const critical = warnings.filter((w) => w.severity === "error").length;
  return {
    adminMessage: `Contract drift detected on ${endpoint}: ${warnings.length} field(s) changed`,
    warnings,
    criticalCount: critical,
  };
}

export function formatDriftForAdminPanel(report: DriftReport): string[] {
  return report.warnings.map(
    (w) => `[${w.severity.toUpperCase()}] ${w.endpoint}.${w.field}: expected ${w.expectedType}, got ${w.actualType}`,
  );
}

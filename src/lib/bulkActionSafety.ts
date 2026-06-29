export type BulkAction = {
  type: string;
  outageIds: string[];
  payload: Record<string, unknown>;
};

export type ImpactSummary = {
  totalOutages: number;
  affectedOutages: number;
  slaChanges: { met: number; violated: number; unchanged: number };
  paymentChanges: number;
  warnings: string[];
};

export type SafetyResult = {
  safe: boolean;
  summary: ImpactSummary;
  warnings: string[];
};

export function previewBulkAction(action: BulkAction, currentOutages: Record<string, { slaStatus: string; hasPayment: boolean }>): SafetyResult {
  const warnings: string[] = [];
  let affectedCount = 0;
  const slaChanges = { met: 0, violated: 0, unchanged: 0 };
  let paymentChanges = 0;

  for (const id of action.outageIds) {
    const outage = currentOutages[id];
    if (!outage) {
      warnings.push(`Outage ${id} not found`);
      continue;
    }
    affectedCount++;
    if (outage.slaStatus === "met") slaChanges.met++;
    else slaChanges.violated++;
    if (outage.hasPayment) paymentChanges++;
  }

  if (affectedCount === 0) warnings.push("No valid outages selected");
  if (paymentChanges > 5) warnings.push(`Bulk action affects ${paymentChanges} payments. Consider batching.`);

  return {
    safe: warnings.length === 0,
    summary: {
      totalOutages: action.outageIds.length,
      affectedOutages: affectedCount,
      slaChanges,
      paymentChanges,
      warnings,
    },
    warnings,
  };
}

export function executeBulkAction(action: BulkAction, preview: SafetyResult): { success: boolean; message: string } {
  if (!preview.safe) return { success: false, message: `Cannot execute: ${preview.warnings.join("; ")}` };
  return { success: true, message: `Applied ${action.type} to ${preview.summary.affectedOutages} outage(s)` };
}

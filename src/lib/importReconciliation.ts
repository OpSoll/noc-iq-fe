export type ImportRow = {
  rowIndex: number;
  status: "success" | "skipped" | "error";
  outageId?: string;
  errors: string[];
};

export type ImportReconciliationResult = {
  totalRows: number;
  successCount: number;
  skippedCount: number;
  errorCount: number;
  partialSuccess: boolean;
  details: ImportRow[];
};

export function reconcileImport(results: ImportRow[]): ImportReconciliationResult {
  const success = results.filter((r) => r.status === "success").length;
  const skipped = results.filter((r) => r.status === "skipped").length;
  const errors = results.filter((r) => r.status === "error").length;

  return {
    totalRows: results.length,
    successCount: success,
    skippedCount: skipped,
    errorCount: errors,
    partialSuccess: success > 0 && errors > 0,
    details: results,
  };
}

export function formatReconciliationSummary(result: ImportReconciliationResult): string {
  const parts: string[] = [`Imported ${result.successCount}/${result.totalRows} outages`];
  if (result.skippedCount > 0) parts.push(`${result.skippedCount} skipped`);
  if (result.errorCount > 0) parts.push(`${result.errorCount} errors`);
  if (result.partialSuccess) parts.push("(partial success)");
  return parts.join(" — ");
}

export function getErrorRows(result: ImportReconciliationResult): ImportRow[] {
  return result.details.filter((r) => r.status === "error");
}

"use client";

import { useCallback, useId, useState } from "react";
import { AlertTriangle, CheckCircle2, FlaskConical, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { dryRunImportOutages } from "@/services/bulkImportService";
import type { BulkImportDryRunResult } from "@/types/bulkImport";

/** Message the issue specifies for a clean dry run. */
export const DRY_RUN_SUCCESS_MESSAGE =
  "Dry run completed successfully with zero database modifications";

export interface DryRunToggleProps {
  /** File to validate. The control is inert without one. */
  file: File | null;
  /** Validator. Injectable so tests need no server. */
  validateFile?: (file: File) => Promise<BulkImportDryRunResult>;
  /** Notified when a dry run finishes, so a parent can show the report too. */
  onReport?: (report: BulkImportDryRunResult) => void;
  className?: string;
}

function CountCell({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}

/**
 * Dry-run (validate only) toggle for the bulk import wizard (issue #637).
 *
 * With the toggle on, the file goes to the validate-only endpoint instead of the
 * import endpoint, and the full validation report is shown without writing rows.
 *
 * ## The toast is a claim, so it is checked before being made
 *
 * "zero database modifications" is a promise about the server, not about this
 * component. If the response reports `database_modified: true` the run is treated
 * as a failure and the success toast is withheld, because a UI that asserts
 * nothing was written when something was is worse than one that says nothing.
 * When the field is absent the report is still shown, with the claim softened —
 * see the note on {@link BulkImportDryRunResult}.
 *
 * @param props - The file, an optional validator, and a report callback.
 * @returns The toggle, its run control, and the validation report.
 */
export function DryRunToggle({
  file,
  validateFile = dryRunImportOutages,
  onReport,
  className,
}: DryRunToggleProps) {
  const toast = useToast();
  const switchId = useId();

  const [enabled, setEnabled] = useState(false);
  const [running, setRunning] = useState(false);
  const [report, setReport] = useState<BulkImportDryRunResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async () => {
    if (!file) return;

    setRunning(true);
    setError(null);
    setReport(null);

    try {
      const result = await validateFile(file);
      setReport(result);
      onReport?.(result);

      if (result.database_modified === true) {
        // The endpoint was supposed to validate only. Say so plainly rather than
        // congratulating the user on a write that should not have happened.
        const message =
          "Validation endpoint reported database modifications. Treating this as a failure.";
        setError(message);
        toast(message, "error");
        return;
      }

      if (result.errors.length > 0) {
        toast(
          `Dry run finished with ${result.errors.length} validation ${
            result.errors.length === 1 ? "error" : "errors"
          }. Nothing was written.`,
          "error",
        );
        return;
      }

      toast(DRY_RUN_SUCCESS_MESSAGE, "success");
    } catch (caught) {
      const message =
        caught instanceof Error ? caught.message : "Dry run failed.";
      setError(message);
      toast(message, "error");
    } finally {
      setRunning(false);
    }
  }, [file, onReport, toast, validateFile]);

  return (
    <section
      className={cn("space-y-4 rounded-lg border border-border p-4", className)}
      aria-label="Dry run"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <label
            htmlFor={switchId}
            className="flex items-center gap-2 text-sm font-medium"
          >
            <FlaskConical className="h-4 w-4" aria-hidden="true" />
            Dry Run (Validate Only)
          </label>
          <p className="mt-1 text-xs text-muted-foreground">
            Sends the file to the validation endpoint and reports what would be
            imported. No rows are written.
          </p>
        </div>

        <button
          id={switchId}
          type="button"
          role="switch"
          aria-checked={enabled}
          onClick={() => setEnabled((previous) => !previous)}
          className={cn(
            "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            enabled ? "bg-primary" : "bg-muted",
          )}
        >
          <span
            aria-hidden="true"
            className={cn(
              "inline-block h-4 w-4 transform rounded-full bg-background shadow transition-transform",
              enabled ? "translate-x-6" : "translate-x-1",
            )}
          />
        </button>
      </div>

      {enabled && (
        <div className="space-y-4">
          <Button
            type="button"
            onClick={run}
            disabled={!file || running}
            size="sm"
          >
            {running ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                Validating…
              </>
            ) : (
              "Run validation"
            )}
          </Button>

          {!file && (
            <p className="text-xs text-muted-foreground">
              Select a file to validate.
            </p>
          )}

          {error && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <p>{error}</p>
            </div>
          )}

          {report && !error && (
            <div className="space-y-3" aria-live="polite">
              <div className="flex items-center gap-2 text-sm font-medium">
                {report.errors.length === 0 ? (
                  <>
                    <CheckCircle2
                      className="h-4 w-4 text-green-600 dark:text-green-400"
                      aria-hidden="true"
                    />
                    Validation passed
                  </>
                ) : (
                  <>
                    <AlertTriangle
                      className="h-4 w-4 text-destructive"
                      aria-hidden="true"
                    />
                    Validation found problems
                  </>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2">
                <CountCell label="Would import" value={report.imported} />
                <CountCell label="Would skip" value={report.skipped} />
                <CountCell label="Errors" value={report.errors.length} />
              </div>

              {report.errors.length > 0 && (
                <ul className="space-y-1 text-xs text-destructive">
                  {report.errors.map((issue, index) => (
                    <li key={`${issue.row ?? "n"}-${issue.field ?? "f"}-${index}`}>
                      {issue.row !== undefined ? `Row ${issue.row}: ` : ""}
                      {issue.field ? `${issue.field} — ` : ""}
                      {issue.message}
                    </li>
                  ))}
                </ul>
              )}

              <p className="text-xs text-muted-foreground">
                {report.database_modified === false
                  ? "The server confirmed no database rows were modified."
                  : "This was a validate-only request; the server did not report a modification count."}
              </p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

export default DryRunToggle;

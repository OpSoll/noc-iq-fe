import { useState } from "react";

import {
  toMttrMinutes,
  splitMttrMinutes,
  validateMttrMinutes,
  formatMttrSummary,
} from "@/lib/mttr";
import { previewSLA } from "@/services/sla";
import type { Severity } from "@/types/outages";
import type { SLAResult } from "@/types/sla";

interface ResolveModalProps {
  outageId: string;
  siteName: string;
  severity: Severity;
  initialMttrMinutes?: number;
  isOpen: boolean;
  isResolving: boolean;
  error?: string | null;
  onClose: () => void;
  onConfirmResolve: (mttrMinutes: number) => Promise<void>;
}

export function ResolveOutageModal({
  outageId,
  siteName,
  severity,
  initialMttrMinutes,
  isOpen,
  isResolving,
  error,
  onClose,
  onConfirmResolve,
}: ResolveModalProps) {
  const [mttrInput, setMttrInput] = useState(
    initialMttrMinutes !== undefined ? initialMttrMinutes.toString() : "",
  );
  const initialParts = splitMttrMinutes(initialMttrMinutes);
  const [hoursInput, setHoursInput] = useState(
    initialMttrMinutes !== undefined ? initialParts.hours.toString() : "",
  );
  const [minutesInput, setMinutesInput] = useState(
    initialMttrMinutes !== undefined ? initialParts.minutes.toString() : "",
  );
  const [validationError, setValidationError] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewResult, setPreviewResult] = useState<SLAResult | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);

  const [step, setStep] = useState<"form" | "preview">("form");

  if (!isOpen) {
    return null;
  }

  const totalMinutes = mttrInput.trim() === "" ? NaN : Number(mttrInput);
  const hasDurationInput =
    mttrInput.trim() !== "" || hoursInput.trim() !== "" || minutesInput.trim() !== "";
  // Only hint once the user has typed something — an untouched form shouldn't look invalid.
  const durationHint = hasDurationInput ? validateMttrMinutes(totalMinutes).error : null;

  function clearPreview() {
    setPreviewResult(null);
    setPreviewError(null);
  }

  /** Hours/minutes drive the raw-minutes field. */
  function applyDurationParts(nextHours: string, nextMinutes: string) {
    setHoursInput(nextHours);
    setMinutesInput(nextMinutes);

    const total = toMttrMinutes(nextHours, nextMinutes);
    setMttrInput(Number.isNaN(total) ? "" : total.toString());
    setValidationError(null);
    clearPreview();
  }

  /** Raw minutes drive the hours/minutes fields, keeping all three in sync. */
  function applyRawMinutes(value: string) {
    setMttrInput(value);

    const parsed = Number(value);
    if (value.trim() === "" || !Number.isFinite(parsed) || parsed <= 0) {
      setHoursInput("");
      setMinutesInput("");
    } else {
      const parts = splitMttrMinutes(parsed);
      setHoursInput(parts.hours.toString());
      setMinutesInput(parts.minutes.toString());
    }

    setValidationError(null);
    clearPreview();
  }

  async function handleResolve() {
    const parsed = Number(mttrInput);
    const check = validateMttrMinutes(mttrInput.trim() === "" ? NaN : parsed);
    if (!check.valid) {
      setValidationError(check.error);
      return;
    }

    setValidationError(null);
    await onConfirmResolve(parsed);
  }

  async function handlePreview() {
    const parsed = Number(mttrInput);
    const check = validateMttrMinutes(mttrInput.trim() === "" ? NaN : parsed);
    if (!check.valid) {
      setValidationError(check.error);
      return;
    }

    setValidationError(null);
    setPreviewError(null);
    setIsPreviewLoading(true);

    try {
      const result = await previewSLA({
        severity,
        mttr_minutes: parsed,
      });
      setPreviewResult(result);
      setStep("preview");
    } catch (issue) {
      setPreviewError(issue instanceof Error ? issue.message : "Failed to preview SLA.");
    } finally {
      setIsPreviewLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold text-slate-900">Resolve outage</h2>
          <p className="text-sm text-slate-500">
            Confirm the MTTR for <span className="font-medium text-slate-700">{siteName}</span> and
            resolve outage <span className="font-medium text-slate-700">{outageId}</span>.
          </p>
        </div>

        <div className="mt-6 space-y-4">
          {step === "form" ? (
            <>
              <fieldset className="rounded-xl border border-slate-200 p-4">
                <legend className="px-1 text-sm font-medium text-slate-700">
                  Duration calculator
                </legend>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="resolve-outage-hours"
                      className="mb-2 block text-sm font-medium text-slate-700"
                    >
                      Hours
                    </label>
                    <input
                      id="resolve-outage-hours"
                      type="number"
                      min={0}
                      step={1}
                      value={hoursInput}
                      onChange={(event) => applyDurationParts(event.target.value, minutesInput)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="resolve-outage-minutes"
                      className="mb-2 block text-sm font-medium text-slate-700"
                    >
                      Minutes
                    </label>
                    <input
                      id="resolve-outage-minutes"
                      type="number"
                      min={0}
                      step={1}
                      value={minutesInput}
                      onChange={(event) => applyDurationParts(hoursInput, event.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                      placeholder="0"
                    />
                  </div>
                </div>
                <p className="mt-3 text-sm text-slate-500" aria-live="polite">
                  Total MTTR:{" "}
                  <span className="font-medium text-slate-900">
                    {formatMttrSummary(totalMinutes)}
                  </span>
                </p>
              </fieldset>

              <div>
                <label
                  htmlFor="resolve-outage-mttr"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  Mean time to resolve (minutes)
                </label>
                <input
                  id="resolve-outage-mttr"
                  type="number"
                  min={1}
                  value={mttrInput}
                  onChange={(event) => applyRawMinutes(event.target.value)}
                  aria-invalid={durationHint ? true : undefined}
                  aria-describedby={durationHint ? "resolve-outage-mttr-hint" : undefined}
                  className={`w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 ${
                    durationHint
                      ? "border-red-300 focus:border-red-500 focus:ring-red-100"
                      : "border-slate-200 focus:border-blue-500 focus:ring-blue-100"
                  }`}
                  placeholder="Enter MTTR in minutes"
                />
                {durationHint ? (
                  <p id="resolve-outage-mttr-hint" className="mt-2 text-sm text-red-600">
                    {durationHint}
                  </p>
                ) : (
                  <p className="mt-2 text-xs text-slate-500">
                    Editing hours or minutes above updates this total automatically.
                  </p>
                )}
              </div>

              {validationError ? (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                  {validationError}
                </div>
              ) : null}

              {error ? (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                  {error}
                </div>
              ) : null}

              {previewError ? (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                  {previewError}
                </div>
              ) : null}
            </>
          ) : (
            <>
              {previewResult ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <h3 className="text-sm font-semibold text-slate-900">SLA outcome preview</h3>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-lg bg-white px-3 py-2">
                      <div className="text-xs uppercase tracking-wide text-slate-500">Status</div>
                      <div className="mt-1 text-sm font-medium text-slate-900">
                        {previewResult.status}
                      </div>
                    </div>
                    <div className="rounded-lg bg-white px-3 py-2">
                      <div className="text-xs uppercase tracking-wide text-slate-500">Rating</div>
                      <div className="mt-1 text-sm font-medium text-slate-900">
                        {previewResult.rating}
                      </div>
                    </div>
                    <div className="rounded-lg bg-white px-3 py-2">
                      <div className="text-xs uppercase tracking-wide text-slate-500">Threshold</div>
                      <div className="mt-1 text-sm font-medium text-slate-900">
                        {previewResult.threshold_minutes} min
                      </div>
                    </div>
                    <div className="rounded-lg bg-white px-3 py-2">
                      <div className="text-xs uppercase tracking-wide text-slate-500">Payout</div>
                      <div
                        className={`mt-1 text-sm font-medium ${
                          previewResult.amount >= 0 ? "text-emerald-600" : "text-red-600"
                        }`}
                      >
                        {previewResult.amount >= 0 ? "+" : ""}
                        {previewResult.amount} ({previewResult.payment_type})
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </div>

        <div className="mt-6 flex justify-end gap-3">
          {step === "form" ? (
            <>
              <button
                onClick={() => {
                  onClose();
                  setStep("form");
                }}
                disabled={isResolving}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                onClick={handlePreview}
                disabled={isResolving || isPreviewLoading}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {isPreviewLoading ? "Previewing..." : "Review resolution"}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setStep("form")}
                disabled={isResolving}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                Back
              </button>
              <button
                onClick={handleResolve}
                disabled={isResolving}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {isResolving ? "Resolving..." : "Confirm resolution"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}


"use client";

/**
 * SLA result re-simulation (opsoll/noc-iq-fe#498).
 *
 * Lets auditors re-run the SLA calculation (the backend mirrors the Soroban
 * contract call via /sla/preview) with a modified MTTR, and compares the
 * simulated penalty amount side by side with the original SLA result.
 */

import { useState } from "react";

import Modal from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { previewSLA } from "@/services/sla";
import type { SLAResult } from "@/types/sla";

interface SLAReSimulateModalProps {
  isOpen: boolean;
  onClose: () => void;
  outageId: string;
  severity: string;
  /** Original (finalized) SLA result attached to the outage, if present. */
  originalResult: SLAResult | null;
}

export default function SLAReSimulateModal({
  isOpen,
  onClose,
  outageId,
  severity,
  originalResult,
}: SLAReSimulateModalProps) {
  const [mttr, setMttr] = useState<number | "">(
    originalResult?.mttr_minutes ?? "",
  );
  const [simulated, setSimulated] = useState<SLAResult | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const original = originalResult ?? null;

  const runSimulation = async () => {
    setError(null);

    const mttrMinutes = Number(mttr);
    if (mttr === "" || Number.isNaN(mttrMinutes)) {
      setError("Enter MTTR minutes to re-simulate.");
      return;
    }
    if (mttrMinutes < 0) {
      setError("MTTR minutes cannot be negative.");
      return;
    }

    setRunning(true);
    try {
      // The preview endpoint runs the contract-equivalent SLA calculation
      // against the supplied inputs without persisting anything.
      const result = await previewSLA({
        severity,
        mttr_minutes: mttrMinutes,
      });
      setSimulated(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Simulation failed.");
    } finally {
      setRunning(false);
    }
  };

  const penaltyDelta =
    simulated && original ? simulated.amount - original.amount : null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Re-simulate SLA Calculation"
      maxWidth="max-w-2xl"
    >
      <div className="space-y-4">
        <p className="text-xs text-slate-500">
          Re-runs the SLA contract calculation with a modified MTTR for outage{" "}
          <span className="font-mono">{outageId}</span>. Simulation results are
          informational only and are not persisted.
        </p>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-1.5">
            <label
              htmlFor="resimulate-mttr"
              className="text-sm font-medium text-slate-700"
            >
              Modified MTTR (minutes)
            </label>
            <input
              id="resimulate-mttr"
              type="number"
              min={0}
              value={mttr}
              onChange={(e) => {
                setMttr(e.target.value === "" ? "" : Number(e.target.value));
                setError(null);
              }}
              placeholder="MTTR in minutes..."
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
              disabled={running}
            />
          </div>

          <Button onClick={runSimulation} disabled={running}>
            {running ? "Simulating..." : "Re-simulate SLA Calculation"}
          </Button>
        </div>

        {error ? <p className="text-xs text-red-600">{error}</p> : null}

        {simulated && (
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Original vs simulated
            </p>
            <div className="overflow-hidden rounded-lg border border-slate-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-3 py-2 font-medium">Metric</th>
                    <th className="px-3 py-2 font-medium">Original</th>
                    <th className="px-3 py-2 font-medium">Simulated</th>
                  </thead>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr>
                    <td className="px-3 py-2 text-slate-600">MTTR (min)</td>
                    <td className="px-3 py-2 font-mono">
                      {original?.mttr_minutes ?? "—"}
                    </td>
                    <td className="px-3 py-2 font-mono">
                      {simulated.mttr_minutes}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 text-slate-600">Status</td>
                    <td className="px-3 py-2">{original?.status ?? "—"}</td>
                    <td className="px-3 py-2">{simulated.status}</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 text-slate-600">
                      Amount {original?.payment_type ?? simulated.payment_type}
                    </td>
                    <td className="px-3 py-2 font-mono">
                      {original?.amount ?? "—"}
                    </td>
                    <td
                      className={`px-3 py-2 font-mono font-semibold ${
                        penaltyDelta !== null && penaltyDelta !== 0
                          ? "text-amber-700"
                          : "text-slate-900"
                      }`}
                    >
                      {simulated.amount}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 text-slate-600">Rating</td>
                    <td className="px-3 py-2">{original?.rating ?? "—"}</td>
                    <td className="px-3 py-2">{simulated.rating}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {penaltyDelta !== null && penaltyDelta !== 0 ? (
              <p className="text-xs text-amber-700">
                Simulated{" "}
                {simulated.payment_type === "penalty" ? "penalty" : "reward"}{" "}
                differs from the original by{" "}
                <span className="font-mono font-semibold">{penaltyDelta}</span>.
              </p>
            ) : (
              <p className="text-xs text-green-700">
                Simulated amount matches the original SLA result.
              </p>
            )}
          </div>
        )}

        <div className="flex justify-end pt-1">
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
}

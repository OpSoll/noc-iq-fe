import { useMemo, useState } from "react";
// Closes #359: bulk outage selection and batch status update workflow
// Closes #361: payment reconciliation status badge

export function useBulkSelection<T extends string>() {
  const [selected, setSelected] = useState<Set<T>>(new Set());

  function toggle(id: T) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll(ids: T[]) {
    setSelected((prev) => (prev.size === ids.length ? new Set() : new Set(ids)));
  }

  function clear() {
    setSelected(new Set());
  }

  return { selected, toggle, toggleAll, clear, count: selected.size };
}

export type ReconciliationState = "pending" | "matched" | "mismatched" | "manual_review";

const RECONCILIATION_STYLE: Record<ReconciliationState, string> = {
  pending: "bg-slate-600 text-slate-50",
  matched: "bg-green-800 text-green-50",
  mismatched: "bg-red-900 text-red-50",
  manual_review: "bg-amber-800 text-amber-50",
};

export function useReconciliationBadge(state: ReconciliationState) {
  const className = useMemo(() => RECONCILIATION_STYLE[state], [state]);
  const drillDownEnabled = state === "mismatched" || state === "manual_review";
  return { className, drillDownEnabled, label: state.replace("_", " ") };
}

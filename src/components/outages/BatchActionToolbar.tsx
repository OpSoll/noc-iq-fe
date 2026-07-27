"use client";

import { Button } from "@/components/ui/button";
import {
  CheckIcon,
  RefreshCwIcon,
} from "@/components/ui/icons";
import type { BatchOperation } from "@/features/outages/hooks/useBatchOperations";

/* -------------------------------------------------------------------------- */
/*                                    Types                                   */
/* -------------------------------------------------------------------------- */

interface BatchActionToolbarProps {
  selectedCount: number;
  isExecuting: boolean;
  onAcknowledge: () => void;
  onResolve: () => void;
  onRecalculateSLA: () => void;
  onClearSelection: () => void;
}

/* -------------------------------------------------------------------------- */
/*                                 Component                                  */
/* -------------------------------------------------------------------------- */

export function BatchActionToolbar({
  selectedCount,
  isExecuting,
  onAcknowledge,
  onResolve,
  onRecalculateSLA,
  onClearSelection,
}: BatchActionToolbarProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="sticky top-0 z-40 -mx-6 -mt-6 mb-6 rounded-b-xl border-b border-blue-200 bg-blue-50/95 px-6 py-3 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-blue-50/80">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Selection info */}
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
            {selectedCount}
          </div>
          <div>
            <p className="text-sm font-medium text-blue-900">
              {selectedCount} outage{selectedCount !== 1 ? "s" : ""} selected
            </p>
            <p className="text-xs text-blue-600">
              Select batch action to perform
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onAcknowledge}
            disabled={isExecuting}
            className="border-blue-200 bg-white text-blue-700 hover:bg-blue-100 hover:text-blue-800"
          >
            <CheckIcon className="h-4 w-4" />
            Acknowledge
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={onResolve}
            disabled={isExecuting}
            className="border-blue-200 bg-white text-blue-700 hover:bg-blue-100 hover:text-blue-800"
          >
            <CheckIcon className="h-4 w-4" />
            Resolve
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={onRecalculateSLA}
            disabled={isExecuting}
            className="border-blue-200 bg-white text-blue-700 hover:bg-blue-100 hover:text-blue-800"
          >
            <RefreshCwIcon className="h-4 w-4" />
            Recalculate SLA
          </Button>

          <div className="mx-1 h-6 w-px bg-blue-200" />

          <Button
            variant="ghost"
            size="sm"
            onClick={onClearSelection}
            disabled={isExecuting}
            className="text-blue-600 hover:bg-blue-100 hover:text-blue-700"
          >
            Clear
          </Button>
        </div>
      </div>
    </div>
  );
}

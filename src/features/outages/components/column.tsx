import React, { useState, useCallback, useRef } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Outage } from "@/types/outages";

/* -------------------------------------------------------------------------- */
/*                          Selection Checkbox Column                         */
/* -------------------------------------------------------------------------- */

/**
 * Creates a selection column with checkbox and Shift+click range selection.
 *
 * Usage:
 *   const selCol = selectionColumn({ getRowId, rowSelection, onRowSelectionChange });
 *   columns = [selCol, ...outageColumns];
 */
export function selectionColumn(options: {
  getRowId: (row: Outage) => string;
  rowSelection: Record<string, boolean>;
  onRowSelectionChange: (selection: Record<string, boolean>) => void;
}): ColumnDef<Outage> {
  const lastClickedRef = { current: -1 };

  return {
    id: "select",
    header: ({ table }) => (
      <input
        type="checkbox"
        className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
        checked={table.getIsAllRowsSelected()}
        indeterminate={table.getIsSomeRowsSelected()}
        onChange={table.getToggleAllRowsSelectedHandler()}
        aria-label="Select all"
      />
    ),
    cell: ({ row, table }) => {
      const rowId = options.getRowId(row.original);
      const isSelected = !!options.rowSelection[rowId];
      // Store a ref to the row index for shift-click
      const rowIndex = row.index;

      const handleCheckboxChange = useCallback(
        (e: React.MouseEvent | React.ChangeEvent) => {
          // Get the native event to check for shift key
          const nativeEvent = e.nativeEvent as MouseEvent;
          if (nativeEvent.shiftKey && lastClickedRef.current !== -1) {
            // Range selection
            const start = Math.min(lastClickedRef.current, rowIndex);
            const end = Math.max(lastClickedRef.current, rowIndex);
            const rows = table.getRowModel().rows;
            const newSelection: Record<string, boolean> = { ...options.rowSelection };

            // Toggle based on the last clicked state
            const wasLastSelected = !!options.rowSelection[
              options.getRowId(rows[lastClickedRef.current]?.original)
            ];
            const newState = !wasLastSelected;

            for (let i = start; i <= end; i++) {
              const id = options.getRowId(rows[i]?.original);
              if (id) {
                newSelection[id] = newState;
              }
            }
            options.onRowSelectionChange(newSelection);
          } else {
            lastClickedRef.current = rowIndex;
            row.getToggleSelectedHandler()(e);
          }
        },
        [row, rowIndex, table, options],
      );

      return (
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          checked={isSelected}
          onChange={handleCheckboxChange}
          onClick={(e) => {
            // Stop propagation so row click doesn't interfere
            e.stopPropagation();
          }}
          aria-label={`Select row ${rowIndex + 1}`}
        />
      );
    },
    enableSorting: false,
    enableHiding: false,
    size: 40,
  };
}

/* -------------------------------------------------------------------------- */
/*                         Action Cell (Recompute SLA)                        */
/* -------------------------------------------------------------------------- */

const ActionCell = ({ row }: { row: { original: Outage } }) => {
  const [isRecomputing, setIsRecomputing] = useState(false);
  const outage = row.original;

  const handleRecompute = async () => {
    setIsRecomputing(true);
    try {
      await api.post(`/outages/${outage.id}/recompute-sla`);

      // Invalidate queries via React Query or router refresh
    } catch (error) {
      console.error("Failed to recompute SLA:", error);
    } finally {
      setIsRecomputing(false);
    }
  };

  if (outage.status !== "resolved") {
    return null;
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleRecompute}
      disabled={isRecomputing}
    >
      {isRecomputing ? "Recomputing..." : "Recompute SLA"}
    </Button>
  );
};

/* -------------------------------------------------------------------------- */
/*                             Outage Table Columns                           */
/* -------------------------------------------------------------------------- */

export const columns: ColumnDef<Outage>[] = [
  { accessorKey: "id", header: "ID" },
  {
    accessorKey: "severity",
    header: "Severity",
    cell: ({ row }) => (
      <Badge variant="destructive">{row.original.severity}</Badge>
    ),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => (
      <Badge
        variant={row.original.status === "open" ? "destructive" : "default"}
      >
        {row.original.status}
      </Badge>
    ),
  },
  { accessorKey: "detected_at", header: "Detected" },
  { accessorKey: "resolved_at", header: "Resolved" },
  {
    id: "actions",
    header: "Actions",
    cell: ActionCell,
  },
];

'use client';

/**
 * ExportButton
 *
 * Exports whatever the outages table is currently showing — that is, the rows
 * the parent already filtered — as CSV or JSON, behind the same
 * `action:export-data` capability the row menu uses.
 *
 * The two halves are deliberately separated:
 * • `buildExportRows` / `toExportFile` are pure, so the exact bytes and file
 *   name an export produces can be asserted without touching the DOM.
 * • The component only performs the single side effect (a download) and then
 *   reports the outcome through `onExported` plus a polite live region, which
 *   keeps it free of the toast provider and trivial to embed in any table.
 *
 * Closes #618 – Outage Table: Add export button (CSV + JSON) for filtered rows
 */

import { useState } from 'react';
import { ChevronDown, Download } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { downloadJson, downloadText, toCsv } from '@/lib/urlSyncAndExport';
import { cn } from '@/lib/utils';
import type { Capability } from '@/services/capabilities';
import { useUIStore } from '@/store/uiStore';

// ─── Domain types ─────────────────────────────────────────────────────────────

/** Row shape every consumer of the table already holds. */
export interface ExportRow {
  id: string;
  title: string;
  severity: string;
  status: string;
  createdAt: string;
}

/** Formats the button offers, in menu order. */
export const EXPORT_FORMATS = ['csv', 'json'] as const;

export type ExportFormat = (typeof EXPORT_FORMATS)[number];

/** Menu label per format. */
export const EXPORT_FORMAT_LABEL: Record<ExportFormat, string> = {
  csv: 'Export as CSV',
  json: 'Export as JSON',
};

/** CSV header order; JSON keeps the same key order. */
export const OUTAGE_EXPORT_COLUMNS = [
  'ID',
  'Title',
  'Severity',
  'Status',
  'Created At',
] as const;

/** Capability required to export anything. */
export const EXPORT_CAPABILITY: Capability = 'action:export-data';

/** A ready-to-download file, as text plus its MIME type. */
export interface ExportFile {
  filename: string;
  content: string;
  mimeType: string;
}

/** What an export produced, handed to `onExported`. */
export interface ExportResult {
  format: ExportFormat;
  filename: string;
  rowCount: number;
}

// ─── Pure helpers ─────────────────────────────────────────────────────────────

/** Flattens rows into the export column order, timestamps as ISO strings. */
export function buildExportRows(rows: ExportRow[]): Record<string, unknown>[] {
  return rows.map((row) => ({
    ID: row.id,
    Title: row.title,
    Severity: row.severity,
    Status: row.status,
    'Created At': row.createdAt,
  }));
}

/**
 * Builds the file an export should produce. `baseName` is the stem shared by
 * both formats, so the caller passes `outages` and gets `outages.csv` or
 * `outages.json`.
 */
export function toExportFile(
  format: ExportFormat,
  rows: ExportRow[],
  baseName = 'outages'
): ExportFile {
  if (format === 'json') {
    return {
      filename: `${baseName}.json`,
      content: JSON.stringify(buildExportRows(rows), null, 2),
      mimeType: 'application/json;charset=utf-8;',
    };
  }

  return {
    filename: `${baseName}.csv`,
    content: toCsv(buildExportRows(rows)),
    mimeType: 'text/csv;charset=utf-8;',
  };
}

/** One-line summary announced after an export. */
export function formatExportSummary(result: ExportResult): string {
  const plural = result.rowCount === 1 ? '' : 's';
  return `Exported ${result.rowCount} outage${plural} to ${result.filename}.`;
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface ExportButtonProps {
  /** The rows to export — pass the already filtered set. */
  rows: ExportRow[];
  /** File name stem; the format extension is appended. */
  baseName?: string;
  /** Capabilities of the active role; defaults to useUIStore. */
  capabilities?: Capability[];
  /** Blocks the whole button, e.g. while a bulk mutation is in flight. */
  disabled?: boolean;
  /** Called after a successful download. */
  onExported?: (result: ExportResult) => void;
  /** Extra classes for the trigger button. */
  className?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * ExportButton
 *
 * A ghost/outline button that opens the format menu. The trigger is a real
 * button inside a Radix `DropdownMenu`, so the whole control is reachable with
 * Tab and operable with Enter, Space and the arrow keys.
 */
export function ExportButton({
  rows,
  baseName = 'outages',
  capabilities,
  disabled = false,
  onExported,
  className,
}: ExportButtonProps) {
  const storeCapabilities = useUIStore((state) => state.capabilities);
  const granted = capabilities ?? storeCapabilities;

  const [summary, setSummary] = useState('');

  const isEmpty = rows.length === 0;
  const permitted = granted.includes(EXPORT_CAPABILITY);

  /** Why the format items are unavailable, or `undefined` when they are. */
  function unavailableReason(): string | undefined {
    if (!permitted) {
      return `Requires the "${EXPORT_CAPABILITY}" capability.`;
    }
    if (isEmpty) return 'There are no outages to export.';
    return undefined;
  }

  function handleSelect(format: ExportFormat) {
    if (disabled || unavailableReason()) return;

    try {
      const file = toExportFile(format, rows, baseName);
      if (format === 'json') {
        downloadJson(file.filename, buildExportRows(rows));
      } else {
        downloadText(file.filename, file.content, file.mimeType);
      }

      const result: ExportResult = {
        format,
        filename: file.filename,
        rowCount: rows.length,
      };
      setSummary(formatExportSummary(result));
      onExported?.(result);
    } catch (error) {
      setSummary(
        error instanceof Error
          ? error.message
          : `Failed to export the outages as ${format.toUpperCase()}.`
      );
    }
  }

  return (
    <div className={cn('flex items-center', className)}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-label="Export outages"
            aria-haspopup="menu"
            disabled={disabled}
          >
            <Download className="h-4 w-4" />
            Export
            <ChevronDown className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel className="text-xs text-slate-500">
            {isEmpty
              ? 'No outages to export'
              : `${rows.length} outage${rows.length === 1 ? '' : 's'} ready`}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />

          {EXPORT_FORMATS.map((format) => {
            const reason = unavailableReason();

            return (
              <DropdownMenuItem
                key={format}
                disabled={disabled || reason !== undefined}
                title={reason}
                onSelect={() => handleSelect(format)}
              >
                {EXPORT_FORMAT_LABEL[format]}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      <p role="status" aria-live="polite" className="sr-only">
        {summary}
      </p>
    </div>
  );
}

'use client';

/**
 * ExportModal
 *
 * Dashboard data export summary dialog. Lets an operator pick which sections
 * (SLA compliance, outages/payouts, MTTR) end up in a client-side CSV or PDF
 * summary, and stamps the active date range + site filter into the report
 * header so the download is self-describing once it leaves the app.
 *
 * All report building is exported as pure functions (`buildReportHeader`,
 * `buildSummaryRows`, `toCsv`, `buildExportFilename`) so it can be unit tested
 * without a DOM. The PDF path reuses the same jsPDF drawing approach as
 * `src/lib/pdfExport.ts` — the charts are hand-rolled, so there is no canvas to
 * rasterise.
 *
 * Closes #609 – Dashboard: Add dashboard data export summary modal
 */

import { useCallback, useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import Modal from '@/components/ui/modal';
import { cn } from '@/lib/utils';
import type { MttrBucket } from '@/lib/mttrHistogram';
import type { DashboardFilters } from '@/services/dashboardService';
import type { DashboardMetrics } from '@/types/dashboard';

// ─── Domain types ─────────────────────────────────────────────────────────────

/** Report sections an operator can include or drop. */
export type ExportSection = 'sla' | 'outages' | 'mttr';

/** Download formats offered by the dialog. */
export type SummaryFormat = 'csv' | 'pdf';

export interface ExportSectionOption {
  /** Stable section id, also used as the checkbox value. */
  id: ExportSection;
  /** Human-readable checkbox label. */
  label: string;
  /** One-line explanation of what the section contains. */
  hint: string;
}

/** Selectable sections, in report order. */
export const EXPORT_SECTIONS: ExportSectionOption[] = [
  {
    id: 'sla',
    label: 'SLA compliance',
    hint: 'Compliance rate, compliant outages and violation count.',
  },
  {
    id: 'outages',
    label: 'Outages & payouts',
    hint: 'Penalty and reward totals, counts and net settlement balance.',
  },
  {
    id: 'mttr',
    label: 'MTTR distribution',
    hint: 'Resolved outages bucketed by mean time to resolution.',
  },
];

const SECTION_IDS = EXPORT_SECTIONS.map((section) => section.id);

/** Every section id, in report order. */
export const ALL_EXPORT_SECTIONS: ExportSection[] = SECTION_IDS;

/** Selectable download formats. */
export const SUMMARY_FORMATS: SummaryFormat[] = ['csv', 'pdf'];

// ─── Report building (pure) ───────────────────────────────────────────────────

/** Report column header, repeated for every generated file. */
export const SUMMARY_TABLE_HEADER = ['Section', 'Metric', 'Value'];

function formatCurrency(value: number): string {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatPercent(value: number): string {
  return value.toFixed(2);
}

function sectionLabel(section: ExportSection): string {
  return (
    EXPORT_SECTIONS.find((option) => option.id === section)?.label ?? section
  );
}

/**
 * Builds the metadata block that heads both formats: the selected date range
 * and site filter, so an exported report is unambiguous once detached from the
 * dashboard it came from.
 */
export function buildReportHeader({
  dateFrom,
  dateTo,
  site,
  generatedAt = new Date(),
}: {
  /** Inclusive lower bound of the reported window. */
  dateFrom?: string;
  /** Inclusive upper bound of the reported window. */
  dateTo?: string;
  /** Active site filter, or `undefined` for all sites. */
  site?: string;
  /** Timestamp stamped into the report; injected in tests. */
  generatedAt?: Date;
}): string[][] {
  return [
    ['NOC IQ dashboard export summary'],
    ['Date range', `${dateFrom || 'All time'} to ${dateTo || 'Present'}`],
    ['Site filter', site && site.length > 0 ? site : 'All sites'],
    ['Generated at', generatedAt.toISOString()],
  ];
}

/**
 * Flattens the selected sections into a single `Section | Metric | Value`
 * table. Unknown section ids are ignored, and the result is de-duplicated so a
 * duplicated id cannot double-count a total.
 */
export function buildSummaryRows(
  sections: ExportSection[],
  metrics: DashboardMetrics,
  mttrBuckets?: MttrBucket[]
): string[][] {
  const wanted = new Set(sections);
  const rows: string[][] = [];
  const netBalance = metrics.rewards.total - metrics.penalties.total;

  if (wanted.has('sla')) {
    const label = sectionLabel('sla');
    const compliance = formatPercent(metrics.sla_compliance_percentage);
    rows.push(
      [label, 'Compliance rate (%)', compliance],
      [label, 'Violations', String(metrics.penalties.count)],
      [label, 'Compliant outages', String(metrics.rewards.count)]
    );
  }

  if (wanted.has('outages')) {
    const label = sectionLabel('outages');
    rows.push(
      [label, 'Total penalties', formatCurrency(metrics.penalties.total)],
      [label, 'Penalty incidents', String(metrics.penalties.count)],
      [label, 'Total rewards', formatCurrency(metrics.rewards.total)],
      [label, 'Reward achievements', String(metrics.rewards.count)],
      [label, 'Net settlement balance', formatCurrency(netBalance)]
    );
  }

  if (wanted.has('mttr')) {
    const label = sectionLabel('mttr');
    const resolved = mttrBuckets ?? [];
    if (resolved.length === 0) {
      rows.push([label, 'Resolved outages', 'No data available']);
    } else {
      for (const bucket of resolved) {
        rows.push([label, bucket.label, String(bucket.count)]);
      }
      const total = resolved.reduce((sum, bucket) => sum + bucket.count, 0);
      rows.push([label, 'Total resolved outages', String(total)]);
    }
  }

  return rows;
}

/** RFC 4180 field quoting: only escape when the value requires it. */
function csvField(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const text = String(value);
  const needsQuotes =
    /[",\r\n]/.test(text) || text !== text.trim() || text.length === 0;
  return needsQuotes ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Serialises rows to an RFC 4180 CSV document (CRLF line endings). */
export function toCsv(rows: string[][]): string {
  return rows.map((row) => row.map(csvField).join(',')).join('\r\n');
}

/** Builds `dashboard-export-<yyyy-mm-dd>.<ext>` for the active window. */
export function buildExportFilename(
  format: SummaryFormat,
  filters: DashboardFilters = {},
  generatedAt: Date = new Date()
): string {
  const anchor =
    filters.date_to || filters.date_from || generatedAt.toISOString();
  const stamp = anchor.slice(0, 10);
  return `dashboard-export-${stamp}.${format}`;
}

// ─── Download plumbing ────────────────────────────────────────────────────────

/**
 * Triggers a client-side download from in-memory content and always releases
 * the object URL afterwards, mirroring `downloadCsv` in
 * `src/lib/urlSyncAndExport.ts`.
 */
export function downloadReport(
  content: string,
  filename: string,
  mimeType: string
): void {
  if (typeof document === 'undefined' || typeof URL === 'undefined') return;

  const blob = new Blob([content], { type: mimeType });
  let url: string | null = null;
  try {
    url = URL.createObjectURL(blob);
  } catch {
    return;
  }

  try {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
  } finally {
    URL.revokeObjectURL(url);
  }
}

// ─── PDF rendering ────────────────────────────────────────────────────────────

const PAGE_MARGIN_X = 40;
const PAGE_BOTTOM = 780;
const COL_SECTION = 40;
const COL_METRIC = 160;
const COL_VALUE = 400;

/** Renders the header + table rows to a PDF and saves it. */
export async function renderSummaryPdf(
  headerRows: string[][],
  tableRows: string[][],
  filename: string
): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  let y = 50;

  doc.setFontSize(16);
  doc.text(headerRows[0]?.[0] ?? 'Dashboard export summary', PAGE_MARGIN_X, y);
  y += 22;

  doc.setFontSize(9);
  doc.setTextColor(90, 90, 90);
  for (const row of headerRows.slice(1)) {
    doc.text(`${row[0] ?? ''}: ${row[1] ?? ''}`, PAGE_MARGIN_X, y);
    y += 13;
  }
  y += 14;

  doc.setTextColor(20, 20, 20);
  doc.setFontSize(11);
  for (const row of tableRows) {
    if (y > PAGE_BOTTOM) {
      doc.addPage();
      y = 50;
    }
    const [section, metric, value] = row;
    doc.setTextColor(90, 90, 90);
    doc.text(section ?? '', COL_SECTION, y);
    doc.text(metric ?? '', COL_METRIC, y);
    doc.setTextColor(20, 20, 20);
    doc.text(value ?? '', COL_VALUE, y);
    y += 16;
  }

  doc.save(filename);
}

// ─── Component ────────────────────────────────────────────────────────────────

export interface ExportModalProps {
  /** Whether the dialog is visible. */
  isOpen: boolean;
  /** Called on Escape, backdrop click, the close button or after export. */
  onClose: () => void;
  /** Metrics for the active dashboard filters. */
  metrics: DashboardMetrics;
  /** Active filters; the date range and site appear in the report header. */
  filters: DashboardFilters;
  /** MTTR histogram backing the MTTR section; omit when unavailable. */
  mttrBuckets?: MttrBucket[];
  /** Invoked with the generated filename once a download is triggered. */
  onExported?: (filename: string, format: SummaryFormat) => void;
}

const FORMAT_LABELS: Record<SummaryFormat, string> = {
  csv: 'CSV (.csv)',
  pdf: 'PDF (.pdf)',
};

export default function ExportModal({
  isOpen,
  onClose,
  metrics,
  filters,
  mttrBuckets,
  onExported,
}: ExportModalProps) {
  const [selected, setSelected] = useState<Set<ExportSection>>(
    () => new Set(ALL_EXPORT_SECTIONS)
  );
  const [format, setFormat] = useState<SummaryFormat>('csv');
  const [isExporting, setIsExporting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Reset to the defaults each time the dialog is opened so a cancelled
  // export does not leak its selection into the next one.
  useEffect(() => {
    if (!isOpen) return;
    setSelected(new Set(ALL_EXPORT_SECTIONS));
    setFormat('csv');
    setStatus(null);
    setError(null);
    setIsExporting(false);
  }, [isOpen]);

  const orderedSelection = useMemo(
    () => ALL_EXPORT_SECTIONS.filter((id) => selected.has(id)),
    [selected]
  );

  const rangeLabel = useMemo(() => {
    const from = filters.date_from || 'All time';
    const to = filters.date_to || 'Present';
    return `${from} to ${to}`;
  }, [filters.date_from, filters.date_to]);

  const siteLabel =
    filters.site && filters.site.length > 0 ? filters.site : 'All sites';

  const toggleSection = useCallback((section: ExportSection) => {
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  }, []);

  async function handleExport() {
    if (orderedSelection.length === 0) return;

    setIsExporting(true);
    setError(null);
    const generatedAt = new Date();
    const filename = buildExportFilename(format, filters, generatedAt);
    const headerRows = buildReportHeader({
      dateFrom: filters.date_from,
      dateTo: filters.date_to,
      site: filters.site,
      generatedAt,
    });
    const tableRows = [
      SUMMARY_TABLE_HEADER,
      ...buildSummaryRows(orderedSelection, metrics, mttrBuckets),
    ];

    try {
      if (format === 'csv') {
        downloadReport(
          toCsv([...headerRows, ...tableRows]),
          filename,
          'text/csv;charset=utf-8;'
        );
      } else {
        await renderSummaryPdf(headerRows, tableRows, filename);
      }
      setStatus(`Downloaded ${filename}`);
      onExported?.(filename, format);
      onClose();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Failed to build the export report.'
      );
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Export dashboard summary"
      maxWidth="max-w-xl"
    >
      <div className="space-y-5">
        <p className="text-sm text-slate-600">
          Pick the sections to include. The report header records the current
          filters so the download stays self-describing.
        </p>

        <dl className="grid grid-cols-2 gap-2 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
          <dt className="font-medium text-slate-500">Date range</dt>
          <dd>{rangeLabel}</dd>
          <dt className="font-medium text-slate-500">Site filter</dt>
          <dd>{siteLabel}</dd>
        </dl>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-slate-800">
            Report sections
          </legend>
          {EXPORT_SECTIONS.map((section) => {
            const inputId = `export-section-${section.id}`;
            return (
              <div
                key={section.id}
                className="flex items-start gap-3 rounded-lg border border-slate-200 p-3"
              >
                <input
                  id={inputId}
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus-visible:ring-2 focus-visible:ring-indigo-500"
                  checked={selected.has(section.id)}
                  onChange={() => toggleSection(section.id)}
                />
                <label htmlFor={inputId} className="text-sm">
                  <span className="block font-medium text-slate-800">
                    {section.label}
                  </span>
                  <span className="block text-xs text-slate-500">
                    {section.hint}
                  </span>
                </label>
              </div>
            );
          })}
        </fieldset>

        <fieldset>
          <legend className="text-sm font-medium text-slate-800">Format</legend>
          <div className="mt-2 flex gap-2">
            {SUMMARY_FORMATS.map((option) => {
              const inputId = `export-format-${option}`;
              return (
                <label
                  key={option}
                  htmlFor={inputId}
                  className={cn(
                    'flex flex-1 cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors',
                    format === option
                      ? 'border-blue-400 bg-blue-50 text-blue-800'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  )}
                >
                  <input
                    id={inputId}
                    type="radio"
                    name="export-format"
                    className="h-4 w-4 border-slate-300 text-blue-600 focus-visible:ring-2 focus-visible:ring-indigo-500"
                    checked={format === option}
                    onChange={() => setFormat(option)}
                  />
                  {FORMAT_LABELS[option]}
                </label>
              );
            })}
          </div>
        </fieldset>

        <p aria-live="polite" className="sr-only">
          {status ?? ''}
        </p>
        {error ? (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        ) : null}

        <div className="flex items-center justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => void handleExport()}
            disabled={isExporting || orderedSelection.length === 0}
          >
            {isExporting ? 'Preparing…' : `Download ${format.toUpperCase()}`}
          </Button>
        </div>
        {orderedSelection.length === 0 ? (
          <p className="text-xs text-slate-500">
            Select at least one section to download a report.
          </p>
        ) : null}
      </div>
    </Modal>
  );
}

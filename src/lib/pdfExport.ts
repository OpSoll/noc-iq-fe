// Closes #450: client-side PDF export of the SLA metrics summary.
//
// jsPDF is the only PDF-capable dependency already usable client-side without
// pulling in a DOM-screenshot library (html2canvas) — the dashboard's charts
// are hand-built with Tailwind/SVG, not canvas-rendered, so we redraw a
// print-optimized summary directly with jsPDF's own drawing primitives
// instead of rasterizing the live page.
import type { DashboardMetrics, TrendPoint } from '@/types/dashboard';
import type { DashboardFilters } from '@/services/dashboardService';
import { DEFAULT_SLA_COMPLIANCE_TARGET, isAboveTarget } from '@/lib/slaTarget';

/** Builds the `sla-report-<month>.pdf` filename from the active filter window. */
export function buildSlaReportFilename(
  filters: DashboardFilters,
  generatedAt: Date = new Date()
): string {
  const anchor =
    filters.date_to || filters.date_from || generatedAt.toISOString();
  const month = anchor.slice(0, 7); // YYYY-MM
  return `sla-report-${month}.pdf`;
}

function formatRangeLabel(filters: DashboardFilters): string {
  const from = filters.date_from || 'All time';
  const to = filters.date_to || 'Present';
  return `${from} → ${to}`;
}

export interface ExportSlaReportOptions {
  target?: number;
  generatedAt?: Date;
}

/**
 * Generates and triggers a client-side download of the monthly SLA
 * performance summary PDF: KPI summary + a redrawn compliance trend chart
 * with the same above/below-target coloring as the on-screen chart (#449).
 */
export async function exportSlaReportPdf(
  metrics: DashboardMetrics,
  filters: DashboardFilters,
  options: ExportSlaReportOptions = {}
): Promise<string> {
  const target = options.target ?? DEFAULT_SLA_COMPLIANCE_TARGET;
  const generatedAt = options.generatedAt ?? new Date();

  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const marginX = 40;
  let y = 50;

  doc.setFontSize(18);
  doc.text('SLA Performance Summary', marginX, y);
  y += 22;

  doc.setFontSize(10);
  doc.setTextColor(90, 90, 90);
  doc.text(`Reporting window: ${formatRangeLabel(filters)}`, marginX, y);
  y += 14;
  doc.text(`Generated: ${generatedAt.toLocaleString()}`, marginX, y);
  y += 28;

  // --- KPI summary ---
  doc.setTextColor(20, 20, 20);
  doc.setFontSize(13);
  doc.text('KPI Summary', marginX, y);
  y += 18;

  const netBalance = metrics.rewards.total - metrics.penalties.total;
  const kpiRows: [string, string][] = [
    [
      'SLA Compliance',
      `${metrics.sla_compliance_percentage.toFixed(1)}% (target ${target}%)`,
    ],
    [
      'Total Penalties',
      `$${metrics.penalties.total.toLocaleString()} (${metrics.penalties.count} incidents)`,
    ],
    [
      'Total Rewards',
      `$${metrics.rewards.total.toLocaleString()} (${metrics.rewards.count} achievements)`,
    ],
    [
      'Net Balance',
      `${netBalance >= 0 ? '+' : ''}$${netBalance.toLocaleString()}`,
    ],
  ];

  doc.setFontSize(11);
  for (const [label, value] of kpiRows) {
    doc.setTextColor(90, 90, 90);
    doc.text(label, marginX, y);
    doc.setTextColor(20, 20, 20);
    doc.text(value, marginX + 160, y);
    y += 18;
  }
  y += 16;

  // --- Compliance trend chart, redrawn to mirror the on-screen bars ---
  doc.setFontSize(13);
  doc.setTextColor(20, 20, 20);
  doc.text('SLA Compliance Trend', marginX, y);
  y += 10;

  const chartWidth = 515;
  const rowHeight = 16;
  const trends: TrendPoint[] = metrics.trends;

  if (trends.length === 0) {
    y += 18;
    doc.setFontSize(10);
    doc.setTextColor(120, 120, 120);
    doc.text('No trend data available for this window.', marginX, y);
  } else {
    const targetX = marginX + (target / 100) * chartWidth;
    for (const point of trends) {
      y += rowHeight;
      const pct = Math.max(0, Math.min(100, point.compliance_percentage));
      const barWidth = (pct / 100) * chartWidth;

      doc.setFontSize(8);
      doc.setTextColor(90, 90, 90);
      doc.text(`${point.period}  ${pct.toFixed(1)}%`, marginX, y - 4);

      // track
      doc.setFillColor(235, 235, 235);
      doc.rect(marginX, y, chartWidth, 6, 'F');

      // value bar, colored to match the on-screen threshold coloring
      if (isAboveTarget(pct, target)) {
        doc.setFillColor(34, 197, 94); // green-500
      } else {
        doc.setFillColor(239, 68, 68); // red-500
      }
      doc.rect(marginX, y, Math.max(barWidth, 1), 6, 'F');

      // dashed target threshold line
      doc.setDrawColor(71, 85, 105); // slate-600
      doc.setLineDashPattern([2, 2], 0);
      doc.line(targetX, y - 2, targetX, y + 8);
      doc.setLineDashPattern([], 0);
    }
  }

  const filename = buildSlaReportFilename(filters, generatedAt);
  doc.save(filename);
  return filename;
}

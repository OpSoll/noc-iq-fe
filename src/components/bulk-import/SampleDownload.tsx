/**
 * Issue #629 – Downloadable sample CSV template for bulk outage import.
 */

'use client';

/** Columns supported by the bulk outage importer. */
export const SAMPLE_CSV_HEADERS = [
  'service_id',
  'site_id',
  'start_time',
  'end_time',
  'severity',
  'description',
] as const;

/** Three sample rows demonstrating correct date and severity formats. */
export const SAMPLE_CSV_ROWS: string[][] = [
  [
    'svc-network-01',
    'site-nyc-01',
    '2026-03-15T08:00:00Z',
    '2026-03-15T10:30:00Z',
    'critical',
    'Core switch failure in NYC DC',
  ],
  [
    'svc-dns-02',
    'site-lon-03',
    '2026-03-16T14:00:00Z',
    '2026-03-16T14:45:00Z',
    'major',
    'DNS resolution latency spike',
  ],
  [
    'svc-api-gateway',
    'site-sfo-02',
    '2026-03-17T01:15:00Z',
    '2026-03-17T02:00:00Z',
    'minor',
    'Elevated 5xx rate on edge gateway',
  ],
];

const SAMPLE_COMMENTS = [
  '# NOC-IQ bulk outage import template',
  '# Required columns: service_id (or site_id), start_time, end_time',
  '# Dates must be ISO-8601 (e.g. 2026-03-15T08:00:00Z)',
  '# severity: critical | major | minor | warning (optional)',
  '# description: free-text summary (optional)',
  '# Remove comment lines (starting with #) before uploading if your parser does not strip them.',
];

/**
 * Build a CSV string with header comments, column headers, and sample rows.
 */
export function generateSampleCsv(): string {
  const escape = (cell: string) => {
    if (/[",\n\r]/.test(cell)) {
      return `"${cell.replace(/"/g, '""')}"`;
    }
    return cell;
  };

  const lines: string[] = [
    ...SAMPLE_COMMENTS,
    SAMPLE_CSV_HEADERS.join(','),
    ...SAMPLE_CSV_ROWS.map((row) => row.map(escape).join(',')),
  ];
  return lines.join('\n') + '\n';
}

/**
 * Trigger a browser download of the sample CSV template.
 */
export function downloadSampleCsv(
  filename = 'noc-iq-outage-import-sample.csv'
): void {
  const csv = generateSampleCsv();
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export interface SampleDownloadProps {
  className?: string;
}

export function SampleDownload({ className }: SampleDownloadProps) {
  return (
    <button
      type="button"
      onClick={() => downloadSampleCsv()}
      className={
        className ??
        'inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500'
      }
      data-testid="download-sample-csv"
    >
      <svg
        className="h-4 w-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
        />
      </svg>
      Download Sample CSV
    </button>
  );
}

export default SampleDownload;

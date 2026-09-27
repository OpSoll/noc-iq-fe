import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import ExportModal, {
  ALL_EXPORT_SECTIONS,
  EXPORT_SECTIONS,
  SUMMARY_TABLE_HEADER,
  buildExportFilename,
  buildReportHeader,
  buildSummaryRows,
  toCsv,
  type ExportSection,
} from './ExportModal';
import type { MttrBucket } from '@/lib/mttrHistogram';
import type { DashboardMetrics } from '@/types/dashboard';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const METRICS: DashboardMetrics = {
  sla_compliance_percentage: 92.5,
  penalties: { total: 1200.5, count: 4 },
  rewards: { total: 3400, count: 40 },
  trends: [],
};

const FILTERS = {
  date_from: '2026-01-01',
  date_to: '2026-01-31',
  site: 'site-alpha',
};

const MTTR_BUCKETS: MttrBucket[] = [
  { key: 'lt15', label: '<15m', min: 0, max: 15, count: 3 },
  { key: '15to30', label: '15-30m', min: 15, max: 30, count: 2 },
  { key: '30to60', label: '30-60m', min: 30, max: 60, count: 1 },
  { key: 'gt60', label: '>60m', min: 60, max: null, count: 0 },
];

const saveMock = vi.fn();

vi.mock('jspdf', () => ({
  jsPDF: class {
    setFontSize = vi.fn();
    setTextColor = vi.fn();
    text = vi.fn();
    addPage = vi.fn();
    save = saveMock;
  },
}));

// ─── buildReportHeader ────────────────────────────────────────────────────────

describe('buildReportHeader', () => {
  const generatedAt = new Date('2026-02-03T04:05:06.000Z');

  it('leads with the report title', () => {
    const rows = buildReportHeader({ generatedAt });
    expect(rows[0]).toEqual(['NOC IQ dashboard export summary']);
  });

  it('includes the selected date range and site filter', () => {
    const rows = buildReportHeader({
      dateFrom: '2026-01-01',
      dateTo: '2026-01-31',
      site: 'site-a',
      generatedAt,
    });
    expect(rows).toContainEqual(['Date range', '2026-01-01 to 2026-01-31']);
    expect(rows).toContainEqual(['Site filter', 'site-a']);
    expect(rows).toContainEqual(['Generated at', generatedAt.toISOString()]);
  });

  it('falls back to readable labels for open filters', () => {
    const rows = buildReportHeader({ site: '', generatedAt });
    expect(rows).toContainEqual(['Date range', 'All time to Present']);
    expect(rows).toContainEqual(['Site filter', 'All sites']);
  });
});

// ─── buildSummaryRows ─────────────────────────────────────────────────────────

describe('buildSummaryRows', () => {
  it('returns nothing when no section is selected', () => {
    expect(buildSummaryRows([], METRICS)).toEqual([]);
  });

  it('emits only the SLA section when SLA alone is selected', () => {
    const rows = buildSummaryRows(['sla'], METRICS);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toEqual([
      'SLA compliance',
      'Compliance rate (%)',
      '92.50',
    ]);
    expect(rows.every((row) => row[0] === 'SLA compliance')).toBe(true);
  });

  it('includes the net settlement balance in the outages section', () => {
    const rows = buildSummaryRows(['outages'], METRICS);
    const net = rows.find((row) => row[1] === 'Net settlement balance');
    // 3400 - 1200.50 = 2199.50
    expect(net?.[2]).toBe('2,199.50');
  });

  it('summarises every MTTR bucket plus a total', () => {
    const rows = buildSummaryRows(['mttr'], METRICS, MTTR_BUCKETS);
    expect(rows.map((row) => row[1])).toEqual([
      '<15m',
      '15-30m',
      '30-60m',
      '>60m',
      'Total resolved outages',
    ]);
    expect(rows[4][2]).toBe('6');
  });

  it('degrades gracefully when MTTR data is missing', () => {
    const rows = buildSummaryRows(['mttr'], METRICS);
    expect(rows).toEqual([
      ['MTTR distribution', 'Resolved outages', 'No data available'],
    ]);
  });

  it('ignores duplicate and unknown sections', () => {
    const rows = buildSummaryRows(
      ['sla', 'sla', 'nope' as ExportSection],
      METRICS
    );
    expect(rows).toHaveLength(3);
  });

  it('covers all three sections in declaration order', () => {
    const rows = buildSummaryRows(ALL_EXPORT_SECTIONS, METRICS, MTTR_BUCKETS);
    expect(rows[0][0]).toBe('SLA compliance');
    expect(rows[3][0]).toBe('Outages & payouts');
    expect(rows[8][0]).toBe('MTTR distribution');
  });
});

// ─── toCsv ────────────────────────────────────────────────────────────────────

describe('toCsv', () => {
  it('joins cells with commas and CRLF line endings', () => {
    expect(toCsv([['a', 'b'], ['c', 'd']])).toBe('a,b\r\nc,d');
  });

  it('quotes fields containing a comma', () => {
    expect(toCsv([['x', '1,200.50']])).toBe('x,"1,200.50"');
  });

  it('doubles embedded quotes per RFC 4180', () => {
    expect(toCsv([['say "hi"']])).toBe('"say ""hi"""');
  });

  it('quotes fields containing newlines', () => {
    expect(toCsv([['line1\nline2']])).toBe('"line1\nline2"');
  });

  it('returns an empty string for no rows', () => {
    expect(toCsv([])).toBe('');
  });

  it('serialises a full report header plus table', () => {
    const header = buildReportHeader({
      dateFrom: '2026-01-01',
      dateTo: '2026-01-31',
      site: 'site-a',
      generatedAt: new Date('2026-02-03T04:05:06.000Z'),
    });
    const csv = toCsv([...header, SUMMARY_TABLE_HEADER]);
    expect(csv.split('\r\n')).toHaveLength(5);
    expect(csv).toContain('Date range,2026-01-01 to 2026-01-31');
  });
});

// ─── buildExportFilename ──────────────────────────────────────────────────────

describe('buildExportFilename', () => {
  it('uses the filtered end date', () => {
    expect(buildExportFilename('csv', FILTERS)).toBe(
      'dashboard-export-2026-01-31.csv'
    );
  });

  it('falls back to the generation date when unfiltered', () => {
    expect(
      buildExportFilename('pdf', {}, new Date('2026-11-02T00:00:00Z'))
    ).toBe('dashboard-export-2026-11-02.pdf');
  });
});

// ─── Component ────────────────────────────────────────────────────────────────

describe('ExportModal', () => {
  const createObjectURL = vi.fn(() => 'blob:report');
  const revokeObjectURL = vi.fn();
  let clickSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    saveMock.mockClear();
    createObjectURL.mockClear();
    revokeObjectURL.mockClear();
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });
    // jsdom cannot navigate to an object URL, so intercept the synthetic click.
    clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    clickSpy.mockRestore();
  });

  function renderModal(props: Partial<Parameters<typeof ExportModal>[0]> = {}) {
    return render(
      <ExportModal
        isOpen
        onClose={vi.fn()}
        metrics={METRICS}
        filters={FILTERS}
        mttrBuckets={MTTR_BUCKETS}
        {...props}
      />
    );
  }

  it('renders nothing while closed', () => {
    renderModal({ isOpen: false });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('renders the dialog with all sections selected by default', () => {
    renderModal();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    for (const section of EXPORT_SECTIONS) {
      expect(
        screen.getByRole('checkbox', { name: new RegExp(section.label) })
      ).toBeChecked();
    }
  });

  it('shows the active date range and site filter', () => {
    renderModal();
    expect(screen.getByText('2026-01-01 to 2026-01-31')).toBeInTheDocument();
    expect(screen.getByText('site-alpha')).toBeInTheDocument();
  });

  it('disables the download when every section is deselected', async () => {
    const user = userEvent.setup();
    renderModal();

    for (const section of EXPORT_SECTIONS) {
      await user.click(
        screen.getByRole('checkbox', { name: new RegExp(section.label) })
      );
    }

    expect(
      screen.getByRole('button', { name: /download csv/i })
    ).toBeDisabled();
    expect(
      screen.getByText('Select at least one section to download a report.')
    ).toBeInTheDocument();
  });

  it('re-checks a section when clicked again', async () => {
    const user = userEvent.setup();
    renderModal();

    const sla = screen.getByRole('checkbox', { name: /SLA compliance/ });
    await user.click(sla);
    expect(sla).not.toBeChecked();
    await user.click(sla);
    expect(sla).toBeChecked();
  });

  it('switches the download button label with the format toggle', async () => {
    const user = userEvent.setup();
    renderModal();

    expect(
      screen.getByRole('button', { name: /download csv/i })
    ).toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: /PDF/ }));
    expect(
      screen.getByRole('button', { name: /download pdf/i })
    ).toBeInTheDocument();
  });

  it('triggers a CSV download containing the range and site', async () => {
    const user = userEvent.setup();
    const onExported = vi.fn();
    const onClose = vi.fn();
    renderModal({ onExported, onClose });

    await user.click(screen.getByRole('checkbox', { name: /MTTR/ }));
    await user.click(screen.getByRole('button', { name: /download csv/i }));

    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(clickSpy).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:report');
    expect(onExported).toHaveBeenCalledWith(
      'dashboard-export-2026-01-31.csv',
      'csv'
    );
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('saves a PDF through jsPDF when the PDF format is chosen', async () => {
    const user = userEvent.setup();
    const onExported = vi.fn();
    renderModal({ onExported });

    await user.click(screen.getByRole('radio', { name: /PDF/ }));
    await user.click(screen.getByRole('button', { name: /download pdf/i }));

    await waitFor(() => expect(saveMock).toHaveBeenCalledOnce());
    expect(saveMock).toHaveBeenCalledWith('dashboard-export-2026-01-31.pdf');
    expect(createObjectURL).not.toHaveBeenCalled();
    expect(onExported).toHaveBeenCalledWith(
      'dashboard-export-2026-01-31.pdf',
      'pdf'
    );
  });

  it('resets the selection after closing and reopening', async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <ExportModal
        isOpen
        onClose={vi.fn()}
        metrics={METRICS}
        filters={FILTERS}
        mttrBuckets={MTTR_BUCKETS}
      />
    );

    const sla = screen.getByRole('checkbox', { name: /SLA compliance/ });
    await user.click(sla);
    expect(sla).not.toBeChecked();

    rerender(
      <ExportModal
        isOpen={false}
        onClose={vi.fn()}
        metrics={METRICS}
        filters={FILTERS}
        mttrBuckets={MTTR_BUCKETS}
      />
    );
    rerender(
      <ExportModal
        isOpen
        onClose={vi.fn()}
        metrics={METRICS}
        filters={FILTERS}
        mttrBuckets={MTTR_BUCKETS}
      />
    );

    expect(
      screen.getByRole('checkbox', { name: /SLA compliance/ })
    ).toBeChecked();
  });
});

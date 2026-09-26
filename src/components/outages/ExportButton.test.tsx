import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { UserEvent } from '@testing-library/user-event';

import {
  EXPORT_FORMAT_LABEL,
  EXPORT_FORMATS,
  ExportButton,
  buildExportRows,
  formatExportSummary,
  toExportFile,
  type ExportRow,
} from '@/components/outages/ExportButton';
import { downloadJson, downloadText } from '@/lib/urlSyncAndExport';
import { useUIStore } from '@/store/uiStore';

vi.mock('@/lib/urlSyncAndExport', async (importOriginal) => {
  const actual = await importOriginal<
    typeof import('@/lib/urlSyncAndExport')
  >();
  return { ...actual, downloadText: vi.fn(), downloadJson: vi.fn() };
});

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const ROWS: ExportRow[] = [
  {
    id: 'out-1',
    title: 'Lagos Core POP',
    severity: 'critical',
    status: 'open',
    createdAt: '2026-03-04T08:30:00.000Z',
  },
  {
    id: 'out-2',
    title: 'Abuja Backbone',
    severity: 'medium',
    status: 'resolved',
    createdAt: '2026-03-03T19:00:00.000Z',
  },
];

const GRANTED = ['action:export-data'];

let user: UserEvent;

beforeEach(() => {
  user = userEvent.setup();
  vi.mocked(downloadText).mockClear();
  vi.mocked(downloadJson).mockClear();
  useUIStore.setState({ role: 'admin', capabilities: GRANTED });
});

/**
 * Opens the format menu. Radix toggles it on `pointerdown`, so a jsdom without
 * `PointerEvent` only answers the keyboard path.
 */
async function openMenu() {
  await user.click(screen.getByRole('button', { name: 'Export outages' }));
  if (screen.queryByRole('menu') === null) {
    await user.keyboard('{ArrowDown}');
  }
}

// ─── Pure helper tests ────────────────────────────────────────────────────────

describe('buildExportRows', () => {
  it('keeps the documented column order', () => {
    expect(buildExportRows([ROWS[0]])).toEqual([
      {
        ID: 'out-1',
        Title: 'Lagos Core POP',
        Severity: 'critical',
        Status: 'open',
        'Created At': '2026-03-04T08:30:00.000Z',
      },
    ]);
  });

  it('returns nothing for an empty selection', () => {
    expect(buildExportRows([])).toEqual([]);
  });
});

describe('toExportFile', () => {
  it('builds a CSV file with a header line', () => {
    const file = toExportFile('csv', ROWS);

    expect(file.filename).toBe('outages.csv');
    expect(file.mimeType).toBe('text/csv;charset=utf-8;');
    expect(file.content.split('\n')[0]).toBe(
      'ID,Title,Severity,Status,Created At'
    );
    expect(file.content).toContain('"out-1","Lagos Core POP"');
  });

  it('honours a custom base name', () => {
    expect(toExportFile('csv', ROWS, 'filtered').filename).toBe(
      'filtered.csv'
    );
  });

  it('builds a JSON file carrying the same fields', () => {
    const file = toExportFile('json', ROWS, 'filtered');

    expect(file.filename).toBe('filtered.json');
    expect(JSON.parse(file.content)).toEqual(buildExportRows(ROWS));
  });
});

describe('formatExportSummary', () => {
  it('pluralises the row count', () => {
    expect(
      formatExportSummary({
        format: 'csv',
        filename: 'outages.csv',
        rowCount: 1,
      })
    ).toBe('Exported 1 outage to outages.csv.');

    expect(
      formatExportSummary({
        format: 'json',
        filename: 'outages.json',
        rowCount: 2,
      })
    ).toBe('Exported 2 outages to outages.json.');
  });
});

// ─── Component tests ──────────────────────────────────────────────────────────

describe('ExportButton', () => {
  it('offers both formats to a permitted role', async () => {
    render(<ExportButton rows={ROWS} capabilities={GRANTED} />);
    await openMenu();

    for (const format of EXPORT_FORMATS) {
      expect(
        screen.getByRole('menuitem', { name: EXPORT_FORMAT_LABEL[format] })
      ).not.toHaveAttribute('aria-disabled', 'true');
    }
  });

  it('exports exactly the rows it was given as CSV', async () => {
    const onExported = vi.fn();
    render(
      <ExportButton
        rows={ROWS.slice(0, 1)}
        capabilities={GRANTED}
        onExported={onExported}
      />
    );
    await openMenu();

    await user.click(
      screen.getByRole('menuitem', { name: EXPORT_FORMAT_LABEL.csv })
    );

    await waitFor(() =>
      expect(downloadText).toHaveBeenCalledWith(
        'outages.csv',
        expect.stringContaining('"out-1","Lagos Core POP"'),
        'text/csv;charset=utf-8;'
      )
    );
    expect(downloadJson).not.toHaveBeenCalled();
    expect(onExported).toHaveBeenCalledWith({
      format: 'csv',
      filename: 'outages.csv',
      rowCount: 1,
    });
  });

  it('announces the export in a live region', async () => {
    render(<ExportButton rows={ROWS} capabilities={GRANTED} />);
    await openMenu();

    await user.click(
      screen.getByRole('menuitem', { name: EXPORT_FORMAT_LABEL.json })
    );

    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(
        'Exported 2 outages to outages.json.'
      )
    );
    expect(downloadJson).toHaveBeenCalledWith(
      'outages.json',
      buildExportRows(ROWS)
    );
  });

  it('disables both formats when there is nothing to export', async () => {
    render(<ExportButton rows={[]} capabilities={GRANTED} />);
    await openMenu();

    for (const format of EXPORT_FORMATS) {
      const item = screen.getByRole('menuitem', {
        name: EXPORT_FORMAT_LABEL[format],
      });
      expect(item).toHaveAttribute('aria-disabled', 'true');
      expect(item).toHaveAttribute(
        'title',
        'There are no outages to export.'
      );
    }

    expect(screen.getByText('No outages to export')).toBeInTheDocument();
  });

  it('disables both formats without the export capability', async () => {
    render(<ExportButton rows={ROWS} capabilities={[]} />);
    await openMenu();

    const item = screen.getByRole('menuitem', {
      name: EXPORT_FORMAT_LABEL.csv,
    });
    expect(item).toHaveAttribute('aria-disabled', 'true');
    expect(item).toHaveAttribute(
      'title',
      'Requires the "action:export-data" capability.'
    );
  });

  it('never downloads when the role lacks the capability', async () => {
    render(<ExportButton rows={ROWS} capabilities={[]} />);
    await openMenu();

    await user.click(
      screen.getByRole('menuitem', { name: EXPORT_FORMAT_LABEL.json })
    );

    expect(downloadJson).not.toHaveBeenCalled();
    expect(downloadText).not.toHaveBeenCalled();
  });

  it('falls back to the capabilities held by the store', async () => {
    useUIStore.setState({ role: 'viewer', capabilities: [] });
    render(<ExportButton rows={ROWS} />);
    await openMenu();

    expect(
      screen.getByRole('menuitem', { name: EXPORT_FORMAT_LABEL.csv })
    ).toHaveAttribute('aria-disabled', 'true');
  });

  it('blocks the trigger while the host is busy', () => {
    render(<ExportButton rows={ROWS} capabilities={GRANTED} disabled />);

    expect(
      screen.getByRole('button', { name: 'Export outages' })
    ).toBeDisabled();
  });

  it('surfaces a download failure instead of claiming success', async () => {
    vi.mocked(downloadText).mockImplementationOnce(() => {
      throw new Error('Download blocked by the browser.');
    });
    render(<ExportButton rows={ROWS} capabilities={GRANTED} />);
    await openMenu();

    await user.click(
      screen.getByRole('menuitem', { name: EXPORT_FORMAT_LABEL.csv })
    );

    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(
        'Download blocked by the browser.'
      )
    );
  });
});

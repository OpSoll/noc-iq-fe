/**
 * Unit tests for the import execution summary modal (closes #632).
 *
 * The modal is presentational: it receives an already-derived `ImportSummary`
 * and callbacks, so navigation and dismissal are asserted directly rather than
 * through an App Router mock.
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ImportSummaryModal,
  type ImportSummaryModalProps,
} from '@/components/bulk-import/ImportSummaryModal';
import { buildImportSummary } from '@/lib/importSummary';
import type { ImportValidationError } from '@/types/bulkImport';

function error(row: number): ImportValidationError {
  return { row, field: 'start_time', message: 'Invalid date' };
}

const CLEAN = buildImportSummary({ imported: 42, skipped: 7, errors: [] });
const WITH_FAILURES = buildImportSummary({
  imported: 40,
  skipped: 6,
  errors: [error(3), error(11), error(19)],
});

function setup(overrides: Partial<ImportSummaryModalProps> = {}) {
  const onClose = vi.fn();
  const onViewOutages = vi.fn();

  render(
    <ImportSummaryModal
      summary={CLEAN}
      errors={[]}
      onClose={onClose}
      onViewOutages={onViewOutages}
      {...overrides}
    />
  );

  return { onClose, onViewOutages };
}

describe('ImportSummaryModal', () => {
  let createObjectURL: ReturnType<typeof vi.fn>;
  let revokeObjectURL: ReturnType<typeof vi.fn>;
  let click: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    createObjectURL = vi.fn(() => 'blob:error-log');
    revokeObjectURL = vi.fn();
    URL.createObjectURL =
      createObjectURL as unknown as typeof URL.createObjectURL;
    URL.revokeObjectURL =
      revokeObjectURL as unknown as typeof URL.revokeObjectURL;
    click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {});
  });

  afterEach(() => {
    click.mockRestore();
  });

  it('renders the three-way breakdown', () => {
    setup({ summary: WITH_FAILURES });

    expect(screen.getByText('Successfully Imported')).toBeInTheDocument();
    expect(screen.getByText('Skipped Duplicates')).toBeInTheDocument();
    expect(screen.getByText('Failed Rows')).toBeInTheDocument();

    expect(screen.getByTestId('import-summary-imported')).toHaveTextContent(
      '40'
    );
    expect(screen.getByTestId('import-summary-skipped')).toHaveTextContent('6');
    expect(screen.getByTestId('import-summary-failed')).toHaveTextContent('3');
  });

  it('reports the total rows processed', () => {
    setup({ summary: WITH_FAILURES });

    expect(screen.getByTestId('import-summary-modal')).toHaveTextContent(
      '49 rows processed'
    );
  });

  it('announces a clean import as complete', () => {
    setup();

    expect(screen.getByText('Import complete')).toBeInTheDocument();
    expect(screen.queryByText(/could not be imported/)).not.toBeInTheDocument();
  });

  it('announces an import with failures as finished with errors', () => {
    setup({ summary: WITH_FAILURES, errors: [error(3)] });

    expect(screen.getByText('Import finished with errors')).toBeInTheDocument();
    expect(screen.getByText(/could not be imported/)).toBeInTheDocument();
  });

  it('renders nothing while closed', () => {
    setup({ open: false });

    expect(
      screen.queryByTestId('import-summary-modal')
    ).not.toBeInTheDocument();
  });

  it('disables the error log download when nothing failed', () => {
    setup();

    expect(screen.getByTestId('download-error-log')).toBeDisabled();
  });

  it('downloads the error log when rows failed', async () => {
    const user = userEvent.setup();
    const errors = [error(3), error(11), error(19)];
    setup({ summary: WITH_FAILURES, errors });

    const button = screen.getByTestId('download-error-log');
    expect(button).toBeEnabled();

    await user.click(button);

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(click).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:error-log');
  });

  it('exposes the imported outages action', async () => {
    const user = userEvent.setup();
    const { onViewOutages } = setup();

    await user.click(screen.getByTestId('view-imported-outages'));

    expect(onViewOutages).toHaveBeenCalledTimes(1);
  });

  it('omits the imported outages action when no handler is supplied', () => {
    setup({ onViewOutages: undefined });

    expect(
      screen.queryByTestId('view-imported-outages')
    ).not.toBeInTheDocument();
  });

  it('closes from the labelled close button', async () => {
    const user = userEvent.setup();
    const { onClose } = setup();

    await user.click(screen.getByRole('button', { name: 'Close' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('is an accessible modal dialog', () => {
    setup();

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleName('Import complete');
  });
});

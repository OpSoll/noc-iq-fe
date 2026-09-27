import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  ImportHistoryDrawer,
  downloadErrorLog,
  type ImportHistoryJob,
} from '../ImportHistoryDrawer';

const jobs: ImportHistoryJob[] = [
  {
    id: 'job-1',
    filename: 'outages-jan.csv',
    imported: 10,
    skipped: 1,
    error_count: 2,
    errors: [
      { row: 3, field: 'start_time', message: 'invalid date' },
      { row: 5, message: 'missing service_id' },
    ],
    created_at: '2026-01-10T12:00:00.000Z',
    status: 'partial',
  },
  {
    id: 'job-2',
    filename: 'failed.csv',
    imported: 0,
    skipped: 0,
    error_count: 5,
    errors: [{ row: 1, message: 'bad header' }],
    created_at: '2026-01-11T08:00:00.000Z',
    status: 'failed',
  },
];

describe('ImportHistoryDrawer (#635)', () => {
  it('lists past import jobs with date, file, counts, and status', () => {
    render(
      <ImportHistoryDrawer isOpen onClose={() => {}} jobs={jobs} />,
    );
    expect(screen.getByTestId('import-history-drawer')).toBeTruthy();
    expect(screen.getByText('outages-jan.csv')).toBeTruthy();
    expect(screen.getByText('failed.csv')).toBeTruthy();
    expect(screen.getByText(/partial/i)).toBeTruthy();
    expect(screen.getByText(/failed/i)).toBeTruthy();
    expect(screen.getByText(/10 ok/)).toBeTruthy();
  });

  it('offers re-run for failed batches', () => {
    const onRerun = vi.fn();
    render(
      <ImportHistoryDrawer
        isOpen
        onClose={() => {}}
        jobs={jobs}
        onRerun={onRerun}
      />,
    );
    const rerunButtons = screen.getAllByRole('button', { name: /re-run/i });
    expect(rerunButtons.length).toBeGreaterThan(0);
    fireEvent.click(rerunButtons[0]);
    expect(onRerun).toHaveBeenCalled();
  });

  it('downloadErrorLog builds a text blob name for the job', () => {
    const click = vi.fn();
    const originalCreate = URL.createObjectURL;
    const originalRevoke = URL.revokeObjectURL;
    URL.createObjectURL = vi.fn(() => 'blob:test');
    URL.revokeObjectURL = vi.fn();
    const createElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = createElement(tag);
      if (tag === 'a') {
        Object.defineProperty(el, 'click', { value: click });
      }
      return el;
    });

    downloadErrorLog(jobs[0]);
    expect(click).toHaveBeenCalled();
    expect(URL.createObjectURL).toHaveBeenCalled();

    URL.createObjectURL = originalCreate;
    URL.revokeObjectURL = originalRevoke;
  });
});

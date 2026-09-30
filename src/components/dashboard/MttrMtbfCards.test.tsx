/**
 * Unit tests for the MTTR/MTBF card container (closes #600).
 *
 * The outage sample hook is mocked so the same fixture drives both metrics.
 * The date filter splits that fixture into a current week and the week before
 * it, which is how the "previous billing cycle" comparison is exercised.
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import MttrMtbfCards from '@/components/dashboard/MttrMtbfCards';
import { useDashboardOutageSample } from '@/hooks/useDashboardOutageSample';
import type { Outage } from '@/types/outages';

vi.mock('@/hooks/useDashboardOutageSample', () => ({
  useDashboardOutageSample: vi.fn(),
  DASHBOARD_OUTAGE_SAMPLE_PARAMS: { page_size: 500 },
}));

const mockedSample = vi.mocked(useDashboardOutageSample);

/** 2026-09-08 → 2026-09-14, with the preceding equal-length week as baseline. */
const WEEK_FILTER = { dateFrom: '2026-09-08', dateTo: '2026-09-14' };

function resolvedOutage(id: string, startIso: string, minutes: number): Outage {
  return {
    id,
    site_name: 'Site A',
    severity: 'high',
    status: 'resolved',
    detected_at: startIso,
    resolved_at: new Date(
      new Date(startIso).getTime() + minutes * 60_000
    ).toISOString(),
    description: 'test',
    affected_services: [],
  };
}

/**
 * Current week: MTTR 40m (30m and 50m), MTBF 2.0 days.
 * Previous week: MTTR 60m (60m and 60m), MTBF 4.0 days.
 */
const FIXTURE: Outage[] = [
  resolvedOutage('c1', '2026-09-09T00:00:00Z', 30),
  resolvedOutage('c2', '2026-09-11T00:00:00Z', 50),
  resolvedOutage('p1', '2026-09-01T00:00:00Z', 60),
  resolvedOutage('p2', '2026-09-05T00:00:00Z', 60),
];

function mockSample(
  items: Outage[],
  overrides: Partial<ReturnType<typeof useDashboardOutageSample>> = {}
) {
  const refetch = vi.fn();
  mockedSample.mockReturnValue({
    data: { items, total: items.length, page: 1, page_size: 500 },
    isLoading: false,
    isError: false,
    isFetching: false,
    refetch,
    ...overrides,
  } as unknown as ReturnType<typeof useDashboardOutageSample>);
  return { refetch };
}

function cardValues() {
  return screen
    .getAllByTestId('metric-card')
    .map((card) => card.textContent ?? '');
}

describe('MttrMtbfCards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSample([]);
  });

  it('renders one card per metric', () => {
    mockSample(FIXTURE);

    render(<MttrMtbfCards {...WEEK_FILTER} />);

    expect(screen.getByText('Mean Time To Resolution')).toBeInTheDocument();
    expect(screen.getByText('Mean Time Between Failures')).toBeInTheDocument();
  });

  it('formats MTTR as hours and minutes and MTBF in days', () => {
    mockSample(FIXTURE);

    render(<MttrMtbfCards {...WEEK_FILTER} />);

    const [mttr, mtbf] = cardValues();
    expect(mttr).toContain('40m');
    expect(mtbf).toContain('2.0 days');
  });

  it('marks a faster MTTR than the previous cycle as improving', () => {
    mockSample(FIXTURE);

    render(<MttrMtbfCards {...WEEK_FILTER} />);

    const [mttr] = screen.getAllByTestId('metric-trend');
    expect(mttr).toHaveAttribute('data-trend', 'improving');
    expect(mttr).toHaveClass('text-green-700');
    expect(cardValues()[0]).toContain('-33.3% vs previous cycle');
  });

  it('marks a shorter MTBF than the previous cycle as degrading', () => {
    mockSample(FIXTURE);

    render(<MttrMtbfCards {...WEEK_FILTER} />);

    const [, mtbf] = screen.getAllByTestId('metric-trend');
    expect(mtbf).toHaveAttribute('data-trend', 'degrading');
    expect(mtbf).toHaveClass('text-red-700');
    expect(cardValues()[1]).toContain('-50.0% vs previous cycle');
  });

  it('reports no comparison rather than inventing a delta when the sample has no history', () => {
    mockSample([
      resolvedOutage('c1', '2026-09-09T00:00:00Z', 30),
      resolvedOutage('c2', '2026-09-11T00:00:00Z', 50),
    ]);

    render(<MttrMtbfCards {...WEEK_FILTER} />);

    for (const trend of screen.getAllByTestId('metric-trend')) {
      expect(trend).toHaveAttribute('data-trend', 'unknown');
    }
    expect(screen.getAllByText('No prior cycle to compare')).toHaveLength(2);
  });

  it('renders the no-data placeholder when there is nothing to measure', () => {
    mockSample([]);

    render(<MttrMtbfCards {...WEEK_FILTER} />);

    expect(cardValues()[0]).toContain('—');
    expect(cardValues()[1]).toContain('—');
  });

  it('shows a placeholder while the sample is loading', () => {
    mockSample([], { isLoading: true });

    render(<MttrMtbfCards {...WEEK_FILTER} />);

    const trends = screen.getAllByTestId('metric-trend');
    expect(trends).toHaveLength(2);
    trends.forEach((trend) =>
      expect(trend).toHaveAttribute('data-trend', 'unknown')
    );
  });

  it('surfaces a load failure and offers a retry', async () => {
    const user = userEvent.setup();
    const { refetch } = mockSample([], { isError: true });

    render(<MttrMtbfCards {...WEEK_FILTER} />);

    expect(
      screen.getByText(/Could not load reliability metrics/)
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });
});

/**
 * Unit tests for the live SLA availability widget (closes #599).
 *
 * The outage sample hook is mocked so each state the widget can render is
 * exercised deterministically. The auto-refresh assertions read the interval
 * the widget hands to that hook, which is exactly what React Query turns into
 * polling — so "paused while hidden" is verified as a real `false` rather than
 * by inspecting a timer that no longer exists.
 */
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import SlaWidget from '@/components/dashboard/SlaWidget';
import { useDashboardOutageSample } from '@/hooks/useDashboardOutageSample';
import type { Outage } from '@/types/outages';

vi.mock('@/hooks/useDashboardOutageSample', () => ({
  useDashboardOutageSample: vi.fn(),
  DASHBOARD_OUTAGE_SAMPLE_PARAMS: { page_size: 500 },
}));

const mockedSample = vi.mocked(useDashboardOutageSample);

function makeOutage(overrides: Partial<Outage> = {}): Outage {
  return {
    id: overrides.id ?? 'o1',
    site_name: 'Site A',
    severity: 'high',
    status: 'resolved',
    detected_at: '2026-09-01T01:00:00Z',
    resolved_at: '2026-09-01T02:00:00Z',
    description: 'test',
    affected_services: [],
    ...overrides,
  };
}

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

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => state,
  });
  document.dispatchEvent(new Event('visibilitychange'));
}

/** The widget measures the day named by the date filters. */
const DAY_FILTER = { dateFrom: '2026-09-01', dateTo: '2026-09-01' };

describe('SlaWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSample([]);
  });

  afterEach(() => {
    // Still mounted while this runs, so the reset must be wrapped too.
    act(() => setVisibility('visible'));
  });

  it('renders availability to exactly three decimal places', () => {
    // One hour of downtime inside a 23h59m59.999s day.
    mockSample([makeOutage()]);

    render(<SlaWidget {...DAY_FILTER} />);

    expect(screen.getByTestId('sla-availability-value')).toHaveTextContent(
      '95.833%'
    );
  });

  it('reports a full-availability window at three decimals', () => {
    // Detected well outside the measured day, so it contributes no downtime.
    mockSample([
      makeOutage({
        detected_at: '2026-08-01T01:00:00Z',
        resolved_at: '2026-08-01T02:00:00Z',
      }),
    ]);

    render(<SlaWidget {...DAY_FILTER} />);

    expect(screen.getByTestId('sla-availability-value')).toHaveTextContent(
      '100.000%'
    );
  });

  it('offers Off, 15s, 30s and 60s refresh options', () => {
    render(<SlaWidget {...DAY_FILTER} />);

    const select = screen.getByLabelText('Availability auto-refresh interval');
    expect(
      Array.from(select.querySelectorAll('option')).map((o) => o.textContent)
    ).toEqual(['Off', '15s', '30s', '60s']);
  });

  it('starts with polling disabled', () => {
    render(<SlaWidget {...DAY_FILTER} />);

    expect(mockedSample).toHaveBeenLastCalledWith(false);
  });

  it('polls at the selected interval', async () => {
    const user = userEvent.setup();
    render(<SlaWidget {...DAY_FILTER} />);

    await user.selectOptions(
      screen.getByLabelText('Availability auto-refresh interval'),
      '15000'
    );

    expect(mockedSample).toHaveBeenLastCalledWith(15_000);
  });

  it('pauses polling when the tab is hidden and resumes when visible', async () => {
    const user = userEvent.setup();
    render(<SlaWidget {...DAY_FILTER} />);

    await user.selectOptions(
      screen.getByLabelText('Availability auto-refresh interval'),
      '30000'
    );
    expect(mockedSample).toHaveBeenLastCalledWith(30_000);

    act(() => setVisibility('hidden'));
    expect(mockedSample).toHaveBeenLastCalledWith(false);
    expect(screen.getByText('Paused')).toBeInTheDocument();

    act(() => setVisibility('visible'));
    expect(mockedSample).toHaveBeenLastCalledWith(30_000);
  });

  it('stays paused while hidden even when an interval is selected', async () => {
    const user = userEvent.setup();
    render(<SlaWidget {...DAY_FILTER} />);

    act(() => setVisibility('hidden'));

    await user.selectOptions(
      screen.getByLabelText('Availability auto-refresh interval'),
      '60000'
    );

    expect(mockedSample).toHaveBeenLastCalledWith(false);
  });

  it('removes its page-visibility listener when unmounted', () => {
    const removeSpy = vi.spyOn(document, 'removeEventListener');

    const { unmount } = render(<SlaWidget {...DAY_FILTER} />);
    unmount();

    expect(removeSpy).toHaveBeenCalledWith(
      'visibilitychange',
      expect.any(Function)
    );

    removeSpy.mockRestore();
  });

  it('shows a loading indicator while a refetch is in flight', () => {
    mockSample([makeOutage()], { isFetching: true });

    render(<SlaWidget {...DAY_FILTER} />);

    expect(screen.getByRole('status')).toHaveTextContent('Updating…');
  });

  it('says there is nothing to measure when the sample is empty', () => {
    mockSample([]);

    render(<SlaWidget {...DAY_FILTER} />);

    expect(screen.getByTestId('sla-availability-value')).toHaveTextContent('—');
    expect(
      screen.getByText('No outage records to measure availability against.')
    ).toBeInTheDocument();
  });

  it('summarises the outage count and downtime', () => {
    mockSample([makeOutage()]);

    render(<SlaWidget {...DAY_FILTER} />);

    expect(screen.getByTestId('sla-availability-widget')).toHaveTextContent(
      '1 outage'
    );
    expect(screen.getByText('60.0m downtime')).toBeInTheDocument();
  });

  it('surfaces a load failure and offers a retry', async () => {
    const user = userEvent.setup();
    const { refetch } = mockSample([], { isError: true });

    render(<SlaWidget {...DAY_FILTER} />);

    expect(
      screen.getByText(/Availability is unavailable right now/)
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });
});

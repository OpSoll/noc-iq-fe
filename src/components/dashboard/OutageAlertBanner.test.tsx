import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

import {
  DISMISSED_OUTAGE_KEY,
  OPEN_CRITICAL_PARAMS,
  OutageAlertBanner,
  formatRelativeAge,
  selectWorstOpenCritical,
} from './OutageAlertBanner';
import { queryKeys } from '@/lib/queryKeys';
import { getOutages } from '@/services/outages';
import type { Outage } from '@/types/outages';

const push = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn(), back: vi.fn() }),
}));

vi.mock('@/services/outages', () => ({
  getOutages: vi.fn(),
}));

const mockedGetOutages = vi.mocked(getOutages);

let client: QueryClient;

// A stable wrapper is required: a new QueryClient per render would restart
// every query on each re-render.
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function makeOutage(overrides: Partial<Outage> = {}): Outage {
  return {
    id: 'out-1',
    site_name: 'Site A',
    severity: 'critical',
    status: 'open',
    detected_at: '2026-06-01T00:00:00Z',
    description: 'link down',
    affected_services: ['backbone'],
    ...overrides,
  };
}

function mockOutages(items: Outage[]) {
  mockedGetOutages.mockResolvedValue({
    items,
    total: items.length,
    page: 1,
    page_size: 50,
  });
}

/** Resolves once the open-critical outage query has landed in the cache. */
async function waitForOutagesQuery() {
  await waitFor(() => {
    expect(
      client.getQueryData(queryKeys.outages.list({ ...OPEN_CRITICAL_PARAMS }))
    ).toBeDefined();
  });
}

beforeEach(() => {
  localStorage.clear();
  push.mockClear();
  mockedGetOutages.mockReset();
  client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
});

// ─── selectWorstOpenCritical ─────────────────────────────────────────────────

describe('selectWorstOpenCritical', () => {
  it('returns null when there are no open critical outages', () => {
    expect(selectWorstOpenCritical([])).toBeNull();
    expect(
      selectWorstOpenCritical([
        makeOutage({ id: 'a', status: 'resolved' }),
        makeOutage({ id: 'b', severity: 'high' }),
        makeOutage({ id: 'c', status: 'resolved', severity: 'high' }),
      ])
    ).toBeNull();
  });

  it('picks the longest-running open critical outage', () => {
    const outages = [
      makeOutage({ id: 'newer', detected_at: '2026-06-05T00:00:00Z' }),
      makeOutage({ id: 'oldest', detected_at: '2026-06-01T00:00:00Z' }),
      makeOutage({ id: 'middle', detected_at: '2026-06-03T00:00:00Z' }),
    ];
    expect(selectWorstOpenCritical(outages)?.id).toBe('oldest');
  });

  it('ignores resolved critical outages even when they are older', () => {
    const outages = [
      makeOutage({ id: 'resolved-old', status: 'resolved' }),
      makeOutage({ id: 'live', detected_at: '2026-06-09T00:00:00Z' }),
    ];
    expect(selectWorstOpenCritical(outages)?.id).toBe('live');
  });

  it('skips a dismissed outage so a new incident can take over the alert', () => {
    const outages = [
      makeOutage({ id: 'out-42', detected_at: '2026-06-01T00:00:00Z' }),
      makeOutage({
        id: 'out-99',
        site_name: 'Site Z',
        detected_at: '2026-06-06T00:00:00Z',
      }),
    ];
    expect(selectWorstOpenCritical(outages, { excludeId: 'out-42' })?.id).toBe(
      'out-99'
    );
    expect(
      selectWorstOpenCritical([outages[0]], { excludeId: 'out-42' })
    ).toBeNull();
  });

  it('does not throw on unparseable detection timestamps', () => {
    const outages = [
      makeOutage({ id: 'broken', detected_at: 'not-a-date' }),
      makeOutage({ id: 'valid', detected_at: '2026-06-02T00:00:00Z' }),
    ];
    expect(selectWorstOpenCritical(outages)?.id).toBe('valid');
  });
});

// ─── formatRelativeAge ───────────────────────────────────────────────────────

describe('formatRelativeAge', () => {
  const now = new Date('2026-06-10T12:00:00Z');

  it('formats minutes, hours, and days', () => {
    expect(formatRelativeAge('2026-06-10T11:59:30Z', now)).toBe('just now');
    expect(formatRelativeAge('2026-06-10T11:30:00Z', now)).toBe('30m ago');
    expect(formatRelativeAge('2026-06-10T10:00:00Z', now)).toBe('2h ago');
    expect(formatRelativeAge('2026-06-10T09:45:00Z', now)).toBe('2h 15m ago');
    expect(formatRelativeAge('2026-06-08T12:00:00Z', now)).toBe('2d ago');
    expect(formatRelativeAge('2026-06-08T09:00:00Z', now)).toBe('2d 3h ago');
  });

  it('reports unknown start times instead of rendering NaN', () => {
    expect(formatRelativeAge('nonsense', now)).toBe('Unknown start time');
  });
});

// ─── OutageAlertBanner ───────────────────────────────────────────────────────

describe('OutageAlertBanner', () => {
  it('renders nothing when no open critical outage exists', async () => {
    mockOutages([]);
    render(<OutageAlertBanner />, { wrapper });
    await waitForOutagesQuery();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows site name, age, and severity for the worst open outage', async () => {
    mockOutages([
      makeOutage({
        id: 'newer',
        site_name: 'Site B',
        detected_at: '2026-06-05T00:00:00Z',
      }),
      makeOutage({
        id: 'oldest',
        site_name: 'Site A',
        detected_at: new Date(Date.now() - 90 * 60 * 1000).toISOString(),
      }),
    ]);

    render(<OutageAlertBanner />, { wrapper });

    const alert = await screen.findByRole('alert');
    expect(
      within(alert).getByText(/Active critical outage at Site A/)
    ).toBeInTheDocument();
    expect(within(alert).getByText(/1h 30m ago/)).toBeInTheDocument();
    expect(within(alert).getByText('critical')).toBeInTheDocument();
  });

  it('navigates to the incident detail route on Inspect Outage', async () => {
    const user = userEvent.setup();
    mockOutages([makeOutage({ id: 'out-42' })]);

    render(<OutageAlertBanner />, { wrapper });

    await user.click(
      await screen.findByRole('button', { name: 'Inspect Outage' })
    );
    expect(push).toHaveBeenCalledWith('/outages/out-42');
  });

  it('collapses on dismiss and re-alerts a newly opened critical outage', async () => {
    const user = userEvent.setup();
    mockOutages([makeOutage({ id: 'out-42' })]);

    const first = render(<OutageAlertBanner />, { wrapper });
    await user.click(await screen.findByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(localStorage.getItem(DISMISSED_OUTAGE_KEY)).toBe('out-42');
    first.unmount();

    // A new critical outage must bring the banner back even though the
    // operator already dismissed the previous one.
    client.clear();
    mockOutages([
      makeOutage({ id: 'out-42' }),
      makeOutage({
        id: 'out-99',
        site_name: 'Site Z',
        detected_at: '2026-06-06T00:00:00Z',
      }),
    ]);
    render(<OutageAlertBanner />, { wrapper });
    expect(
      await screen.findByText(/Active critical outage at Site Z/)
    ).toBeInTheDocument();
  });

  it('restores a persisted dismissal across mounts', async () => {
    localStorage.setItem(DISMISSED_OUTAGE_KEY, 'out-42');
    mockOutages([
      makeOutage({ id: 'out-42' }),
      makeOutage({
        id: 'out-99',
        site_name: 'Site Z',
        detected_at: '2026-06-06T00:00:00Z',
      }),
    ]);

    render(<OutageAlertBanner />, { wrapper });
    // Site Z proves the query resolved; Site A (dismissed) must stay hidden.
    expect(
      await screen.findByText(/Active critical outage at Site Z/)
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/Active critical outage at Site A/)
    ).not.toBeInTheDocument();
  });
});

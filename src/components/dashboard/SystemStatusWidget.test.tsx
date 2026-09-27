/**
 * Unit tests for the dashboard system status indicator (closes #611)
 *
 * The readiness service is mocked so the widget is exercised against every
 * state it can render. Radix mounts tooltip content in a portal behind a
 * `ResizeObserver` that jsdom does not provide, so the tooltip copy is covered
 * through the pure `buildStatusDetail` helper instead of a hover interaction.
 */
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import SystemStatusWidget, {
  buildStatusDetail,
} from '@/components/dashboard/SystemStatusWidget';
import { queryKeys } from '@/lib/queryKeys';
import {
  getSystemHealth,
  summarizeSystemHealth,
  type DependencyHealth,
  type SystemHealthReport,
} from '@/services/systemHealth';

vi.mock('@/services/systemHealth', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/services/systemHealth')>();
  return { ...actual, getSystemHealth: vi.fn() };
});

const mockedGetSystemHealth = vi.mocked(getSystemHealth);

/** A probe that never answers, so the pending state stays observable. */
function neverResolves(): Promise<SystemHealthReport> {
  return new Promise<SystemHealthReport>(() => {});
}

function makeWrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  };
}

function check(overrides: Partial<DependencyHealth> = {}): DependencyHealth {
  return { name: 'postgres', status: 'operational', ...overrides };
}

describe('SystemStatusWidget', () => {
  let client: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });

  it('shows a checking state before the probe resolves', () => {
    mockedGetSystemHealth.mockReturnValue(neverResolves());

    render(<SystemStatusWidget />, { wrapper: makeWrapper(client) });

    expect(
      screen.getByRole('button', { name: 'Checking system status' })
    ).toHaveTextContent('Checking…');
  });

  it('renders a green pill when every dependency is operational', async () => {
    mockedGetSystemHealth.mockResolvedValue({
      checks: [check(), check({ name: 'redis' })],
      latency_ms: 42,
    });

    render(<SystemStatusWidget />, { wrapper: makeWrapper(client) });

    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'All systems operational' })
      ).toHaveTextContent('Operational')
    );
  });

  it('renders an amber pill when a dependency is degraded', async () => {
    mockedGetSystemHealth.mockResolvedValue({
      checks: [check(), check({ name: 'redis', status: 'degraded' })],
    });

    render(<SystemStatusWidget />, { wrapper: makeWrapper(client) });

    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Some systems are degraded' })
      ).toHaveTextContent('Degraded')
    );
  });

  it('renders a red pill when any dependency is down', async () => {
    mockedGetSystemHealth.mockResolvedValue({
      checks: [
        check(),
        check({ name: 'redis', status: 'degraded' }),
        check({ name: 'stripe', status: 'down' }),
      ],
    });

    render(<SystemStatusWidget />, { wrapper: makeWrapper(client) });

    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'System outage detected' })
      ).toHaveTextContent('Down')
    );
  });

  it('falls back to unknown when no dependencies are reported', async () => {
    mockedGetSystemHealth.mockResolvedValue({ checks: [] });

    render(<SystemStatusWidget />, { wrapper: makeWrapper(client) });

    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'System status is unknown' })
      ).toHaveTextContent('Unknown')
    );
  });

  it('reports a failed probe as an outage', async () => {
    mockedGetSystemHealth.mockRejectedValue(new Error('Network error'));

    render(<SystemStatusWidget />, { wrapper: makeWrapper(client) });

    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'System outage detected' })
      ).toHaveTextContent('Down')
    );
  });

  it('caches the report under the shared system health key', async () => {
    mockedGetSystemHealth.mockResolvedValue({ checks: [check()] });

    render(<SystemStatusWidget />, { wrapper: makeWrapper(client) });

    await waitFor(() =>
      expect(client.getQueryData(queryKeys.systemHealth.all)).toStrictEqual({
        checks: [check()],
      })
    );
  });

  it('applies a caller className to the pill', () => {
    mockedGetSystemHealth.mockReturnValue(neverResolves());

    render(<SystemStatusWidget className="ml-2" />, {
      wrapper: makeWrapper(client),
    });

    expect(
      screen.getByRole('button', { name: 'Checking system status' })
    ).toHaveClass('ml-2');
  });
});

describe('summarizeSystemHealth', () => {
  it('treats an empty or missing check list as unknown', () => {
    expect(summarizeSystemHealth([])).toBe('unknown');
    expect(summarizeSystemHealth(undefined)).toBe('unknown');
  });

  it('is operational only when every check is operational', () => {
    expect(summarizeSystemHealth([check(), check({ name: 'redis' })])).toBe(
      'operational'
    );
  });

  it('lets the worst check win', () => {
    expect(
      summarizeSystemHealth([check(), check({ status: 'degraded' })])
    ).toBe('degraded');
    expect(
      summarizeSystemHealth([
        check({ status: 'degraded' }),
        check({ name: 'redis', status: 'down' }),
      ])
    ).toBe('down');
  });

  it('never claims health for a status it does not recognise', () => {
    const checks = [
      { name: 'mystery', status: 'probably-fine' as unknown as 'operational' },
    ];
    expect(summarizeSystemHealth(checks)).toBe('unknown');
  });
});

describe('buildStatusDetail', () => {
  it('describes a pending probe', () => {
    expect(buildStatusDetail(undefined)).toStrictEqual([
      'Contacting the readiness probe…',
    ]);
  });

  it('surfaces the failure reason', () => {
    expect(buildStatusDetail(undefined, 'Network error')).toStrictEqual([
      'Readiness probe failed.',
      'Network error',
    ]);
  });

  it('lists each dependency with its status and latency', () => {
    const detail = buildStatusDetail({
      checks: [
        { name: 'postgres', status: 'operational', latency_ms: 12.4 },
        {
          name: 'redis',
          status: 'down',
          latency_ms: 900,
          message: 'connection refused',
        },
      ],
      latency_ms: 41.6,
    });

    expect(detail).toStrictEqual([
      'postgres: operational · 12ms',
      'redis: down · 900ms · connection refused',
      'Readiness probe 42ms',
    ]);
  });

  it('explains an empty dependency list', () => {
    expect(buildStatusDetail({ checks: [] })).toStrictEqual([
      'The readiness probe reported no dependencies.',
    ]);
  });
});

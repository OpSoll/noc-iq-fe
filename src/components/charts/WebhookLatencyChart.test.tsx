import { render, screen, within } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import WebhookLatencyChart from '@/components/charts/WebhookLatencyChart';
import type { WebhookDelivery } from '@/types/webhook';

const delivery = (
  createdAt: string,
  latencyMs: number
): WebhookDelivery =>
  ({
    id: `${createdAt}-${latencyMs}`,
    webhook_id: 'w1',
    event: 'outage.created',
    status: 'success',
    response_code: 200,
    created_at: createdAt,
    latency_ms: latencyMs,
  }) as WebhookDelivery;

const DELIVERIES = [
  delivery('2026-01-13T01:00:00Z', 100),
  delivery('2026-01-13T02:00:00Z', 300),
  delivery('2026-01-14T01:00:00Z', 400),
  // A day averaging well over 1000ms — a latency spike.
  delivery('2026-01-15T01:00:00Z', 2000),
  delivery('2026-01-15T02:00:00Z', 3000),
];

describe('WebhookLatencyChart', () => {
  it('renders an accessible chart with a descriptive label', () => {
    render(<WebhookLatencyChart deliveries={DELIVERIES} />);

    const chart = screen.getByTestId('webhook-latency-chart');
    expect(chart.tagName.toLowerCase()).toBe('svg');
    expect(chart).toHaveAttribute(
      'aria-label',
      expect.stringContaining('Average webhook delivery latency per day')
    );
  });

  it('plots one point per day', () => {
    render(<WebhookLatencyChart deliveries={DELIVERIES} />);

    expect(screen.getAllByTestId('latency-point')).toHaveLength(2);
    expect(screen.getAllByTestId('latency-spike-point')).toHaveLength(1);
    expect(screen.getByTestId('latency-line').getAttribute('points')?.split(' '))
      .toHaveLength(3);
  });

  it('draws the 1000ms threshold line', () => {
    render(<WebhookLatencyChart deliveries={DELIVERIES} />);

    const line = screen.getByTestId('latency-threshold-line');
    expect(line).toBeInTheDocument();
    expect(line).toHaveAttribute('stroke-dasharray');
    expect(screen.getByText('1000ms threshold')).toBeInTheDocument();
  });

  it('highlights spike points in amber', () => {
    render(<WebhookLatencyChart deliveries={DELIVERIES} />);

    expect(screen.getAllByTestId('latency-spike-point')[0].getAttribute('class'))
      .toContain('amber');
    expect(screen.getAllByTestId('latency-point')[0].getAttribute('class'))
      .not.toContain('amber');
  });

  it('honours a custom threshold', () => {
    render(<WebhookLatencyChart deliveries={DELIVERIES} thresholdMs={200} />);
    expect(screen.getByText('200ms threshold')).toBeInTheDocument();
    expect(screen.getAllByTestId('latency-point')).toHaveLength(2);
    expect(screen.getAllByTestId('latency-spike-point')).toHaveLength(1);
  });

  it('exposes the underlying data as an accessible table', () => {
    render(<WebhookLatencyChart deliveries={DELIVERIES} />);

    const table = screen.getByTestId('latency-data-table');
    const rows = within(table).getAllByRole('row');
    // Header row plus one per day.
    expect(rows).toHaveLength(4);
    expect(within(table).getByRole('rowheader', { name: '2026-01-15' })).toBeInTheDocument();
  });

  it('reports the average, p95, and dispatch count in the table', () => {
    render(<WebhookLatencyChart deliveries={DELIVERIES} />);

    const table = screen.getByTestId('latency-data-table');
    // 2026-01-15: (2000 + 3000) / 2 = 2500 average, 3000 p95, 2 dispatches.
    const row = within(table).getByRole('rowheader', { name: '2026-01-15' })
      .closest('tr') as HTMLElement;
    const cells = within(row).getAllByRole('cell').map((c) => c.textContent);
    expect(cells).toEqual(['2500', '3000', '2']);
  });

  it('shows an empty state with no latency data', () => {
    render(<WebhookLatencyChart deliveries={[]} />);

    expect(screen.getByTestId('webhook-latency-chart-empty')).toHaveTextContent(
      'No delivery latency recorded yet.'
    );
    expect(screen.queryByTestId('webhook-latency-chart')).not.toBeInTheDocument();
  });

  it('shows an empty state when dispatches have no latency recorded', () => {
    render(
      <WebhookLatencyChart
        deliveries={[
          {
            id: 'x',
            webhook_id: 'w1',
            event: 'e',
            status: 'success',
            response_code: 200,
            created_at: '2026-01-15T00:00:00Z',
          },
        ]}
      />
    );
    expect(screen.getByTestId('webhook-latency-chart-empty')).toBeInTheDocument();
  });

  it('limits the window to the most recent days', () => {
    const many = Array.from({ length: 12 }, (_, i) =>
      delivery(`2026-01-${String(i + 1).padStart(2, '0')}T00:00:00Z`, 100)
    );
    render(<WebhookLatencyChart deliveries={many} days={7} />);

    expect(
      within(screen.getByTestId('latency-data-table')).getAllByRole('row')
    ).toHaveLength(8);
  });

  it('describes the series in the chart description', () => {
    render(<WebhookLatencyChart deliveries={DELIVERIES} />);

    const desc = screen.getByTestId('webhook-latency-chart').querySelector('desc');
    expect(desc?.textContent).toContain('3 days of data');
    expect(desc?.textContent).toContain('exceeded the 1000ms threshold');
  });
});

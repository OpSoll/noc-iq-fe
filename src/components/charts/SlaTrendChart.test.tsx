/**
 * Unit tests for the SLA compliance history chart (closes #603).
 *
 * A ten-day window is used so the timeframe toggles have a stable, hand-checkable
 * effect: 30 days shows the whole series, 7 days trims it to the trailing week.
 * The daily outage count and downtime asserted below are the same values the SVG
 * point tooltips carry, read through the chart's accessible table.
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import SlaTrendChart, {
  type SlaTrendChartProps,
} from '@/components/charts/SlaTrendChart';
import type { Outage } from '@/types/outages';

const TEN_DAY_RANGE = { dateFrom: '2026-09-01', dateTo: '2026-09-10' };

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

/** One 60-minute outage on 2026-09-02, nothing else. */
const OUTAGES: Outage[] = [resolvedOutage('a', '2026-09-02T00:00:00Z', 60)];

function renderChart(overrides: Partial<SlaTrendChartProps> = {}) {
  return render(
    <SlaTrendChart outages={OUTAGES} {...TEN_DAY_RANGE} {...overrides} />
  );
}

describe('SlaTrendChart', () => {
  it('offers 7, 30 and 90 day timeframes', () => {
    renderChart();

    expect(screen.getByRole('button', { name: '7 days' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '30 days' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '90 days' })).toBeInTheDocument();
  });

  it('defaults to the 30 day window', () => {
    renderChart();

    expect(screen.getByRole('button', { name: '30 days' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
  });

  it('plots one point per day in the range', () => {
    renderChart();

    expect(screen.getAllByTestId('sla-trend-point')).toHaveLength(10);
  });

  it('trims the series when a shorter timeframe is chosen', async () => {
    const user = userEvent.setup();
    renderChart();

    await user.click(screen.getByRole('button', { name: '7 days' }));

    expect(screen.getAllByTestId('sla-trend-point')).toHaveLength(7);
    expect(screen.getByRole('button', { name: '7 days' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
  });

  it('restores the full series when a longer timeframe is chosen', async () => {
    const user = userEvent.setup();
    renderChart();

    await user.click(screen.getByRole('button', { name: '7 days' }));
    await user.click(screen.getByRole('button', { name: '90 days' }));

    expect(screen.getAllByTestId('sla-trend-point')).toHaveLength(10);
  });

  it('draws the target SLA threshold line', () => {
    renderChart();

    expect(screen.getByTestId('sla-trend-target-line')).toBeInTheDocument();
  });

  it('draws a filled area for the series', () => {
    renderChart();

    const area = screen.getByTestId('sla-trend-area');
    expect(area).toHaveAttribute('d');
    expect(area.getAttribute('d')).toContain('Z');
  });

  it('details the daily outage count and downtime duration', () => {
    renderChart();

    const rows = screen.getAllByTestId('sla-trend-row');
    const affectedDay = rows.find((row) =>
      row.textContent?.includes('2026-09-02')
    );

    expect(affectedDay).toBeDefined();
    expect(affectedDay).toHaveTextContent('95.833%');
    expect(affectedDay).toHaveTextContent('60.0');
  });

  it('exposes the daily detail as an accessible table', () => {
    renderChart();

    const table = screen.getByTestId('sla-trend-table');
    expect(table.tagName).toBe('TABLE');
    expect(
      screen.getByRole('columnheader', { name: 'Outages' })
    ).toBeInTheDocument();
    expect(screen.getAllByTestId('sla-trend-row')).toHaveLength(10);
  });

  it('describes the series, target and worst day for assistive tech', () => {
    renderChart();

    const image = screen.getByRole('img');
    expect(image).toHaveAccessibleName(/SLA compliance over the last 30d/);
    expect(image).toHaveAccessibleName(/worst day 2026-09-02/);
  });

  it('reports an inverted range instead of drawing an empty chart', () => {
    // A blank filter falls back to a valid trailing window, so the only way to
    // get no buckets is a range whose start is after its end.
    renderChart({ dateFrom: '2026-09-10', dateTo: '2026-09-01' });

    expect(screen.queryByTestId('sla-trend-area')).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('sla-trend-target-line')
    ).not.toBeInTheDocument();
    expect(
      screen.getByText('No compliance history for this range.')
    ).toBeInTheDocument();
  });
});

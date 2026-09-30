/**
 * Unit tests for the MTTR/MTBF metric card rendering (closes #600).
 *
 * The card is presentational, so these cover the contract the container relies
 * on: the value, the trend word, the arrow that follows the raw movement, and
 * the colour that follows the resolved trend — which is not always the same
 * direction as the arrow.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import MetricCard from '@/components/dashboard/MetricCard';

describe('MetricCard', () => {
  it('renders the title, value and comparison line', () => {
    render(
      <MetricCard
        title="Mean Time To Resolution"
        value="2h 15m"
        changePercentage={-12}
        trend="improving"
        comparison="-12.0% vs previous cycle"
        detail="Average time from detection to resolution."
      />
    );

    expect(screen.getByText('Mean Time To Resolution')).toBeInTheDocument();
    expect(screen.getByText('2h 15m')).toBeInTheDocument();
    expect(screen.getByText('-12.0% vs previous cycle')).toBeInTheDocument();
    expect(
      screen.getByText('Average time from detection to resolution.')
    ).toBeInTheDocument();
  });

  it('marks an improving trend green', () => {
    render(
      <MetricCard
        title="MTTR"
        value="40m"
        changePercentage={-33.3}
        trend="improving"
        comparison="-33.3% vs previous cycle"
      />
    );

    const trend = screen.getByTestId('metric-trend');
    expect(trend).toHaveAttribute('data-trend', 'improving');
    expect(trend).toHaveClass('text-green-700');
    expect(trend).toHaveTextContent('Improving');
  });

  it('marks a degrading trend red', () => {
    render(
      <MetricCard
        title="MTBF"
        value="2.0 days"
        changePercentage={-50}
        trend="degrading"
        comparison="-50.0% vs previous cycle"
      />
    );

    const trend = screen.getByTestId('metric-trend');
    expect(trend).toHaveAttribute('data-trend', 'degrading');
    expect(trend).toHaveClass('text-red-700');
    expect(trend).toHaveTextContent('Degrading');
  });

  it('points the arrow up when the value rose and still colours by trend', () => {
    // MTBF rose, which is an improvement — the arrow and the colour disagree.
    render(
      <MetricCard
        title="MTBF"
        value="6.0 days"
        changePercentage={20}
        trend="improving"
        comparison="+20.0% vs previous cycle"
      />
    );

    const trend = screen.getByTestId('metric-trend');
    expect(trend).toHaveTextContent('▲');
    expect(trend).toHaveClass('text-green-700');
  });

  it('points the arrow down when the value fell', () => {
    render(
      <MetricCard
        title="MTTR"
        value="30m"
        changePercentage={-25}
        trend="improving"
        comparison="-25.0% vs previous cycle"
      />
    );

    expect(screen.getByTestId('metric-trend')).toHaveTextContent('▼');
  });

  it('reports an unchanged value as flat with a neutral marker', () => {
    render(
      <MetricCard
        title="MTTR"
        value="40m"
        changePercentage={0}
        trend="flat"
        comparison="0.0% vs previous cycle"
      />
    );

    const trend = screen.getByTestId('metric-trend');
    expect(trend).toHaveTextContent('Unchanged');
    expect(trend).toHaveTextContent('—');
    expect(trend).toHaveClass('text-gray-500');
  });

  it('reports a missing baseline as unknown without implying movement', () => {
    render(
      <MetricCard
        title="MTTR"
        value="—"
        changePercentage={null}
        trend="unknown"
        comparison="No prior cycle to compare"
      />
    );

    const trend = screen.getByTestId('metric-trend');
    expect(trend).toHaveAttribute('data-trend', 'unknown');
    expect(trend).toHaveTextContent('No comparison');
    expect(trend).toHaveTextContent('—');
  });

  it('omits the detail line when none is supplied', () => {
    render(
      <MetricCard
        title="MTTR"
        value="40m"
        changePercentage={null}
        trend="unknown"
        comparison="No prior cycle to compare"
      />
    );

    // Title, value and comparison only — the optional detail paragraph is absent.
    expect(
      screen.getByTestId('metric-card').querySelectorAll('p')
    ).toHaveLength(3);
  });
});

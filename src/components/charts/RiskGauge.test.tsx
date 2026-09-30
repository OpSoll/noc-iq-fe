/**
 * Unit tests for the SLA breach risk gauge (closes #601).
 *
 * The gauge is presentational, so the geometry mapping is asserted through the
 * exported `polarPoint`/`arcPath` helpers and the rendered bands through the
 * classes on the readout — which is what the issue's green/yellow/red
 * requirement reduces to.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import RiskGauge, {
  GAUGE_GEOMETRY,
  arcPath,
  polarPoint,
} from '@/components/charts/RiskGauge';

/** 30 days in minutes, with the default 99.9% target: 43.2 minutes allowed. */
const MONTH_MINUTES = 30 * 24 * 60;
const ALLOWED = 43.2;

describe('polarPoint', () => {
  it('starts level with the centre on the left', () => {
    const start = polarPoint(0);

    expect(start.x).toBeCloseTo(GAUGE_GEOMETRY.cx - GAUGE_GEOMETRY.radius, 6);
    expect(start.y).toBeCloseTo(GAUGE_GEOMETRY.cy, 6);
  });

  it('ends level with the centre on the right', () => {
    const end = polarPoint(100);

    expect(end.x).toBeCloseTo(GAUGE_GEOMETRY.cx + GAUGE_GEOMETRY.radius, 6);
    expect(end.y).toBeCloseTo(GAUGE_GEOMETRY.cy, 6);
  });

  it('places the midpoint directly above the centre', () => {
    const middle = polarPoint(50);

    expect(middle.x).toBeCloseTo(GAUGE_GEOMETRY.cx, 6);
    expect(middle.y).toBeCloseTo(GAUGE_GEOMETRY.cy - GAUGE_GEOMETRY.radius, 6);
  });

  it('clamps out-of-range and invalid percentages', () => {
    expect(polarPoint(-20).x).toBeCloseTo(polarPoint(0).x, 6);
    expect(polarPoint(500).x).toBeCloseTo(polarPoint(100).x, 6);
    expect(polarPoint(Number.NaN).x).toBeCloseTo(polarPoint(0).x, 6);
  });
});

describe('arcPath', () => {
  it('draws a move followed by a single arc', () => {
    const path = arcPath(0, 100);

    expect(path.match(/M /g)).toHaveLength(1);
    expect(path.match(/A /g)).toHaveLength(1);
    expect(path).toContain(
      `A ${GAUGE_GEOMETRY.radius} ${GAUGE_GEOMETRY.radius}`
    );
  });

  it('maps consumption onto the sweep', () => {
    expect(arcPath(0, 0)).toBe(arcPath(0, 0));
    expect(arcPath(0, 50)).not.toBe(arcPath(0, 100));
  });
});

describe('RiskGauge', () => {
  it('reports consumption to one decimal place with its band', () => {
    render(
      <RiskGauge downtimeMinutes={ALLOWED / 2} windowMinutes={MONTH_MINUTES} />
    );

    expect(screen.getByTestId('risk-gauge-percent')).toHaveTextContent('50.0%');
    expect(screen.getByText('Healthy')).toBeInTheDocument();
  });

  it('shows green below the warning threshold', () => {
    render(
      <RiskGauge
        downtimeMinutes={ALLOWED * 0.5}
        windowMinutes={MONTH_MINUTES}
      />
    );

    expect(screen.getByTestId('risk-gauge-percent')).toHaveClass(
      'text-green-600'
    );
  });

  it('shows amber from 75% consumed', () => {
    render(
      <RiskGauge
        downtimeMinutes={ALLOWED * 0.75}
        windowMinutes={MONTH_MINUTES}
      />
    );

    expect(screen.getByTestId('risk-gauge-percent')).toHaveTextContent('75.0%');
    expect(screen.getByTestId('risk-gauge-percent')).toHaveClass(
      'text-amber-500'
    );
    expect(screen.getByText('Warning')).toBeInTheDocument();
  });

  it('shows red from 90% consumed', () => {
    render(
      <RiskGauge
        downtimeMinutes={ALLOWED * 0.9}
        windowMinutes={MONTH_MINUTES}
      />
    );

    expect(screen.getByTestId('risk-gauge-percent')).toHaveClass(
      'text-red-600'
    );
    expect(screen.getByText('Critical')).toBeInTheDocument();
    expect(screen.getByTestId('risk-gauge-value')).toHaveAttribute(
      'data-risk',
      'critical'
    );
  });

  it('exposes the exact remaining downtime in the hover tooltip', () => {
    render(
      <RiskGauge downtimeMinutes={ALLOWED / 4} windowMinutes={MONTH_MINUTES} />
    );

    const tooltip = screen.getByTestId('risk-gauge-tooltip');
    // 25% of 43.2 leaves 32.4 minutes.
    expect(tooltip).toHaveTextContent('32.4 min remaining');
    expect(tooltip).toHaveTextContent('10.8m of 43.2m used');
  });

  it('announces the remaining allowance and usage to assistive tech', () => {
    render(
      <RiskGauge downtimeMinutes={ALLOWED / 4} windowMinutes={MONTH_MINUTES} />
    );

    const image = screen.getByRole('img');
    expect(image).toHaveAccessibleName(/32\.4 min remaining/);
    expect(image).toHaveAccessibleName(/10\.8 of 43\.2 allowed minutes used/);
    expect(image).toHaveAccessibleName(/Healthy/);
  });

  it('reports an overspent budget instead of hiding it behind 100%', () => {
    render(
      <RiskGauge downtimeMinutes={ALLOWED * 2} windowMinutes={MONTH_MINUTES} />
    );

    expect(screen.getByTestId('risk-gauge-percent')).toHaveTextContent(
      '100.0%'
    );
    expect(screen.getByTestId('risk-gauge-remaining')).toHaveTextContent(
      '43.2m'
    );
    expect(screen.getByText('Overspent by')).toBeInTheDocument();
  });

  it('renders no consumed arc at zero downtime', () => {
    render(<RiskGauge downtimeMinutes={0} windowMinutes={MONTH_MINUTES} />);

    expect(screen.getByTestId('risk-gauge-percent')).toHaveTextContent('0.0%');
    expect(screen.queryByTestId('risk-gauge-value')).not.toBeInTheDocument();
    expect(screen.getByTestId('risk-gauge-track')).toBeInTheDocument();
  });

  it('states that there is no budget to gauge for a 100% target', () => {
    render(
      <RiskGauge
        downtimeMinutes={10}
        windowMinutes={MONTH_MINUTES}
        targetPercentage={100}
      />
    );

    expect(screen.getByTestId('risk-gauge')).toHaveTextContent(
      'No error budget to gauge for a 100% target.'
    );
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
});

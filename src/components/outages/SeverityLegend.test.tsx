import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import SeverityLegend, { SEVERITY_LEGEND } from '@/components/outages/SeverityLegend';

/**
 * #1001 — keyboard support for the severity legend tooltips.
 */
describe('SeverityLegend (#1001)', () => {
  it('renders one entry per severity', () => {
    render(<SeverityLegend />);
    for (const entry of SEVERITY_LEGEND) {
      expect(
        screen.getByTestId(`severity-legend-${entry.severity}`)
      ).toBeInTheDocument();
    }
  });

  it('renders entries in severity order (critical first, low last)', () => {
    render(<SeverityLegend />);
    const group = screen.getByTestId('severity-legend');
    const buttons = Array.from(group.querySelectorAll('button'));
    expect(buttons.map((b) => b.getAttribute('data-testid'))).toEqual([
      'severity-legend-critical',
      'severity-legend-high',
      'severity-legend-medium',
      'severity-legend-low',
    ]);
  });

  it('links each trigger to its tooltip with aria-describedby', () => {
    render(<SeverityLegend />);
    for (const entry of SEVERITY_LEGEND) {
      const trigger = screen.getByTestId(`severity-legend-${entry.severity}`);
      const describedBy = trigger.getAttribute('aria-describedby');
      expect(describedBy).toBeTruthy();
      const tip = document.getElementById(describedBy as string);
      expect(tip).toHaveTextContent(entry.description);
    }
  });

  it('shows the tooltip on focus (keyboard)', () => {
    render(<SeverityLegend />);
    const trigger = screen.getByTestId('severity-legend-critical');
    fireEvent.focus(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(
      screen.getByTestId('severity-legend-tooltip-critical')
    ).not.toHaveClass('sr-only');
  });

  it('shows the tooltip on hover', () => {
    render(<SeverityLegend />);
    const trigger = screen.getByTestId('severity-legend-high');
    fireEvent.mouseEnter(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
  });

  it('dismisses the tooltip with Escape', () => {
    render(<SeverityLegend />);
    const trigger = screen.getByTestId('severity-legend-critical');
    fireEvent.focus(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    fireEvent.keyDown(trigger, { key: 'Escape' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('hides the tooltip on blur', () => {
    render(<SeverityLegend />);
    const trigger = screen.getByTestId('severity-legend-critical');
    fireEvent.focus(trigger);
    fireEvent.blur(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('labels the group for assistive technology', () => {
    render(<SeverityLegend />);
    expect(
      screen.getByRole('group', { name: /severity legend/i })
    ).toBeInTheDocument();
  });
});

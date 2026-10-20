import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import MetricDefinitionTip from '@/components/dashboard/MetricDefinitionTip';

/**
 * #1017 — the KPI definition tooltip: available on hover AND keyboard focus,
 * linked to the trigger for screen readers, dismissible with Escape.
 */
describe('MetricDefinitionTip (#1017)', () => {
  const props = {
    title: 'Mean Time To Resolution',
    definition: 'Average time from detection to resolution.',
  };

  it('renders a labelled trigger button', () => {
    render(<MetricDefinitionTip {...props} />);
    expect(
      screen.getByRole('button', { name: /what is mean time to resolution\?/i })
    ).toBeInTheDocument();
  });

  it('keeps the definition in the DOM and associated via aria-describedby', () => {
    render(<MetricDefinitionTip {...props} />);
    const trigger = screen.getByTestId('metric-definition-trigger');
    const describedBy = trigger.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    const tip = document.getElementById(describedBy as string);
    expect(tip).toHaveTextContent(props.definition);
  });

  it('is collapsed initially', () => {
    render(<MetricDefinitionTip {...props} />);
    expect(screen.getByTestId('metric-definition-trigger')).toHaveAttribute(
      'aria-expanded',
      'false'
    );
  });

  it('reveals the definition on keyboard focus', () => {
    render(<MetricDefinitionTip {...props} />);
    const trigger = screen.getByTestId('metric-definition-trigger');
    fireEvent.focus(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByTestId('metric-definition')).not.toHaveClass('sr-only');
  });

  it('reveals the definition on hover', () => {
    render(<MetricDefinitionTip {...props} />);
    const trigger = screen.getByTestId('metric-definition-trigger');
    fireEvent.mouseEnter(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
  });

  it('hides the definition again on blur', () => {
    render(<MetricDefinitionTip {...props} />);
    const trigger = screen.getByTestId('metric-definition-trigger');
    fireEvent.focus(trigger);
    fireEvent.blur(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('dismisses with Escape', () => {
    render(<MetricDefinitionTip {...props} />);
    const trigger = screen.getByTestId('metric-definition-trigger');
    fireEvent.focus(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    fireEvent.keyDown(trigger, { key: 'Escape' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });
});

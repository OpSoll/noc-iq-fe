import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';

import WebhookStatusPill from '@/components/webhooks/WebhookStatusPill';
import { calculateWebhookHealth } from '@/lib/webhookHealth';
import type { WebhookDelivery } from '@/types/webhook';

const delivery = (
  overrides: Partial<WebhookDelivery> = {}
): WebhookDelivery => ({
  id: 'd1',
  webhook_id: 'w1',
  event: 'outage.created',
  status: 'success',
  response_code: 200,
  created_at: '2026-01-15T10:30:00.000Z',
  ...overrides,
});

const mix = (total: number, failures: number) => [
  ...Array.from({ length: total - failures }, () => delivery()),
  ...Array.from({ length: failures }, () =>
    delivery({ status: 'failed', response_code: 500 })
  ),
];

describe('WebhookStatusPill', () => {
  it('renders a green Healthy pill for a healthy endpoint', () => {
    render(<WebhookStatusPill health={calculateWebhookHealth(mix(10, 0))} />);

    const pill = screen.getByTestId('webhook-status-pill');
    expect(pill).toHaveAttribute('data-status', 'healthy');
    expect(pill).toHaveTextContent('Healthy');
    expect(pill.className).toContain('emerald');
  });

  it('renders a yellow Degraded pill for a degraded endpoint', () => {
    render(<WebhookStatusPill health={calculateWebhookHealth(mix(10, 5))} />);

    const pill = screen.getByTestId('webhook-status-pill');
    expect(pill).toHaveAttribute('data-status', 'degraded');
    expect(pill.className).toContain('amber');
  });

  it('renders a red Disabled pill for an inactive endpoint', () => {
    render(
      <WebhookStatusPill
        health={calculateWebhookHealth(mix(10, 0), { isActive: false })}
      />
    );

    const pill = screen.getByTestId('webhook-status-pill');
    expect(pill).toHaveAttribute('data-status', 'disabled');
    expect(pill.className).toContain('red');
  });

  it('shows the success percentage and sample size on hover', () => {
    render(<WebhookStatusPill health={calculateWebhookHealth(mix(100, 5))} />);

    const pill = screen.getByTestId('webhook-status-pill');
    expect(pill).toHaveAttribute(
      'title',
      '95% success over the last 100 dispatches (95 succeeded, 5 failed)'
    );
  });

  it('describes an endpoint with no history on hover', () => {
    render(<WebhookStatusPill health={calculateWebhookHealth([])} />);
    expect(screen.getByTestId('webhook-status-pill')).toHaveAttribute(
      'title',
      'No deliveries recorded yet'
    );
  });

  it('exposes the status and rate to assistive technology', () => {
    render(<WebhookStatusPill health={calculateWebhookHealth(mix(100, 5))} />);
    expect(
      screen.getByLabelText(/Endpoint health: Healthy\. 95% success/)
    ).toBeInTheDocument();
  });

  it('offers re-enable for a disabled endpoint', async () => {
    const user = userEvent.setup();
    const onReenable = vi.fn();
    render(
      <WebhookStatusPill
        health={calculateWebhookHealth(mix(10, 0), { isActive: false })}
        onReenable={onReenable}
      />
    );

    await user.click(screen.getByTestId('webhook-reenable-button'));
    expect(onReenable).toHaveBeenCalledTimes(1);
  });

  it('hides re-enable for an endpoint that is already active', () => {
    render(
      <WebhookStatusPill
        health={calculateWebhookHealth(mix(10, 0))}
        onReenable={vi.fn()}
      />
    );
    expect(screen.queryByTestId('webhook-reenable-button')).not.toBeInTheDocument();
  });

  it('hides re-enable when no handler is supplied', () => {
    render(
      <WebhookStatusPill
        health={calculateWebhookHealth(mix(10, 0), { isActive: false })}
      />
    );
    expect(screen.queryByTestId('webhook-reenable-button')).not.toBeInTheDocument();
  });
});

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';

import DeliveryHistoryDrawer from '@/components/webhooks/DeliveryHistoryDrawer';
import type { WebhookDelivery } from '@/types/webhook';

const DELIVERIES: WebhookDelivery[] = [
  {
    id: 'ok-1',
    webhook_id: 'w1',
    event: 'outage.created',
    status: 'success',
    response_code: 200,
    created_at: '2026-01-15T10:30:00.000Z',
    request_body: { outage_id: 7 },
    response_body: { ok: true },
    request_headers: { 'Content-Type': 'application/json', 'X-Signature': 'sig' },
    response_headers: { 'X-Request-Id': 'req-1' },
    latency_ms: 120,
    attempts: 1,
  } as WebhookDelivery,
  {
    id: 'fail-1',
    webhook_id: 'w1',
    event: 'sla.breached',
    status: 'failed',
    response_code: 500,
    created_at: '2026-01-15T11:00:00.000Z',
    request_body: { sla_id: 3 },
    response_body: 'upstream exploded',
    latency_ms: 3000,
    attempts: 5,
  } as WebhookDelivery,
];

function renderDrawer(
  props: Partial<React.ComponentProps<typeof DeliveryHistoryDrawer>> = {}
) {
  const onClose = props.onClose ?? vi.fn();
  const onResend = props.onResend ?? vi.fn().mockResolvedValue(undefined);
  render(
    <DeliveryHistoryDrawer
      isOpen
      deliveries={DELIVERIES}
      webhookUrl="https://example.com/hooks/noc"
      onClose={onClose}
      onResend={onResend}
      {...props}
    />
  );
  return { onClose, onResend };
}

describe('DeliveryHistoryDrawer', () => {
  it('renders nothing while closed', () => {
    const { container } = render(
      <DeliveryHistoryDrawer
        isOpen={false}
        deliveries={DELIVERIES}
        onClose={vi.fn()}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('is a labelled modal dialog', () => {
    renderDrawer();
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleName('Delivery history');
  });

  it('shows the endpoint URL in the header', () => {
    renderDrawer();
    expect(
      screen.getByText('https://example.com/hooks/noc')
    ).toBeInTheDocument();
  });

  it('lists each dispatch with its event and timestamp', () => {
    renderDrawer();
    const rows = screen.getAllByTestId('delivery-log-row');
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByText('outage.created')).toBeInTheDocument();
    expect(within(rows[1]).getByText('sla.breached')).toBeInTheDocument();
  });

  it('renders an HTTP status badge for each dispatch', () => {
    renderDrawer();
    const badges = screen.getAllByTestId('delivery-status-badge');
    expect(badges[0]).toHaveTextContent('200 OK');
    expect(badges[0]).toHaveAttribute('data-category', 'success');
    expect(badges[1]).toHaveTextContent('500 Internal Server Error');
    expect(badges[1]).toHaveAttribute('data-category', 'server_error');
  });

  it('shows latency and attempt count in the row summary', () => {
    renderDrawer();
    const rows = screen.getAllByTestId('delivery-log-row');
    expect(rows[0]).toHaveTextContent('120ms');
    expect(rows[0]).toHaveTextContent('attempt 1');
    expect(rows[1]).toHaveTextContent('3000ms');
    expect(rows[1]).toHaveTextContent('attempt 5');
  });

  it('expands a row to reveal headers and bodies', async () => {
    const user = userEvent.setup();
    renderDrawer();

    const toggle = screen.getAllByTestId('delivery-log-toggle')[0];
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByTestId('delivery-log-detail')).not.toBeInTheDocument();

    await user.click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const detail = screen.getByTestId('delivery-log-detail');
    expect(within(detail).getByText('X-Request-Id:')).toBeInTheDocument();
    expect(screen.getByTestId('delivery-request-body')).toHaveTextContent(
      '"outage_id": 7'
    );
    expect(screen.getByTestId('delivery-response-body')).toHaveTextContent(
      '"ok": true'
    );
  });

  it('collapses a row when toggled again', async () => {
    const user = userEvent.setup();
    renderDrawer();

    const toggle = screen.getAllByTestId('delivery-log-toggle')[0];
    await user.click(toggle);
    await user.click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByTestId('delivery-log-detail')).not.toBeInTheDocument();
  });

  it('shows only one row expanded at a time', async () => {
    const user = userEvent.setup();
    renderDrawer();

    const toggles = screen.getAllByTestId('delivery-log-toggle');
    await user.click(toggles[0]);
    await user.click(toggles[1]);

    expect(screen.getAllByTestId('delivery-log-detail')).toHaveLength(1);
  });

  it('does not render sensitive request headers in the inspector', async () => {
    const user = userEvent.setup();
    renderDrawer();

    await user.click(screen.getAllByTestId('delivery-log-toggle')[0]);

    expect(screen.getByTestId('delivery-log-detail')).toHaveTextContent(
      'Content-Type:'
    );
    expect(screen.getByTestId('delivery-log-detail')).not.toHaveTextContent(
      'X-Signature:'
    );
  });

  it('re-sends the payload for an expanded dispatch', async () => {
    const user = userEvent.setup();
    const { onResend } = renderDrawer();

    await user.click(screen.getAllByTestId('delivery-log-toggle')[1]);
    await user.click(screen.getByTestId('delivery-resend-button'));

    await waitFor(() => expect(onResend).toHaveBeenCalledTimes(1));
    expect(onResend.mock.calls[0][0]).toMatchObject({ id: 'fail-1' });
  });

  it('hides the re-send action when no handler is supplied', async () => {
    const user = userEvent.setup();
    renderDrawer({ onResend: undefined });

    await user.click(screen.getAllByTestId('delivery-log-toggle')[0]);
    expect(screen.queryByTestId('delivery-resend-button')).not.toBeInTheDocument();
  });

  it('closes via the labelled close button', async () => {
    const user = userEvent.setup();
    const { onClose } = renderDrawer();

    await user.click(screen.getByRole('button', { name: /close delivery history/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it('closes on a backdrop click', async () => {
    const user = userEvent.setup();
    const { onClose } = renderDrawer();

    const backdrop = document.querySelector('[data-backdrop]');
    await user.click(backdrop as Element);
    expect(onClose).toHaveBeenCalled();
  });

  it('shows an empty state with no dispatches', () => {
    renderDrawer({ deliveries: [] });
    expect(
      screen.getByText('No dispatches recorded for this endpoint yet.')
    ).toBeInTheDocument();
  });

  it('shows a loading state', () => {
    renderDrawer({ isLoading: true });
    expect(screen.getByText('Loading dispatches…')).toBeInTheDocument();
    expect(screen.queryAllByTestId('delivery-log-row')).toHaveLength(0);
  });

  it('renders a non-JSON response body verbatim', async () => {
    const user = userEvent.setup();
    renderDrawer();

    await user.click(screen.getAllByTestId('delivery-log-toggle')[1]);
    expect(screen.getByTestId('delivery-response-body')).toHaveTextContent(
      'upstream exploded'
    );
  });
});

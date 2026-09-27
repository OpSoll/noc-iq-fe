import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';

import SchemaViewerModal from '@/components/webhooks/SchemaViewerModal';
import { WEBHOOK_EVENTS } from '@/lib/webhookEvents';
import { ToastProvider } from '@/components/ui/toast';

function renderModal(
  props: Partial<React.ComponentProps<typeof SchemaViewerModal>> = {}
) {
  const onClose = props.onClose ?? vi.fn();
  render(
    <ToastProvider>
      <SchemaViewerModal isOpen onClose={onClose} {...props} />
    </ToastProvider>
  );
  return { onClose };
}

describe('SchemaViewerModal', () => {
  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders nothing while closed', () => {
    const { container } = render(
      <ToastProvider>
        <SchemaViewerModal isOpen={false} onClose={vi.fn()} />
      </ToastProvider>
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('shows a tab for every supported event type', () => {
    renderModal();

    for (const event of WEBHOOK_EVENTS) {
      expect(screen.getByTestId(`schema-tab-${event.topic}`)).toBeInTheDocument();
    }
    expect(screen.getAllByRole('tab')).toHaveLength(WEBHOOK_EVENTS.length);
  });

  it('renders the first event by default', () => {
    renderModal();
    expect(screen.getByTestId('schema-active-description')).toHaveTextContent(
      WEBHOOK_EVENTS[0].description
    );
  });

  it('honours initialTopic', () => {
    renderModal({ initialTopic: 'sla.breached' });
    expect(screen.getByTestId('schema-tab-sla.breached')).toHaveAttribute(
      'aria-selected',
      'true'
    );
  });

  it('ignores an unknown initialTopic', () => {
    renderModal({ initialTopic: 'made.up' });
    expect(screen.getByTestId('schema-tab-outage.created')).toHaveAttribute(
      'aria-selected',
      'true'
    );
  });

  it('switches the rendered schema when a tab is selected', async () => {
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByTestId('schema-tab-payment.processed'));

    expect(screen.getByTestId('schema-json')).toHaveTextContent(
      'payment_id'
    );
    expect(screen.getByTestId('schema-active-description')).toHaveTextContent(
      getEvent('payment.processed').description
    );
  });

  it('renders valid JSON Schema for the active event', () => {
    renderModal({ initialTopic: 'outage.created' });

    const raw = screen.getByTestId('schema-json').textContent ?? '';
    const parsed = JSON.parse(raw);
    expect(parsed.$schema).toBe('https://json-schema.org/draft/2020-12/schema');
    expect(parsed.title).toBe('outage.created event');
  });

  it('renders an example payload for the active event', () => {
    renderModal({ initialTopic: 'sla.breached' });

    const raw = screen.getByTestId('schema-example').textContent ?? '';
    const parsed = JSON.parse(raw);
    expect(parsed.event).toBe('sla.breached');
    expect(parsed.penalty_asset).toBe('USDC');
  });

  it('copies the JSON Schema for the active event', async () => {
    const user = userEvent.setup();
    renderModal({ initialTopic: 'outage.created' });

    await user.click(screen.getByTestId('schema-json-copy'));

    const copied = vi.mocked(navigator.clipboard.writeText).mock.calls[0][0];
    expect(JSON.parse(copied).title).toBe('outage.created event');
    expect(
      screen.getByTestId('schema-json-copy')
    ).toHaveTextContent('Copied');
  });

  it('copies the example payload for the active event', async () => {
    const user = userEvent.setup();
    renderModal({ initialTopic: 'outage.resolved' });

    await user.click(screen.getByTestId('schema-example-copy'));

    const copied = vi.mocked(navigator.clipboard.writeText).mock.calls[0][0];
    expect(JSON.parse(copied).event).toBe('outage.resolved');
  });

  it('clears the copied indicator when the tab changes', async () => {
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByTestId('schema-json-copy'));
    expect(screen.getByTestId('schema-json-copy')).toHaveTextContent('Copied');

    await user.click(screen.getByTestId('schema-tab-sla.breached'));
    expect(screen.getByTestId('schema-json-copy')).toHaveTextContent(
      'Copy JSON Schema'
    );
  });

  it('marks exactly one tab as selected', async () => {
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByTestId('schema-tab-dispute.opened'));

    const selected = screen
      .getAllByRole('tab')
      .filter((tab) => tab.getAttribute('aria-selected') === 'true');
    expect(selected).toHaveLength(1);
  });

  it('closes on Escape', async () => {
    const user = userEvent.setup();
    const { onClose } = renderModal();

    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });
});

function getEvent(topic: string) {
  return WEBHOOK_EVENTS.find((e) => e.topic === topic)!;
}

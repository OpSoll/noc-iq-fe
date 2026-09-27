import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';

import DeadLetterTable from '@/components/webhooks/DeadLetterTable';
import type { DeadLetterItem } from '@/lib/webhookDeadLetter';
import type { WebhookDelivery } from '@/types/webhook';

const dead = (id: string, overrides: Partial<WebhookDelivery> = {}) =>
  ({
    id,
    webhook_id: 'w1',
    event: 'outage.created',
    status: 'failed',
    response_code: 500,
    created_at: '2026-01-15T10:30:00.000Z',
    attempts: 5,
    ...overrides,
  }) as WebhookDelivery;

const DELIVERIES = [
  dead('dl-1', { response_code: 503, event: 'outage.created' }),
  dead('dl-2', { response_code: 404, event: 'sla.breached' }),
  // Still has retries left, so it should not appear in the queue.
  dead('pending-1', { attempts: 2 }),
];

function renderTable(
  props: Partial<React.ComponentProps<typeof DeadLetterTable>> = {}
) {
  const onReplayBatch = props.onReplayBatch ?? vi.fn().mockResolvedValue(undefined);
  const onPurgeSelected =
    props.onPurgeSelected ?? vi.fn().mockResolvedValue(undefined);
  render(
    <DeadLetterTable
      deliveries={DELIVERIES}
      webhookUrl="https://example.com/hooks/noc"
      onReplayBatch={onReplayBatch}
      onPurgeSelected={onPurgeSelected}
      {...props}
    />
  );
  return { onReplayBatch, onPurgeSelected };
}

describe('DeadLetterTable', () => {
  it('lists only dispatches that exhausted their retries', () => {
    renderTable();

    const rows = screen.getAllByTestId('dead-letter-row');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('outage.created');
    expect(rows[1]).toHaveTextContent('sla.breached');
  });

  it('shows the error and retry count for each dispatch', () => {
    renderTable();

    const rows = screen.getAllByTestId('dead-letter-row');
    expect(rows[0]).toHaveTextContent('HTTP 503');
    expect(rows[0]).toHaveTextContent('5');
    expect(rows[1]).toHaveTextContent('HTTP 404');
  });

  it('shows the endpoint and last attempt time', () => {
    renderTable();
    const row = screen.getAllByTestId('dead-letter-row')[0];
    expect(row).toHaveTextContent('https://example.com/hooks/noc');
    expect(row).toHaveTextContent(/15/);
  });

  it('reports the queue size', () => {
    renderTable();
    expect(screen.getByText(/2 exhausted dispatch/)).toBeInTheDocument();
  });

  it('disables both batch actions with nothing selected', () => {
    renderTable();

    expect(screen.getByTestId('dead-letter-replay')).toBeDisabled();
    expect(screen.getByTestId('dead-letter-purge')).toBeDisabled();
    expect(screen.getByText('0 selected')).toBeInTheDocument();
  });

  it('enables batch replay once a row is selected', async () => {
    const user = userEvent.setup();
    renderTable();

    await user.click(screen.getAllByTestId('dead-letter-select')[0]);

    expect(screen.getByText('1 selected')).toBeInTheDocument();
    expect(screen.getByTestId('dead-letter-replay')).toBeEnabled();
    expect(screen.getByTestId('dead-letter-purge')).toBeEnabled();
  });

  it('replays the selected dispatches', async () => {
    const user = userEvent.setup();
    const { onReplayBatch } = renderTable();

    const boxes = screen.getAllByTestId('dead-letter-select');
    await user.click(boxes[0]);
    await user.click(boxes[1]);
    await user.click(screen.getByTestId('dead-letter-replay'));

    await waitFor(() => expect(onReplayBatch).toHaveBeenCalledTimes(1));
    const items = onReplayBatch.mock.calls[0][0] as DeadLetterItem[];
    expect(items.map((i) => i.id)).toEqual(['dl-1', 'dl-2']);
  });

  it('replays only the checked dispatches', async () => {
    const user = userEvent.setup();
    const { onReplayBatch } = renderTable();

    await user.click(screen.getAllByTestId('dead-letter-select')[1]);
    await user.click(screen.getByTestId('dead-letter-replay'));

    await waitFor(() => expect(onReplayBatch).toHaveBeenCalled());
    const items = onReplayBatch.mock.calls[0][0] as DeadLetterItem[];
    expect(items.map((i) => i.id)).toEqual(['dl-2']);
  });

  it('purges the selected dispatches', async () => {
    const user = userEvent.setup();
    const { onPurgeSelected } = renderTable();

    await user.click(screen.getAllByTestId('dead-letter-select')[0]);
    await user.click(screen.getByTestId('dead-letter-purge'));

    await waitFor(() => expect(onPurgeSelected).toHaveBeenCalledWith(['dl-1']));
  });

  it('clears the selection after a batch action', async () => {
    const user = userEvent.setup();
    renderTable();

    await user.click(screen.getAllByTestId('dead-letter-select')[0]);
    await user.click(screen.getByTestId('dead-letter-replay'));

    await waitFor(() => expect(screen.getByText('0 selected')).toBeInTheDocument());
    expect(screen.getByTestId('dead-letter-replay')).toBeDisabled();
  });

  it('select all toggles every row', async () => {
    const user = userEvent.setup();
    renderTable();

    const selectAll = screen.getByTestId('dead-letter-select-all') as HTMLInputElement;
    await user.click(selectAll);
    expect(selectAll).toBeChecked();
    expect(screen.getByText('2 selected')).toBeInTheDocument();

    await user.click(selectAll);
    expect(selectAll).not.toBeChecked();
    expect(screen.getByText('0 selected')).toBeInTheDocument();
  });

  it('unselects a row when its checkbox is clicked again', async () => {
    const user = userEvent.setup();
    renderTable();

    const box = screen.getAllByTestId('dead-letter-select')[0] as HTMLInputElement;
    await user.click(box);
    expect(box).toBeChecked();
    await user.click(box);
    expect(box).not.toBeChecked();
    expect(screen.getByTestId('dead-letter-replay')).toBeDisabled();
  });

  it('shows an empty state when the queue is clear', () => {
    renderTable({ deliveries: [] });
    expect(
      screen.getByText('Nothing in the dead-letter queue. All dispatches succeeded.')
    ).toBeInTheDocument();
  });

  it('shows a loading state', () => {
    renderTable({ isLoading: true });
    expect(screen.getByText('Loading dead-letter queue…')).toBeInTheDocument();
  });

  it('explains why replay is unavailable', () => {
    renderTable();
    expect(screen.getByTestId('dead-letter-replay')).toHaveAttribute(
      'title',
      'Select at least one dispatch'
    );
  });

  it('does not crash when no batch handlers are supplied', async () => {
    const user = userEvent.setup();
    renderTable({ onReplayBatch: undefined, onPurgeSelected: undefined });

    await user.click(screen.getAllByTestId('dead-letter-select')[0]);
    await user.click(screen.getByTestId('dead-letter-replay'));
    await user.click(screen.getByTestId('dead-letter-purge'));

    expect(screen.getAllByTestId('dead-letter-row')).toHaveLength(2);
  });
});

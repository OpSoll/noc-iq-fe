import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';

import DeleteWebhookModal from '@/components/webhooks/DeleteWebhookModal';
import { ToastProvider } from '@/components/ui/toast';
import type { Webhook } from '@/types/webhook';

const WEBHOOK: Webhook = {
  id: 'w1',
  url: 'https://example.com/hooks/noc',
  events: ['outage.created', 'sla.breached'],
  active: true,
  created_at: '2026-01-01T00:00:00.000Z',
};

const LABEL = 'example.com/noc';

function renderModal(
  props: Partial<React.ComponentProps<typeof DeleteWebhookModal>> = {}
) {
  const onClose = props.onClose ?? vi.fn();
  const onDelete = props.onDelete ?? vi.fn().mockResolvedValue(undefined);
  render(
    <ToastProvider>
      <DeleteWebhookModal
        isOpen
        webhook={props.webhook ?? WEBHOOK}
        onDelete={onDelete}
        onClose={onClose}
        {...props}
      />
    </ToastProvider>
  );
  return { onClose, onDelete };
}

describe('DeleteWebhookModal', () => {
  it('renders nothing while closed', () => {
    const { container } = render(
      <ToastProvider>
        <DeleteWebhookModal
          isOpen={false}
          webhook={WEBHOOK}
          onDelete={vi.fn()}
          onClose={vi.fn()}
        />
      </ToastProvider>
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('names the endpoint that will stop receiving deliveries', () => {
    renderModal();

    expect(
      screen.getByText('This stops all deliveries to')
    ).toBeInTheDocument();
    expect(
      screen.getByText('https://example.com/hooks/noc')
    ).toBeInTheDocument();
  });

  it('warns that deletion cannot be undone', () => {
    renderModal();
    expect(screen.getByText(/cannot be undone/i)).toBeInTheDocument();
  });

  it('lists the subscribed topics', () => {
    renderModal();
    expect(
      screen.getByText('outage.created, sla.breached')
    ).toBeInTheDocument();
  });

  it('shows a short label to type', () => {
    renderModal();
    expect(screen.getByTestId('delete-confirm-label')).toHaveTextContent(LABEL);
  });

  it('keeps Delete disabled until the endpoint is typed', async () => {
    const user = userEvent.setup();
    renderModal();

    expect(screen.getByTestId('delete-confirm-button')).toBeDisabled();

    await user.type(screen.getByTestId('delete-confirm-input'), 'example.com');

    expect(screen.getByTestId('delete-confirm-button')).toBeDisabled();
  });

  it('enables Delete on an exact match', async () => {
    const user = userEvent.setup();
    renderModal();

    await user.type(screen.getByTestId('delete-confirm-input'), LABEL);

    expect(screen.getByTestId('delete-confirm-button')).toBeEnabled();
  });

  it('does not delete on a partial match', async () => {
    const user = userEvent.setup();
    const { onDelete } = renderModal();

    await user.type(screen.getByTestId('delete-confirm-input'), 'example.com');
    await user.click(screen.getByTestId('delete-confirm-button'));

    expect(onDelete).not.toHaveBeenCalled();
  });

  it('shows a mismatch message', async () => {
    const user = userEvent.setup();
    renderModal();

    const input = screen.getByTestId('delete-confirm-input');
    await user.type(input, 'example.com');
    await user.tab();

    expect(await screen.findByTestId('delete-confirm-error')).toHaveTextContent(
      'The text does not match the endpoint.'
    );
  });

  it('deletes the endpoint and confirms with a toast', async () => {
    const user = userEvent.setup();
    const { onDelete, onClose } = renderModal();

    await user.type(screen.getByTestId('delete-confirm-input'), LABEL);
    await user.click(screen.getByTestId('delete-confirm-button'));

    await waitFor(() => expect(onDelete).toHaveBeenCalledWith('w1'));
    expect(onClose).toHaveBeenCalled();
    expect(
      await screen.findByText('Webhook endpoint deleted')
    ).toBeInTheDocument();
  });

  it('keeps the modal open and reports a deletion failure', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn().mockRejectedValue(new Error('Endpoint is locked'));
    const { onClose } = renderModal({ onDelete });

    await user.type(screen.getByTestId('delete-confirm-input'), LABEL);
    await user.click(screen.getByTestId('delete-confirm-button'));

    expect(await screen.findByTestId('delete-confirm-error')).toHaveTextContent(
      'Endpoint is locked'
    );
    expect(onClose).not.toHaveBeenCalled();
  });

  it('marks the input invalid for a non-matching value', async () => {
    const user = userEvent.setup();
    renderModal();

    await user.type(screen.getByTestId('delete-confirm-input'), 'wrong');

    expect(screen.getByTestId('delete-confirm-input')).toHaveAttribute(
      'aria-invalid',
      'true'
    );
  });

  it('does not mark the input invalid while it is empty', () => {
    renderModal();
    expect(screen.getByTestId('delete-confirm-input')).toHaveAttribute(
      'aria-invalid',
      'false'
    );
  });

  it('clears the error once the value changes', async () => {
    const user = userEvent.setup();
    renderModal();

    await user.type(screen.getByTestId('delete-confirm-input'), 'wrong');
    await user.tab();
    expect(screen.getByTestId('delete-confirm-error')).toBeInTheDocument();

    await user.type(screen.getByTestId('delete-confirm-input'), 'x');
    expect(screen.queryByTestId('delete-confirm-error')).not.toBeInTheDocument();
  });

  it('disables the actions while the deletion is in flight', () => {
    renderModal({ isDeleting: true });

    expect(screen.getByTestId('delete-confirm-button')).toBeDisabled();
    expect(screen.getByTestId('delete-confirm-button')).toHaveTextContent(
      'Deleting…'
    );
    expect(screen.getByRole('button', { name: /cancel/i })).toBeDisabled();
  });

  it('closes via Cancel without deleting', async () => {
    const user = userEvent.setup();
    const { onClose, onDelete } = renderModal();

    await user.type(screen.getByTestId('delete-confirm-input'), LABEL);
    await user.click(screen.getByRole('button', { name: /cancel/i }));

    expect(onClose).toHaveBeenCalled();
    expect(onDelete).not.toHaveBeenCalled();
  });
});

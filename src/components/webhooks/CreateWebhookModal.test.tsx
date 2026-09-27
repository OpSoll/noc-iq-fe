import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';

import CreateWebhookModal from '@/components/webhooks/CreateWebhookModal';
import { ToastProvider } from '@/components/ui/toast';

const VALID_URL = 'https://example.com/hooks/noc';

function renderModal(
  props: Partial<React.ComponentProps<typeof CreateWebhookModal>> = {}
) {
  const onCreate = props.onCreate ?? vi.fn().mockResolvedValue(undefined);
  const onClose = props.onClose ?? vi.fn();
  render(
    <ToastProvider>
      <CreateWebhookModal
        isOpen
        onCreate={onCreate}
        onClose={onClose}
        requireHttps
        {...props}
      />
    </ToastProvider>
  );
  return { onCreate, onClose };
}

async function fillValidForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByTestId('webhook-url-input'), VALID_URL);
  await user.click(screen.getByTestId('webhook-topic-outage.created'));
}

describe('CreateWebhookModal', () => {
  it('renders nothing while closed', () => {
    const { container } = render(
      <ToastProvider>
        <CreateWebhookModal
          isOpen={false}
          onCreate={vi.fn()}
          onClose={vi.fn()}
        />
      </ToastProvider>
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('provides inputs for URL, description, secret, and topics', () => {
    renderModal();

    expect(screen.getByLabelText(/target url/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/signing secret/i)).toBeInTheDocument();
    expect(
      screen.getByRole('group', { name: /event topics/i })
    ).toBeInTheDocument();
  });

  it('lists every supported event topic as a checkbox', () => {
    renderModal();

    expect(
      screen.getByTestId('webhook-topic-outage.created')
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('webhook-topic-outage.resolved')
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('webhook-topic-payment.processed')
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('webhook-topic-sla.breached')
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('webhook-topic-dispute.opened')
    ).toBeInTheDocument();
  });

  it('rejects a malformed URL and does not call onCreate', async () => {
    const user = userEvent.setup();
    const { onCreate } = renderModal();

    await user.type(screen.getByTestId('webhook-url-input'), 'not-a-url');
    await user.click(screen.getByTestId('webhook-topic-outage.created'));
    await user.click(screen.getByTestId('webhook-submit'));

    expect(await screen.findByTestId('webhook-url-error')).toBeInTheDocument();
    expect(onCreate).not.toHaveBeenCalled();
  });

  it('forces HTTPS in production', async () => {
    const user = userEvent.setup();
    const { onCreate } = renderModal({ requireHttps: true });

    await user.type(
      screen.getByTestId('webhook-url-input'),
      'http://example.com/hook'
    );
    await user.click(screen.getByTestId('webhook-topic-outage.created'));
    await user.click(screen.getByTestId('webhook-submit'));

    expect(await screen.findByTestId('webhook-url-error')).toHaveTextContent(
      /HTTPS/
    );
    expect(onCreate).not.toHaveBeenCalled();
  });

  it('rejects an internal host', async () => {
    const user = userEvent.setup();
    const { onCreate } = renderModal();

    await user.type(
      screen.getByTestId('webhook-url-input'),
      'https://127.0.0.1/hook'
    );
    await user.click(screen.getByTestId('webhook-topic-outage.created'));
    await user.click(screen.getByTestId('webhook-submit'));

    expect(await screen.findByTestId('webhook-url-error')).toHaveTextContent(
      /publicly routable/
    );
    expect(onCreate).not.toHaveBeenCalled();
  });

  it('requires at least one topic', async () => {
    const user = userEvent.setup();
    const { onCreate } = renderModal();

    await user.type(screen.getByTestId('webhook-url-input'), VALID_URL);
    await user.click(screen.getByTestId('webhook-submit'));

    expect(await screen.findByTestId('webhook-topics-error')).toBeInTheDocument();
    expect(onCreate).not.toHaveBeenCalled();
  });

  it('rejects a too-short secret', async () => {
    const user = userEvent.setup();
    const { onCreate } = renderModal();

    await user.type(screen.getByTestId('webhook-url-input'), VALID_URL);
    await user.type(screen.getByTestId('webhook-secret-input'), 'short');
    await user.click(screen.getByTestId('webhook-topic-outage.created'));
    await user.click(screen.getByTestId('webhook-submit'));

    expect(await screen.findByTestId('webhook-secret-error')).toBeInTheDocument();
    expect(onCreate).not.toHaveBeenCalled();
  });

  it('submits the entered values', async () => {
    const user = userEvent.setup();
    const { onCreate, onClose } = renderModal();

    await user.type(screen.getByTestId('webhook-url-input'), VALID_URL);
    await user.type(
      screen.getByTestId('webhook-description-input'),
      'Primary alerting receiver'
    );
    await user.type(
      screen.getByTestId('webhook-secret-input'),
      'my-super-secret-key'
    );
    await user.click(screen.getByTestId('webhook-topic-outage.created'));
    await user.click(screen.getByTestId('webhook-topic-sla.breached'));
    await user.click(screen.getByTestId('webhook-submit'));

    await waitFor(() =>
      expect(onCreate).toHaveBeenCalledWith({
        url: VALID_URL,
        description: 'Primary alerting receiver',
        secret: 'my-super-secret-key',
        events: ['outage.created', 'sla.breached'],
      })
    );
    expect(onClose).toHaveBeenCalled();
  });

  it('generates a secret when the field is left blank', async () => {
    const user = userEvent.setup();
    const { onCreate } = renderModal();

    await user.type(screen.getByTestId('webhook-url-input'), VALID_URL);
    await user.click(screen.getByTestId('webhook-topic-outage.created'));
    await user.click(screen.getByTestId('webhook-submit'));

    await waitFor(() => expect(onCreate).toHaveBeenCalled());
    const payload = onCreate.mock.calls[0][0];
    expect(payload.secret).toMatch(/^whsec_/);
    expect(payload.secret.length).toBeGreaterThanOrEqual(16);
  });

  it('generates a secret on demand and fills the field', async () => {
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByTestId('webhook-generate-secret'));

    const input = screen.getByTestId(
      'webhook-secret-input'
    ) as HTMLInputElement;
    expect(input.value).toMatch(/^whsec_/);
    expect(screen.getByTestId('webhook-generated-secret')).toBeInTheDocument();
  });

  it('toggles a topic off when clicked twice', async () => {
    const user = userEvent.setup();
    const { onCreate } = renderModal();

    const checkbox = screen.getByTestId(
      'webhook-topic-outage.created'
    ) as HTMLInputElement;
    await user.click(checkbox);
    expect(checkbox).toBeChecked();
    await user.click(checkbox);
    expect(checkbox).not.toBeChecked();

    await user.type(screen.getByTestId('webhook-url-input'), VALID_URL);
    await user.click(screen.getByTestId('webhook-submit'));
    expect(await screen.findByTestId('webhook-topics-error')).toBeInTheDocument();
    expect(onCreate).not.toHaveBeenCalled();
  });

  it('surfaces a registration failure and stays open', async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn().mockRejectedValue(new Error('URL already registered'));
    const { onClose } = renderModal({ onCreate });

    await user.type(screen.getByTestId('webhook-url-input'), VALID_URL);
    await user.click(screen.getByTestId('webhook-topic-outage.created'));
    await user.click(screen.getByTestId('webhook-submit'));

    expect(await screen.findByText('URL already registered')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('re-validates a previously bad field once it is corrected', async () => {
    const user = userEvent.setup();
    const { onCreate } = renderModal();

    await user.type(screen.getByTestId('webhook-url-input'), 'bad');
    await user.click(screen.getByTestId('webhook-submit'));
    expect(await screen.findByTestId('webhook-url-error')).toBeInTheDocument();

    await user.clear(screen.getByTestId('webhook-url-input'));
    await user.type(screen.getByTestId('webhook-url-input'), VALID_URL);
    await user.click(screen.getByTestId('webhook-topic-outage.created'));
    await user.click(screen.getByTestId('webhook-submit'));

    await waitFor(() => expect(onCreate).toHaveBeenCalled());
  });

  it('does not submit on an empty form', async () => {
    const user = userEvent.setup();
    const { onCreate } = renderModal();

    await user.click(screen.getByTestId('webhook-submit'));

    expect(await screen.findByTestId('webhook-url-error')).toBeInTheDocument();
    expect(screen.getByTestId('webhook-topics-error')).toBeInTheDocument();
    expect(onCreate).not.toHaveBeenCalled();
  });
});

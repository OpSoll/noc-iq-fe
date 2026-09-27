import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';

import PingButton from '@/components/webhooks/PingButton';
import { ToastProvider } from '@/components/ui/toast';

function renderButton(
  onPing = vi.fn().mockResolvedValue({ statusCode: 200, latencyMs: 120 })
) {
  render(
    <ToastProvider>
      <PingButton
        webhookId="w1"
        url="https://example.com/hooks/noc"
        onPing={onPing}
      />
    </ToastProvider>
  );
  return { onPing };
}

describe('PingButton', () => {
  it('renders a Send Test Ping button', () => {
    renderButton();
    expect(
      screen.getByRole('button', { name: /send test ping/i })
    ).toBeInTheDocument();
  });

  it('sends the ping for the right endpoint', async () => {
    const user = userEvent.setup();
    const { onPing } = renderButton();

    await user.click(screen.getByTestId('webhook-ping-button'));

    await waitFor(() => expect(onPing).toHaveBeenCalledWith('w1'));
  });

  it('shows an inline spinner while the ping is in flight', async () => {
    const user = userEvent.setup();
    let resolve: (value: { statusCode: number; latencyMs: number }) => void =
      () => {};
    const onPing = vi.fn(
      () =>
        new Promise<{ statusCode: number; latencyMs: number }>((r) => {
          resolve = r;
        })
    );
    renderButton(onPing);

    await user.click(screen.getByTestId('webhook-ping-button'));

    expect(screen.getByTestId('webhook-ping-spinner')).toBeInTheDocument();
    expect(screen.getByTestId('webhook-ping-button')).toHaveAttribute(
      'aria-busy',
      'true'
    );
    expect(screen.getByTestId('webhook-ping-button')).toBeDisabled();

    resolve({ statusCode: 200, latencyMs: 10 });
    await waitFor(() =>
      expect(
        screen.queryByTestId('webhook-ping-spinner')
      ).not.toBeInTheDocument()
    );
  });

  it('confirms a successful ping with the status code', async () => {
    const user = userEvent.setup();
    renderButton(vi.fn().mockResolvedValue({ statusCode: 200, latencyMs: 120 }));

    await user.click(screen.getByTestId('webhook-ping-button'));

    expect(
      await screen.findByText('Ping successful: 200 OK')
    ).toBeInTheDocument();
    expect(screen.getByTestId('webhook-ping-result')).toHaveAttribute(
      'data-ok',
      'true'
    );
  });

  it('shows the round-trip latency in the detail line', async () => {
    const user = userEvent.setup();
    renderButton(vi.fn().mockResolvedValue({ statusCode: 200, latencyMs: 120 }));

    await user.click(screen.getByTestId('webhook-ping-button'));

    expect(await screen.findByText(/responded in 120ms/)).toBeInTheDocument();
  });

  it('reports a failing status as an error', async () => {
    const user = userEvent.setup();
    renderButton(vi.fn().mockResolvedValue({ statusCode: 500, latencyMs: 300 }));

    await user.click(screen.getByTestId('webhook-ping-button'));

    const result = await screen.findByTestId('webhook-ping-result');
    expect(result).toHaveAttribute('data-ok', 'false');
    expect(result).toHaveTextContent('Ping failed: 500 Internal Server Error');
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('treats a redirect as a failure and explains why', async () => {
    const user = userEvent.setup();
    renderButton(vi.fn().mockResolvedValue({ statusCode: 302, latencyMs: 50 }));

    await user.click(screen.getByTestId('webhook-ping-button'));

    expect(await screen.findByTestId('webhook-ping-result')).toHaveTextContent(
      'redirected instead of accepting the delivery'
    );
  });

  it('reports an unreachable endpoint', async () => {
    const user = userEvent.setup();
    renderButton(vi.fn().mockRejectedValue(new Error('ECONNREFUSED')));

    await user.click(screen.getByTestId('webhook-ping-button'));

    const result = await screen.findByTestId('webhook-ping-result');
    expect(result).toHaveAttribute('data-ok', 'false');
    expect(result).toHaveTextContent('Ping failed: endpoint unreachable');
    expect(result).toHaveTextContent('ECONNREFUSED');
  });

  it('handles a non-Error rejection', async () => {
    const user = userEvent.setup();
    renderButton(vi.fn().mockRejectedValue('boom'));

    await user.click(screen.getByTestId('webhook-ping-button'));

    expect(await screen.findByTestId('webhook-ping-result')).toHaveTextContent(
      'Ping failed: endpoint unreachable'
    );
  });

  it('re-enables the button after a failed ping', async () => {
    const user = userEvent.setup();
    renderButton(vi.fn().mockRejectedValue(new Error('nope')));

    await user.click(screen.getByTestId('webhook-ping-button'));
    await screen.findByTestId('webhook-ping-result');

    expect(screen.getByTestId('webhook-ping-button')).toBeEnabled();
  });

  it('replaces the previous result when pinging again', async () => {
    const user = userEvent.setup();
    renderButton(vi.fn().mockResolvedValue({ statusCode: 200, latencyMs: 10 }));

    await user.click(screen.getByTestId('webhook-ping-button'));
    await screen.findByTestId('webhook-ping-result');

    await user.click(screen.getByTestId('webhook-ping-button'));
    await waitFor(() =>
      expect(screen.getAllByTestId('webhook-ping-result')).toHaveLength(1)
    );
  });

  it('ignores a second click while a ping is in flight', async () => {
    const user = userEvent.setup();
    let resolve: (value: { statusCode: number; latencyMs: number }) => void =
      () => {};
    const onPing = vi.fn(
      () =>
        new Promise<{ statusCode: number; latencyMs: number }>((r) => {
          resolve = r;
        })
    );
    renderButton(onPing);

    const button = screen.getByTestId('webhook-ping-button');
    await user.click(button);
    await user.click(button);

    expect(onPing).toHaveBeenCalledTimes(1);
    resolve({ statusCode: 200, latencyMs: 5 });
    await waitFor(() => expect(button).toBeEnabled());
  });
});

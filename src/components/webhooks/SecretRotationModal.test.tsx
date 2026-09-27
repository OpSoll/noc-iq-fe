import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';

import SecretRotationModal from '@/components/webhooks/SecretRotationModal';
import type { GraceWindowHours } from '@/lib/secretRotation';
import type { Webhook } from '@/types/webhook';

const WEBHOOK: Webhook = {
  id: 'w1',
  url: 'https://example.com/hooks/noc',
  events: ['outage.created'],
  active: true,
  created_at: '2026-01-01T00:00:00.000Z',
  secret_preview: 'whsec_••••••••ab12',
};

function renderModal(
  props: Partial<React.ComponentProps<typeof SecretRotationModal>> = {}
) {
  const onClose = props.onClose ?? vi.fn();
  const onRotate =
    props.onRotate ?? vi.fn().mockResolvedValue('whsec_NEW_SECRET_VALUE');
  render(
    <SecretRotationModal
      isOpen
      webhook={props.webhook ?? WEBHOOK}
      onRotate={onRotate}
      onClose={onClose}
      {...props}
    />
  );
  return { onClose, onRotate };
}

describe('SecretRotationModal', () => {
  it('renders nothing while closed', () => {
    const { container } = render(
      <SecretRotationModal
        isOpen={false}
        webhook={WEBHOOK}
        onRotate={vi.fn()}
        onClose={vi.fn()}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the current secret as a masked preview', () => {
    renderModal();
    expect(screen.getByTestId('secret-rotation-current')).toHaveTextContent(
      'whsec_••••••••ab12'
    );
  });

  it('offers Immediate, 1 Hour, and 24 Hours grace windows', () => {
    renderModal();

    expect(screen.getByText('Immediate')).toBeInTheDocument();
    expect(screen.getByText('1 Hour')).toBeInTheDocument();
    expect(screen.getByText('24 Hours')).toBeInTheDocument();
  });

  it('defaults to the 24 hour window', () => {
    renderModal();
    expect(
      (screen.getByTestId('grace-window-24').querySelector('input') as HTMLInputElement)
        .checked
    ).toBe(true);
  });

  it('rotates with the selected grace window', async () => {
    const user = userEvent.setup();
    const { onRotate, onClose } = renderModal();

    await user.click(
      screen.getByTestId('grace-window-1').querySelector('input') as Element
    );
    await user.click(screen.getByTestId('secret-rotation-submit'));

    await waitFor(() => expect(onRotate).toHaveBeenCalledWith(1 as GraceWindowHours));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('rotates immediately with a zero-hour window', async () => {
    const user = userEvent.setup();
    const { onRotate } = renderModal();

    await user.click(
      screen.getByTestId('grace-window-0').querySelector('input') as Element
    );
    await user.click(screen.getByTestId('secret-rotation-submit'));

    await waitFor(() => expect(onRotate).toHaveBeenCalledWith(0 as GraceWindowHours));
    expect(
      screen.getByRole('button', { name: /rotate immediately/i })
    ).toBeInTheDocument();
  });

  it('displays the new secret with a one-click copy', async () => {
    const user = userEvent.setup();
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
    renderModal();

    await user.click(screen.getByTestId('secret-rotation-submit'));

    const secret = await screen.findByTestId('secret-rotation-new-secret');
    expect(secret).toHaveTextContent('whsec_NEW_SECRET_VALUE');
    expect(
      screen.getByText(/will not be shown again/i)
    ).toBeInTheDocument();

    await user.click(screen.getByTestId('secret-rotation-copy'));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      'whsec_NEW_SECRET_VALUE'
    );
    expect(
      screen.getByRole('button', { name: 'Copied' })
    ).toBeInTheDocument();
  });

  it('does not show a secret block when the handler returns nothing', async () => {
    const user = userEvent.setup();
    renderModal({ onRotate: vi.fn().mockResolvedValue(undefined) });

    await user.click(screen.getByTestId('secret-rotation-submit'));

    await waitFor(() => expect(screen.getByTestId('secret-rotation-submit')).toBeEnabled());
    expect(screen.queryByTestId('secret-rotation-new-secret')).not.toBeInTheDocument();
  });

  it('shows a dual-signature badge while a grace window is active', () => {
    renderModal({
      webhook: {
        ...WEBHOOK,
        secondary_secret_preview: 'whsec_••••••••cd34',
        secondary_secret_expires_at: '2999-01-01T00:00:00.000Z',
      },
    });

    expect(screen.getByTestId('secret-rotation-dual-signature-badge')).toBeInTheDocument();
    expect(screen.getByText('Dual signatures active')).toBeInTheDocument();
    expect(screen.getByTestId('secret-rotation-dual-signature-badge')).toHaveTextContent(
      /remaining/
    );
  });

  it('shows no dual-signature badge before the first rotation', () => {
    renderModal();
    expect(
      screen.queryByTestId('secret-rotation-dual-signature-badge')
    ).not.toBeInTheDocument();
  });

  it('disables rotation while a request is in flight', () => {
    renderModal({ isRotating: true });
    expect(screen.getByTestId('secret-rotation-submit')).toBeDisabled();
    expect(screen.getByTestId('secret-rotation-submit')).toHaveTextContent(
      'Rotating…'
    );
  });

  it('does not allow a second rotation once a secret has been issued', async () => {
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByTestId('secret-rotation-submit'));
    await screen.findByTestId('secret-rotation-new-secret');

    expect(screen.getByTestId('secret-rotation-submit')).toBeDisabled();
  });

  it('closes via the close button', async () => {
    const user = userEvent.setup();
    const { onClose } = renderModal();

    await user.click(screen.getByRole('button', { name: /^close$/i }));
    expect(onClose).toHaveBeenCalled();
  });
});

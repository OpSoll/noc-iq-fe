import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import QrCodeModal from '@/components/wallet/QrCodeModal';
import { ToastProvider } from '@/components/ui/toast';

const PUBLIC_KEY = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';

function renderModal(props: Partial<React.ComponentProps<typeof QrCodeModal>> = {}) {
  const onClose = props.onClose ?? vi.fn();
  const utils = render(
    <ToastProvider>
      <QrCodeModal
        isOpen
        publicKey={PUBLIC_KEY}
        onClose={onClose}
        {...props}
      />
    </ToastProvider>
  );
  return { ...utils, onClose };
}

describe('QrCodeModal', () => {
  const writeText = vi.fn();

  beforeEach(() => {
    writeText.mockReset().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    URL.createObjectURL = vi.fn(() => 'blob:mock');
    URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders nothing while closed', () => {
    const { container } = render(
      <ToastProvider>
        <QrCodeModal isOpen={false} publicKey={PUBLIC_KEY} onClose={vi.fn()} />
      </ToastProvider>
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the public key as an accessible SVG QR code', () => {
    renderModal();

    const svg = screen.getByTestId('qr-code-svg');
    expect(svg.tagName.toLowerCase()).toBe('svg');
    expect(svg).toHaveAttribute('aria-label', expect.stringContaining(PUBLIC_KEY));
    // The dark modules are drawn as a single path, and it is not empty.
    const path = screen.getByTestId('qr-modules');
    expect(path.getAttribute('d')).toMatch(/^M/);
    expect((path.getAttribute('d') ?? '').length).toBeGreaterThan(100);
  });

  it('shows the public key and a 4-module quiet zone', () => {
    renderModal();
    expect(screen.getByTestId('public-key-value')).toHaveValue(PUBLIC_KEY);
    // quiet zone is rendered as a white background rect
    expect(screen.getByTestId('qr-quiet-zone')).toBeInTheDocument();
  });

  it('copies the public key to the clipboard', async () => {
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByRole('button', { name: /copy public key/i }));

    expect(writeText).toHaveBeenCalledWith(PUBLIC_KEY);
    expect(await screen.findByText('Public key copied to clipboard')).toBeInTheDocument();
  });

  it('reports a clipboard failure as an error toast', async () => {
    const user = userEvent.setup();
    writeText.mockRejectedValue(new Error('denied'));
    renderModal();

    await user.click(screen.getByRole('button', { name: /copy public key/i }));

    expect(await screen.findByText('Could not copy the public key')).toBeInTheDocument();
  });

  it('downloads the QR code as an SVG image', async () => {
    const user = userEvent.setup();
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    renderModal();

    await user.click(screen.getByRole('button', { name: /download qr image/i }));

    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock');
  });

  it('closes on Escape', async () => {
    const user = userEvent.setup();
    const { onClose } = renderModal();

    await user.keyboard('{Escape}');

    expect(onClose).toHaveBeenCalled();
  });

  it('closes on a backdrop click', async () => {
    const user = userEvent.setup();
    const { onClose } = renderModal();

    const backdrop = document.querySelector('[data-backdrop]');
    expect(backdrop).not.toBeNull();
    await user.click(backdrop as Element);

    expect(onClose).toHaveBeenCalled();
  });

  it('closes from the labelled close button', async () => {
    const user = userEvent.setup();
    const { onClose } = renderModal();

    await user.click(screen.getByRole('button', { name: /close dialog/i }));

    expect(onClose).toHaveBeenCalled();
  });

  it('trims surrounding whitespace from the key', () => {
    renderModal({ publicKey: `  ${PUBLIC_KEY}  ` });
    expect(screen.getByTestId('public-key-value')).toHaveValue(PUBLIC_KEY);
  });

  it('explains the failure instead of rendering a broken code for an empty key', () => {
    renderModal({ publicKey: '   ' });

    expect(screen.queryByTestId('qr-code-svg')).not.toBeInTheDocument();
    expect(
      within(screen.getByRole('dialog')).getByRole('alert')
    ).toHaveTextContent('No public key available to share.');
  });

  it('adjusts the rendered size with the slider', async () => {
    const user = userEvent.setup();
    renderModal();

    const before = screen.getByTestId('qr-code-svg').getAttribute('width');
    const slider = screen.getByRole('slider');

    await user.clear(slider);
    await user.type(slider, '{arrowright}');

    expect(screen.getByTestId('qr-code-svg').getAttribute('width')).not.toBe(
      before
    );
  });
});

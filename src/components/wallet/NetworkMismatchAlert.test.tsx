import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, afterEach } from 'vitest';

import NetworkMismatchAlert from '@/components/wallet/NetworkMismatchAlert';
import { STELLAR_NETWORKS } from '@/lib/stellarNetworks';

const { testnet, futurenet, public: mainnet } = STELLAR_NETWORKS;

afterEach(() => {
  vi.restoreAllMocks();
});

describe('NetworkMismatchAlert', () => {
  it('renders nothing when the wallet and console are on the same network', () => {
    const { container } = render(
      <NetworkMismatchAlert
        walletPassphrase={testnet.passphrase}
        consolePassphrase={testnet.passphrase}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when the wallet is not connected yet', () => {
    const { container } = render(
      <NetworkMismatchAlert
        walletPassphrase={null}
        consolePassphrase={testnet.passphrase}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders an amber warning banner naming both networks', () => {
    render(
      <NetworkMismatchAlert
        walletPassphrase={testnet.passphrase}
        consolePassphrase={futurenet.passphrase}
      />
    );

    const alert = screen.getByRole('alert');
    expect(alert).toBeInTheDocument();
    expect(alert.className).toContain('amber');
    expect(screen.getByText('Network mismatch detected')).toBeInTheDocument();
    expect(screen.getByText('Testnet')).toBeInTheDocument();
    expect(screen.getByText('Futurenet')).toBeInTheDocument();
  });

  it('flags a mainnet wallet against a testnet console', () => {
    render(
      <NetworkMismatchAlert
        walletPassphrase={mainnet.passphrase}
        consolePassphrase={testnet.passphrase}
      />
    );
    expect(screen.getByText('Mainnet')).toBeInTheDocument();
    expect(screen.getByText('Testnet')).toBeInTheDocument();
  });

  it('hides the Switch Console Network action when no handler is supplied', () => {
    render(
      <NetworkMismatchAlert
        walletPassphrase={testnet.passphrase}
        consolePassphrase={futurenet.passphrase}
      />
    );
    expect(
      screen.queryByRole('button', { name: /switch console network/i })
    ).not.toBeInTheDocument();
  });

  it('offers Switch Console Network and reports the wallet network id', async () => {
    const user = userEvent.setup();
    const onSwitch = vi.fn();

    render(
      <NetworkMismatchAlert
        walletPassphrase={testnet.passphrase}
        consolePassphrase={futurenet.passphrase}
        onSwitchConsoleNetwork={onSwitch}
      />
    );

    await user.click(
      screen.getByRole('button', { name: /switch console network/i })
    );
    expect(onSwitch).toHaveBeenCalledTimes(1);
    expect(onSwitch).toHaveBeenCalledWith('testnet');
  });

  it('omits the quick action for an unrecognised custom network passphrase', () => {
    render(
      <NetworkMismatchAlert
        walletPassphrase="My Private Network ; January 2024"
        consolePassphrase={testnet.passphrase}
        onSwitchConsoleNetwork={vi.fn()}
      />
    );

    expect(screen.getByText('unknown network')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /switch console network/i })
    ).not.toBeInTheDocument();
  });

  it('exposes both raw passphrases for debugging', async () => {
    const user = userEvent.setup();
    render(
      <NetworkMismatchAlert
        walletPassphrase={testnet.passphrase}
        consolePassphrase={futurenet.passphrase}
      />
    );

    await user.click(screen.getByText('Show network passphrases'));
    expect(screen.getByText(testnet.passphrase)).toBeInTheDocument();
    expect(screen.getByText(futurenet.passphrase)).toBeInTheDocument();
  });
});

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { WalletButton } from '@/components/wallet/WalletButton';
import { ToastProvider } from '@/components/ui/toast';
import { useWalletStore } from '@/store/walletStore';
import {
  WALLET_SESSION_KEYS,
  saveWalletSession,
} from '@/lib/walletSession';

const mocks = vi.hoisted(() => ({
  isConnected: vi.fn(),
  getAddress: vi.fn(),
  requestAccess: vi.fn(),
}));

vi.mock('@stellar/freighter-api', () => ({
  isConnected: mocks.isConnected,
  getAddress: mocks.getAddress,
  requestAccess: mocks.requestAccess,
}));

const PUBLIC_KEY = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';

function renderButton() {
  return render(
    <ToastProvider>
      <WalletButton />
    </ToastProvider>
  );
}

describe('WalletButton disconnect', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    useWalletStore.setState({
      publicKey: null,
      passphrase: null,
      network: null,
      isConnecting: false,
      isDisconnecting: false,
    });
    mocks.isConnected.mockReset();
    mocks.getAddress.mockReset();
    mocks.requestAccess.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('restores an authorized wallet and records the session', async () => {
    mocks.isConnected.mockResolvedValue({ isConnected: true });
    mocks.getAddress.mockResolvedValue({ address: PUBLIC_KEY });

    renderButton();

    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: /disconnect wallet/i })
      ).toBeInTheDocument()
    );
    expect(useWalletStore.getState().publicKey).toBe(PUBLIC_KEY);
    expect(window.sessionStorage.getItem('noc_wallet_public_key')).toBe(
      PUBLIC_KEY
    );
  });

  it('resets the wallet store to its unauthenticated default', async () => {
    const user = userEvent.setup();
    mocks.isConnected.mockResolvedValue({ isConnected: true });
    mocks.getAddress.mockResolvedValue({ address: PUBLIC_KEY });

    renderButton();

    const disconnect = await screen.findByRole('button', {
      name: /disconnect wallet/i,
    });
    await user.click(disconnect);

    await waitFor(() =>
      expect(useWalletStore.getState().publicKey).toBeNull()
    );
    expect(useWalletStore.getState().passphrase).toBeNull();
    expect(useWalletStore.getState().network).toBeNull();
    // The connect affordance is available again.
    expect(
      screen.getByRole('button', { name: /connect freighter/i })
    ).toBeInTheDocument();
  });

  it('clears every wallet key from session storage', async () => {
    const user = userEvent.setup();
    mocks.isConnected.mockResolvedValue({ isConnected: true });
    mocks.getAddress.mockResolvedValue({ address: PUBLIC_KEY });

    saveWalletSession({
      publicKey: PUBLIC_KEY,
      passphrase: 'Test SDF Network ; September 2015',
      network: 'TESTNET',
      secret: 'S-super-secret',
    });
    for (const key of WALLET_SESSION_KEYS) {
      expect(window.sessionStorage.getItem(key)).not.toBeNull();
    }

    renderButton();
    const disconnect = await screen.findByRole('button', {
      name: /disconnect wallet/i,
    });
    await user.click(disconnect);

    await waitFor(() =>
      expect(window.sessionStorage.getItem('noc_wallet_secret')).toBeNull()
    );
    for (const key of WALLET_SESSION_KEYS) {
      expect(window.sessionStorage.getItem(key)).toBeNull();
    }
  });

  it('shows a confirmation toast on disconnect', async () => {
    const user = userEvent.setup();
    mocks.isConnected.mockResolvedValue({ isConnected: true });
    mocks.getAddress.mockResolvedValue({ address: PUBLIC_KEY });

    renderButton();
    const disconnect = await screen.findByRole('button', {
      name: /disconnect wallet/i,
    });
    await user.click(disconnect);

    expect(await screen.findByText('Wallet disconnected')).toBeInTheDocument();
  });

  it('invokes the onDisconnect callback', async () => {
    const user = userEvent.setup();
    const onDisconnect = vi.fn();
    mocks.isConnected.mockResolvedValue({ isConnected: true });
    mocks.getAddress.mockResolvedValue({ address: PUBLIC_KEY });

    render(
      <ToastProvider>
        <WalletButton onDisconnect={onDisconnect} />
      </ToastProvider>
    );

    const disconnect = await screen.findByRole('button', {
      name: /disconnect wallet/i,
    });
    await user.click(disconnect);

    expect(onDisconnect).toHaveBeenCalledTimes(1);
  });

  it('keeps tracked token contracts, which are a workspace preference', async () => {
    const user = userEvent.setup();
    const tracked = {
      contractId: 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM',
      symbol: 'USDC',
      balance: '1000',
      decimals: 6,
      addedAt: new Date().toISOString(),
    };
    useWalletStore.setState({ trackedTokens: [tracked] });
    mocks.isConnected.mockResolvedValue({ isConnected: true });
    mocks.getAddress.mockResolvedValue({ address: PUBLIC_KEY });

    renderButton();
    const disconnect = await screen.findByRole('button', {
      name: /disconnect wallet/i,
    });
    await user.click(disconnect);

    expect(useWalletStore.getState().trackedTokens).toEqual([tracked]);
  });
});

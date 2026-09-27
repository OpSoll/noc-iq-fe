import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi, afterEach } from 'vitest';

import AddTokenModal from '@/components/wallet/AddTokenModal';
import { ToastProvider } from '@/components/ui/toast';
import { useWalletStore } from '@/store/walletStore';
import {
  getContractAssetInfo,
  getContractBalance,
} from '@/services/contractService';

vi.mock('@/services/contractService', () => ({
  getContractAssetInfo: vi.fn(),
  getContractBalance: vi.fn(),
}));

const CONTRACT_ID = 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC';
const OWNER = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';

const assetInfoMock = vi.mocked(getContractAssetInfo);
const balanceMock = vi.mocked(getContractBalance);

function renderModal(props: Partial<React.ComponentProps<typeof AddTokenModal>> = {}) {
  const onClose = vi.fn();
  render(
    <ToastProvider>
      <AddTokenModal isOpen onClose={onClose} ownerPublicKey={OWNER} {...props} />
    </ToastProvider>
  );
  return { onClose };
}

describe('AddTokenModal', () => {
  beforeEach(() => {
    useWalletStore.setState({ trackedTokens: [], publicKey: null });
    assetInfoMock.mockReset().mockResolvedValue({ symbol: 'USDC', decimals: 6 });
    balanceMock.mockReset().mockResolvedValue('2500000');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the contract ID field', () => {
    renderModal();
    expect(screen.getByLabelText(/contract id/i)).toBeInTheDocument();
  });

  it('rejects a malformed contract ID before calling the API', async () => {
    const user = userEvent.setup();
    renderModal();

    await user.type(screen.getByTestId('contract-id-input'), 'not-a-contract');
    await user.click(screen.getByTestId('lookup-button'));

    expect(await screen.findByRole('alert')).toHaveTextContent(/56 characters/);
    expect(assetInfoMock).not.toHaveBeenCalled();
    expect(balanceMock).not.toHaveBeenCalled();
  });

  it('keeps the lookup button disabled for an empty field', () => {
    renderModal();
    expect(screen.getByTestId('lookup-button')).toBeDisabled();
  });

  it('queries symbol and balance for a valid contract ID', async () => {
    const user = userEvent.setup();
    renderModal();

    await user.type(screen.getByTestId('contract-id-input'), CONTRACT_ID);
    await user.click(screen.getByTestId('lookup-button'));

    await waitFor(() => expect(assetInfoMock).toHaveBeenCalledWith(CONTRACT_ID));
    expect(balanceMock).toHaveBeenCalledWith(CONTRACT_ID, OWNER);
  });

  it('previews the resolved symbol and formatted balance', async () => {
    const user = userEvent.setup();
    renderModal();

    await user.type(screen.getByTestId('contract-id-input'), CONTRACT_ID);
    await user.click(screen.getByTestId('lookup-button'));

    expect(await screen.findByTestId('token-preview')).toBeInTheDocument();
    expect(screen.getByText('USDC')).toBeInTheDocument();
    // 2500000 raw units at 6 decimals is 2.5 USDC.
    expect(screen.getByTestId('token-balance')).toHaveTextContent('2.5');
  });

  it('persists the tracked token in the workspace store', async () => {
    const user = userEvent.setup();
    renderModal();

    await user.type(screen.getByTestId('contract-id-input'), CONTRACT_ID);
    await user.click(screen.getByTestId('lookup-button'));
    await screen.findByTestId('token-preview');
    await user.click(screen.getByTestId('track-button'));

    const tracked = useWalletStore.getState().trackedTokens;
    expect(tracked).toHaveLength(1);
    expect(tracked[0]).toMatchObject({
      contractId: CONTRACT_ID,
      symbol: 'USDC',
      decimals: 6,
      balance: '2500000',
    });
  });

  it('closes and confirms when the token is tracked', async () => {
    const user = userEvent.setup();
    const { onClose } = renderModal();

    await user.type(screen.getByTestId('contract-id-input'), CONTRACT_ID);
    await user.click(screen.getByTestId('lookup-button'));
    await screen.findByTestId('token-preview');
    await user.click(screen.getByTestId('track-button'));

    expect(onClose).toHaveBeenCalled();
    expect(
      await screen.findByText('USDC added to tracked tokens')
    ).toBeInTheDocument();
  });

  it('surfaces an API failure instead of tracking the token', async () => {
    const user = userEvent.setup();
    assetInfoMock.mockRejectedValue(new Error('Contract not found'));
    renderModal();

    await user.type(screen.getByTestId('contract-id-input'), CONTRACT_ID);
    await user.click(screen.getByTestId('lookup-button'));

    expect(await screen.findByText('Contract not found')).toBeInTheDocument();
    expect(screen.queryByTestId('token-preview')).not.toBeInTheDocument();
    expect(useWalletStore.getState().trackedTokens).toHaveLength(0);
  });

  it('requires a connected wallet before reading a balance', async () => {
    const user = userEvent.setup();
    renderModal({ ownerPublicKey: null });

    await user.type(screen.getByTestId('contract-id-input'), CONTRACT_ID);

    expect(screen.getByText(/connect a wallet before tracking/i)).toBeInTheDocument();
    await user.click(screen.getByTestId('lookup-button'));
    expect(
      await screen.findByText(/Connect a wallet before tracking a token balance/)
    ).toBeInTheDocument();
    expect(balanceMock).not.toHaveBeenCalled();
  });

  it('discards a previous preview when the contract ID changes', async () => {
    const user = userEvent.setup();
    renderModal();

    await user.type(screen.getByTestId('contract-id-input'), CONTRACT_ID);
    await user.click(screen.getByTestId('lookup-button'));
    await screen.findByTestId('token-preview');

    await user.type(screen.getByTestId('contract-id-input'), 'X');

    expect(screen.queryByTestId('token-preview')).not.toBeInTheDocument();
    expect(screen.getByTestId('lookup-button')).toBeInTheDocument();
  });

  it('pre-fills the field from initialContractId', () => {
    renderModal({ initialContractId: CONTRACT_ID });
    expect(screen.getByTestId('contract-id-input')).toHaveValue(CONTRACT_ID);
  });
});

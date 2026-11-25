import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  PaymentTransactionsView,
  PaymentsView,
  isValidStellarTxHash,
  getStellarExpertTxUrl,
} from '@/components/payments/payments-view';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/services/paymentService', () => ({
  PaymentService: {
    fetchPayments: vi.fn().mockResolvedValue({
      items: [
        {
          id: 'pay-1',
          amount: '100.00',
          amountValue: 100,
          type: 'reward',
          status: 'CONFIRMED',
          createdAt: '2026-03-27T10:00:00.000Z',
          transactionHash: 'a'.repeat(64),
          toAddress: 'GABC1234567890',
        },
        {
          id: 'pay-2',
          amount: '50.00',
          amountValue: 50,
          type: 'penalty',
          status: 'PENDING',
          createdAt: '2026-03-27T11:00:00.000Z',
          transactionHash: 'b'.repeat(64),
          toAddress: 'GXYZ1234567890',
        },
        {
          id: 'pay-3',
          amount: '25.00',
          amountValue: 25,
          type: 'manual',
          status: 'FAILED',
          createdAt: '2026-03-27T12:00:00.000Z',
          toAddress: 'GXYZ9999999999',
        },
      ],
      total: 3,
      page: 1,
      page_size: 20,
    }),
  },
}));

vi.mock('@/hooks/useUrlSync', () => ({
  useUrlSync: (defaults: any) => {
    const [state, setState] = React.useState(defaults);
    const setUrlState = (patch: any) =>
      setState((prev: any) => ({ ...prev, ...patch }));
    return [state, setUrlState];
  },
}));

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

function renderWithClient(ui: React.ReactElement) {
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  );
}

describe('PaymentsView & PaymentTransactionsView (#477, #478)', () => {
  it('exports PaymentTransactionsView alias and stellar validation helpers', () => {
    expect(PaymentTransactionsView).toBeDefined();
    expect(PaymentsView).toBeDefined();
    expect(isValidStellarTxHash).toBeDefined();
    expect(getStellarExpertTxUrl).toBeDefined();
  });

  it('validates 64-character hexadecimal format for Stellar tx hashes (#477)', () => {
    const validHash = 'c'.repeat(64);
    expect(isValidStellarTxHash(validHash)).toBe(true);
    expect(isValidStellarTxHash('invalid_short')).toBe(false);
    expect(isValidStellarTxHash('g'.repeat(64))).toBe(false);
  });

  it('generates testnet Stellar Expert transaction url (#478)', () => {
    const hash = 'd'.repeat(64);
    const url = getStellarExpertTxUrl(hash);
    expect(url).toBe(`https://stellar.expert/explorer/testnet/tx/${hash}`);
  });

  it('displays inline error and disables search button when invalid hash is entered (#477)', async () => {
    renderWithClient(<PaymentTransactionsView />);

    const hashInput = screen.getByTestId('tx-hash-input');
    const searchBtn = screen.getByTestId('tx-hash-search-btn');

    // Initially valid/empty
    expect(screen.queryByTestId('tx-hash-error')).not.toBeInTheDocument();
    expect(searchBtn).not.toBeDisabled();

    // Type invalid hash
    fireEvent.change(hashInput, { target: { value: 'not-a-valid-hash' } });

    // Should display inline error and disable search button
    const errorMsg = screen.getByTestId('tx-hash-error');
    expect(errorMsg).toBeInTheDocument();
    expect(errorMsg).toHaveTextContent(/Invalid Stellar transaction hash/i);
    expect(searchBtn).toBeDisabled();

    // Type valid 64-hex hash
    const validHash = 'e'.repeat(64);
    fireEvent.change(hashInput, { target: { value: validHash } });
    expect(screen.queryByTestId('tx-hash-error')).not.toBeInTheDocument();
    expect(searchBtn).not.toBeDisabled();
  });

  it('renders View on Stellar Expert external link button and status badges on transaction cards (#478)', async () => {
    renderWithClient(<PaymentTransactionsView />);

    // Check transaction cards container
    const cardsContainer = screen.getByTestId('payment-transaction-cards');
    expect(cardsContainer).toBeInTheDocument();

    // Find links to Stellar Expert
    const links = screen.getAllByLabelText('View on Stellar Expert');
    expect(links.length).toBeGreaterThan(0);
    expect(links[0]).toHaveAttribute('href', expect.stringContaining('https://stellar.expert/explorer/testnet/tx/'));
  });
});

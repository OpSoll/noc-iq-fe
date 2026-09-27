import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';

import DisbursementHistoryTable from '@/components/payments/DisbursementHistoryTable';
import { DISBURSEMENT_COLUMNS, type DisbursementRow } from '@/lib/disbursements';
import type { Payment } from '@/types/payment';

const RECIPIENT_A = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';
const RECIPIENT_B = 'GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBH';
const TX_A = 'a'.repeat(64);
const TX_B = 'b'.repeat(64);

function makePayment(overrides: Partial<Payment> = {}): Payment {
  return {
    id: 'pay-1',
    outageId: null,
    type: 'penalty',
    amount: '125.50',
    amountValue: 125.5,
    assetCode: 'USDC',
    transactionHash: TX_A,
    fromAddress: null,
    toAddress: RECIPIENT_A,
    status: 'completed',
    createdAt: '2026-01-15T10:30:00.000Z',
    ...overrides,
  };
}

const PAYMENTS: Payment[] = [
  makePayment({ id: 'pay-1' }),
  makePayment({
    id: 'pay-2',
    toAddress: RECIPIENT_B,
    transactionHash: TX_B,
    assetCode: 'XLM',
    amount: '40.00',
    status: 'pending',
  }),
  makePayment({
    id: 'pay-3',
    toAddress: null,
    transactionHash: null,
    status: 'failed',
  }),
];

function renderTable(
  props: Partial<React.ComponentProps<typeof DisbursementHistoryTable>> = {}
) {
  const onSelectTransaction = vi.fn();
  render(
    <DisbursementHistoryTable
      payments={PAYMENTS}
      onSelectTransaction={onSelectTransaction}
      {...props}
    />
  );
  return { onSelectTransaction };
}

describe('DisbursementHistoryTable', () => {
  it('renders a header for every required column', () => {
    renderTable();

    for (const column of DISBURSEMENT_COLUMNS) {
      expect(
        screen.getByRole('columnheader', { name: column })
      ).toBeInTheDocument();
    }
  });

  it('renders one row per payment', () => {
    renderTable();
    expect(screen.getAllByTestId('disbursement-row')).toHaveLength(3);
  });

  it('shows the date, recipient, token, amount, hash, and status', () => {
    renderTable();

    const firstRow = screen.getAllByTestId('disbursement-row')[0];
    expect(within(firstRow).getByText(/15 Jan 2026/)).toBeInTheDocument();
    expect(within(firstRow).getByText('USDC')).toBeInTheDocument();
    expect(within(firstRow).getByText('125.50')).toBeInTheDocument();
    expect(
      within(firstRow).getByRole('button', { name: /aaaaaa/ })
    ).toBeInTheDocument();
    expect(within(firstRow).getByText('completed')).toBeInTheDocument();
  });

  it('truncates long recipients and hashes for readability', () => {
    renderTable();

    const firstRow = screen.getAllByTestId('disbursement-row')[0];
    expect(
      within(firstRow).getByTitle(RECIPIENT_A)
    ).toHaveTextContent('…');
    expect(within(firstRow).getByTitle(TX_A)).not.toHaveTextContent(TX_A);
  });

  it('shows a placeholder for a payment with no transaction hash', () => {
    renderTable();
    expect(screen.getByText('No hash')).toBeInTheDocument();
  });

  it('searches by recipient public key', async () => {
    const user = userEvent.setup();
    renderTable();

    await user.type(screen.getByTestId('disbursement-search'), RECIPIENT_B);

    const rows = screen.getAllByTestId('disbursement-row');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveTextContent('XLM');
  });

  it('searches by transaction hash', async () => {
    const user = userEvent.setup();
    renderTable();

    await user.type(screen.getByTestId('disbursement-search'), TX_B.slice(0, 20));

    const rows = screen.getAllByTestId('disbursement-row');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveTextContent('40.00');
  });

  it('reports an empty result set for a search with no matches', async () => {
    const user = userEvent.setup();
    renderTable();

    await user.type(screen.getByTestId('disbursement-search'), 'zzzzzzzzzz');

    expect(screen.queryAllByTestId('disbursement-row')).toHaveLength(0);
    expect(
      screen.getByText('No disbursements match your search.')
    ).toBeInTheDocument();
  });

  it('restores the full list when the search is cleared', async () => {
    const user = userEvent.setup();
    renderTable();

    const search = screen.getByTestId('disbursement-search');
    await user.type(search, 'zzzzzz');
    await user.clear(search);

    expect(screen.getAllByTestId('disbursement-row')).toHaveLength(3);
  });

  it('opens the transaction tracker when a hash is clicked', async () => {
    const user = userEvent.setup();
    const { onSelectTransaction } = renderTable();

    await user.click(screen.getAllByTestId('disbursement-tx-link')[0]);

    expect(onSelectTransaction).toHaveBeenCalledTimes(1);
    const row = onSelectTransaction.mock.calls[0][0] as DisbursementRow;
    expect(row.txHash).toBe(TX_A);
    expect(row.recipient).toBe(RECIPIENT_A);
  });

  it('shows a loading state', () => {
    renderTable({ isLoading: true });
    expect(screen.getByText('Loading disbursements…')).toBeInTheDocument();
    expect(screen.queryAllByTestId('disbursement-row')).toHaveLength(0);
  });

  it('shows an empty state with no payments at all', () => {
    render(
      <DisbursementHistoryTable payments={[]} />
    );
    expect(
      screen.getByText('No disbursements recorded yet.')
    ).toBeInTheDocument();
  });

  it('reports the filtered and total counts', async () => {
    const user = userEvent.setup();
    renderTable();

    expect(screen.getByText('3 of 3 payouts')).toBeInTheDocument();
    await user.type(screen.getByTestId('disbursement-search'), TX_B);
    expect(screen.getByText('1 of 3 payouts')).toBeInTheDocument();
  });

  it('colour-codes the status pill', () => {
    renderTable();

    const statuses = screen.getAllByTestId('disbursement-status');
    expect(statuses[0].className).toContain('emerald');
    expect(statuses[1].className).toContain('amber');
    expect(statuses[2].className).toContain('red');
  });
});

import { describe, it, expect } from 'vitest';

import {
  DISBURSEMENT_COLUMNS,
  filterDisbursements,
  formatDisbursementDate,
  getDisbursementTone,
  isStellarAccountId,
  isTxHash,
  toDisbursementRow,
  truncateAddress,
  truncateTxHash,
  type DisbursementRow,
} from '@/lib/disbursements';
import type { Payment } from '@/types/payment';

const RECIPIENT = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';
const TX_HASH = 'a'.repeat(64);

function makePayment(overrides: Partial<Payment> = {}): Payment {
  return {
    id: 'pay-1',
    outageId: null,
    type: 'penalty',
    amount: '125.50',
    amountValue: 125.5,
    assetCode: 'USDC',
    transactionHash: TX_HASH,
    fromAddress: null,
    toAddress: RECIPIENT,
    status: 'completed',
    createdAt: '2026-01-15T10:30:00.000Z',
    ...overrides,
  };
}

describe('DISBURSEMENT_COLUMNS', () => {
  it('lists the columns the issue specifies', () => {
    expect([...DISBURSEMENT_COLUMNS]).toEqual([
      'Date',
      'Recipient',
      'Token',
      'Amount',
      'Tx Hash',
      'Status',
    ]);
  });
});

describe('toDisbursementRow', () => {
  it('maps a payment onto a table row', () => {
    const row = toDisbursementRow(makePayment());

    expect(row).toMatchObject({
      id: 'pay-1',
      date: '2026-01-15T10:30:00.000Z',
      recipient: RECIPIENT,
      token: 'USDC',
      amount: '125.50',
      txHash: TX_HASH,
      status: 'completed',
    });
  });

  it('builds an explorer link from the transaction hash', () => {
    expect(toDisbursementRow(makePayment()).explorerUrl).toBe(
      `https://stellar.expert/explorer/testnet/tx/${TX_HASH}`
    );
  });

  it('prefers a backend-supplied explorer URL', () => {
    const row = toDisbursementRow(
      makePayment({ explorerUrl: 'https://example.com/tx/1' })
    );
    expect(row.explorerUrl).toBe('https://example.com/tx/1');
  });

  it('falls back to the recipient account link without a transaction hash', () => {
    const row = toDisbursementRow(makePayment({ transactionHash: null }));
    expect(row.txHash).toBeNull();
    expect(row.explorerUrl).toBe(
      `https://stellar.expert/explorer/testnet/account/${RECIPIENT}`
    );
  });

  it('yields no link for a malformed hash rather than a broken URL', () => {
    const row = toDisbursementRow(
      makePayment({ transactionHash: 'not-a-hash', toAddress: RECIPIENT })
    );
    expect(row.explorerUrl).toContain('/account/');
  });

  it('falls back to the client wallet when there is no payout address', () => {
    const row = toDisbursementRow(
      makePayment({ toAddress: null, clientWallet: RECIPIENT })
    );
    expect(row.recipient).toBe(RECIPIENT);
  });

  it('tolerates a payment with no address at all', () => {
    const row = toDisbursementRow(
      makePayment({
        toAddress: null,
        clientWallet: null,
        artistWallet: null,
        transactionHash: null,
      })
    );
    expect(row.recipient).toBe('');
    expect(row.explorerUrl).toBeNull();
  });
});

describe('filterDisbursements', () => {
  const rows: DisbursementRow[] = [
    toDisbursementRow(makePayment({ id: '1' })),
    toDisbursementRow(
      makePayment({
        id: '2',
        toAddress: 'GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBH',
        transactionHash: 'b'.repeat(64),
      })
    ),
    toDisbursementRow(
      makePayment({ id: '3', transactionHash: null, toAddress: null })
    ),
  ];

  it('returns everything for an empty search', () => {
    expect(filterDisbursements(rows, '')).toHaveLength(3);
    expect(filterDisbursements(rows, '   ')).toHaveLength(3);
  });

  it('filters by full recipient public key', () => {
    const result = filterDisbursements(
      rows,
      'GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBH'
    );
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('2');
  });

  it('filters by a transaction hash fragment', () => {
    const result = filterDisbursements(rows, 'bbbbbbbb');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('2');
  });

  it('is case-insensitive', () => {
    expect(
      filterDisbursements(rows, 'BBBBBBBB').map((r) => r.id)
    ).toEqual(['2']);
  });

  it('returns nothing when there is no match', () => {
    expect(filterDisbursements(rows, 'zzzzzz')).toHaveLength(0);
  });

  it('matches on recipient alone, including rows without a hash', () => {
    // Row 3 has no recipient and no hash, so it can never match on recipient.
    const result = filterDisbursements(rows, RECIPIENT);
    expect(result.map((r) => r.id)).toEqual(['1']);
  });
});

describe('getDisbursementTone', () => {
  it('maps completed payouts to success', () => {
    expect(getDisbursementTone('completed')).toBe('success');
    expect(getDisbursementTone('SUCCESS')).toBe('success');
  });

  it('maps in-flight payouts to pending', () => {
    expect(getDisbursementTone('pending')).toBe('pending');
    expect(getDisbursementTone('processing')).toBe('pending');
  });

  it('maps failures to failed', () => {
    expect(getDisbursementTone('failed')).toBe('failed');
    expect(getDisbursementTone('reversed')).toBe('failed');
  });

  it('falls back to neutral', () => {
    expect(getDisbursementTone('weird-state')).toBe('neutral');
    expect(getDisbursementTone('')).toBe('neutral');
  });
});

describe('truncation helpers', () => {
  it('shortens a long public key', () => {
    expect(truncateAddress(RECIPIENT)).toBe(
      `${RECIPIENT.slice(0, 6)}…${RECIPIENT.slice(-4)}`
    );
    expect(truncateAddress(RECIPIENT)).not.toBe(RECIPIENT);
  });

  it('shortens a long transaction hash', () => {
    expect(truncateTxHash(TX_HASH)).toBe(`${'a'.repeat(10)}…aaaaaa`);
  });

  it('leaves short values alone', () => {
    expect(truncateAddress('GABC')).toBe('GABC');
    expect(truncateTxHash('abc123')).toBe('abc123');
  });

  it('renders an em dash for missing values', () => {
    expect(truncateAddress(null)).toBe('—');
    expect(truncateAddress('')).toBe('—');
    expect(truncateTxHash(undefined)).toBe('—');
  });
});

describe('formatDisbursementDate', () => {
  it('formats an ISO timestamp in UTC', () => {
    expect(formatDisbursementDate('2026-01-15T10:30:00.000Z')).toMatch(
      /15 Jan 2026/
    );
    expect(formatDisbursementDate('2026-01-15T10:30:00.000Z')).toMatch(/10:30/);
  });

  it('handles missing and invalid dates', () => {
    expect(formatDisbursementDate(null)).toBe('—');
    expect(formatDisbursementDate('not a date')).toBe('—');
  });
});

describe('identifier validation', () => {
  it('recognises a Stellar public key', () => {
    expect(isStellarAccountId(RECIPIENT)).toBe(true);
    expect(isStellarAccountId('nope')).toBe(false);
  });

  it('recognises a transaction hash', () => {
    expect(isTxHash(TX_HASH)).toBe(true);
    expect(isTxHash('abc')).toBe(false);
  });
});

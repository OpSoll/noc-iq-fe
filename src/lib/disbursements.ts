import { explorerLink } from '@/lib/explorer';
import type { Payment } from '@/types/payment';

/**
 * Search and formatting helpers for the disbursement history table.
 *
 * Split out of the component so the filtering rules — which decide what an
 * operator sees when hunting for a specific payout — can be unit tested
 * without rendering a table.
 *
 * Closes #660 — payment disbursement transaction history table.
 */

/** A payout row as rendered by the table. */
export interface DisbursementRow {
  id: string;
  date: string;
  recipient: string;
  token: string;
  amount: string;
  txHash: string | null;
  status: string;
  explorerUrl: string | null;
}

const STELLAR_ACCOUNT_RE = /^G[A-Z2-7]{55}$/;
const HEX64_RE = /^[0-9a-fA-F]{64}$/;

/** Payment states the backend reports that mean "not yet final". */
const PENDING_STATUSES = new Set(['pending', 'processing', 'queued', 'submitted']);
const FAILED_STATUSES = new Set(['failed', 'error', 'reversed', 'rejected']);

export type DisbursementTone = 'success' | 'pending' | 'failed' | 'neutral';

export function getDisbursementTone(status: string): DisbursementTone {
  const normalized = (status ?? '').trim().toLowerCase();
  if (FAILED_STATUSES.has(normalized)) return 'failed';
  if (PENDING_STATUSES.has(normalized)) return 'pending';
  if (normalized === 'completed' || normalized === 'success' || normalized === 'confirmed') {
    return 'success';
  }
  return 'neutral';
}

/**
 * Maps a `Payment` into a table row.
 *
 * The recipient is the payout destination; when the backend records a client
 * or artist wallet instead, that is the address an operator would search by.
 */
export function toDisbursementRow(payment: Payment): DisbursementRow {
  const recipient =
    payment.toAddress ?? payment.clientWallet ?? payment.artistWallet ?? '';
  return {
    id: payment.id,
    date: payment.createdAt,
    recipient,
    token: payment.assetCode,
    amount: payment.amount,
    txHash: payment.transactionHash,
    status: payment.status,
    explorerUrl:
      payment.explorerUrl ??
      explorerLink('tx', payment.transactionHash) ??
      (recipient ? explorerLink('account', recipient) : null),
  };
}

/** `GAAA…WHF` — enough to recognise a key, short enough for a table cell. */
export function truncateAddress(address: string | null | undefined): string {
  if (!address) return '—';
  const trimmed = address.trim();
  if (!trimmed) return '—';
  if (trimmed.length <= 12) return trimmed;
  return `${trimmed.slice(0, 6)}…${trimmed.slice(-4)}`;
}

/** `0a1b2c3d…9e8f7a6b` */
export function truncateTxHash(hash: string | null | undefined): string {
  if (!hash) return '—';
  const trimmed = hash.trim();
  if (!trimmed) return '—';
  if (trimmed.length <= 14) return trimmed;
  return `${trimmed.slice(0, 10)}…${trimmed.slice(-6)}`;
}

/**
 * Filters payouts by recipient public key or transaction hash.
 *
 * Matching is substring-based and case-insensitive so a pasted hash fragment
 * works. Malformed input (a partial key) yields no rows rather than a
 * confusing partial match.
 */
export function filterDisbursements(
  rows: DisbursementRow[],
  search: string
): DisbursementRow[] {
  const term = (search ?? '').trim().toLowerCase();
  if (!term) return rows;

  return rows.filter(
    (row) =>
      row.recipient.toLowerCase().includes(term) ||
      (row.txHash ?? '').toLowerCase().includes(term)
  );
}

/** Locale-stable date formatting for the table's Date column. */
export function formatDisbursementDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  }).format(date);
}

export const DISBURSEMENT_COLUMNS = [
  'Date',
  'Recipient',
  'Token',
  'Amount',
  'Tx Hash',
  'Status',
] as const;

/** True when the value looks like a Stellar public key. */
export function isStellarAccountId(value: string): boolean {
  return STELLAR_ACCOUNT_RE.test(value.trim());
}

/** True when the value looks like a 32-byte transaction hash. */
export function isTxHash(value: string): boolean {
  return HEX64_RE.test(value.trim());
}

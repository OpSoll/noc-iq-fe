'use client';

import { useMemo, useState } from 'react';

import {
  DISBURSEMENT_COLUMNS,
  filterDisbursements,
  formatDisbursementDate,
  getDisbursementTone,
  toDisbursementRow,
  truncateAddress,
  truncateTxHash,
  type DisbursementRow,
  type DisbursementTone,
} from '@/lib/disbursements';
import type { Payment } from '@/types/payment';
import { cn } from '@/lib/utils';

/**
 * Lists on-chain penalty disbursements so an operator can confirm a payout
 * landed without leaving the console for a block explorer.
 *
 * Rows are filterable by recipient public key or transaction hash, and
 * selecting a hash hands the row to the caller's transaction tracker.
 *
 * Closes #660 — payment disbursement transaction history table.
 */

const TONE_CLASSES: Record<DisbursementTone, string> = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  pending: 'border-amber-200 bg-amber-50 text-amber-700',
  failed: 'border-red-200 bg-red-50 text-red-700',
  neutral: 'border-slate-200 bg-slate-50 text-slate-600',
};

export interface DisbursementHistoryTableProps {
  payments: Payment[];
  /** Opens the transaction tracker for the selected payout. */
  onSelectTransaction?: (row: DisbursementRow) => void;
  isLoading?: boolean;
  className?: string;
}

export default function DisbursementHistoryTable({
  payments,
  onSelectTransaction,
  isLoading = false,
  className,
}: DisbursementHistoryTableProps) {
  const [search, setSearch] = useState('');

  const rows = useMemo(() => payments.map(toDisbursementRow), [payments]);
  const visibleRows = useMemo(
    () => filterDisbursements(rows, search),
    [rows, search]
  );

  return (
    <div
      className={cn('rounded-xl border border-slate-200 bg-white', className)}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">
            Disbursement history
          </h2>
          <p className="text-xs text-slate-500">
            {visibleRows.length} of {rows.length} payout
            {rows.length === 1 ? '' : 's'}
          </p>
        </div>
        <div className="flex-1 sm:max-w-xs">
          <label htmlFor="disbursement-search" className="sr-only">
            Search disbursements by recipient or transaction hash
          </label>
          <input
            id="disbursement-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search recipient or tx hash…"
            data-testid="disbursement-search"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">
            On-chain payment disbursements with status and explorer links
          </caption>
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              {DISBURSEMENT_COLUMNS.map((column) => (
                <th key={column} scope="col" className="px-4 py-2 font-medium">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody data-testid="disbursement-rows">
            {isLoading && (
              <tr>
                <td
                  colSpan={DISBURSEMENT_COLUMNS.length}
                  className="px-4 py-6 text-center text-slate-400"
                >
                  Loading disbursements…
                </td>
              </tr>
            )}

            {!isLoading && visibleRows.length === 0 && (
              <tr>
                <td
                  colSpan={DISBURSEMENT_COLUMNS.length}
                  className="px-4 py-6 text-center text-slate-400"
                >
                  {search
                    ? 'No disbursements match your search.'
                    : 'No disbursements recorded yet.'}
                </td>
              </tr>
            )}

            {!isLoading &&
              visibleRows.map((row) => (
                <tr
                  key={row.id}
                  data-testid="disbursement-row"
                  className="border-t border-slate-100 hover:bg-slate-50"
                >
                  <td className="whitespace-nowrap px-4 py-2 text-slate-600">
                    {formatDisbursementDate(row.date)}
                  </td>
                  <td
                    className="px-4 py-2 font-mono text-xs text-slate-700"
                    title={row.recipient || undefined}
                  >
                    {truncateAddress(row.recipient)}
                  </td>
                  <td className="px-4 py-2 text-slate-700">{row.token}</td>
                  <td className="px-4 py-2 font-mono text-slate-900">
                    {row.amount}
                  </td>
                  <td className="px-4 py-2">
                    {row.txHash ? (
                      <button
                        type="button"
                        onClick={() => onSelectTransaction?.(row)}
                        data-testid="disbursement-tx-link"
                        title={row.txHash}
                        className="rounded font-mono text-xs text-indigo-600 underline underline-offset-2 hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                      >
                        {truncateTxHash(row.txHash)}
                      </button>
                    ) : (
                      <span className="text-xs text-slate-400">No hash</span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <span
                      data-testid="disbursement-status"
                      className={cn(
                        'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium',
                        TONE_CLASSES[getDisbursementTone(row.status)]
                      )}
                    >
                      {row.status}
                    </span>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

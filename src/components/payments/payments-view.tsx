'use client';

import { useMemo, useState } from 'react';

import { useUrlSync } from '@/hooks/useUrlSync';
import { PaymentService } from '@/services/paymentService';
import type { Payment } from '@/types/payment';
import { isValidStellarTxHash, getStellarExpertTxUrl } from '@/lib/stellar';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { getPaymentStatusTooltip } from '@/lib/paymentStatusTooltip';
import { useQuery } from '@tanstack/react-query';
import { PaymentDetailDrawer } from './payment-detail-drawer';

import {
  explorerLink,
  STELLAR_NETWORK_LABEL,
  type ExplorerEntityType,
} from '@/lib/explorer';
import { ExternalLink, Inbox, Search, X } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
  PaginationEllipsis,
} from '@/components/ui/pagination';
import { queryKeys } from '@/lib/queryKeys';
import { formatTotal, summarizePayments } from '@/lib/paymentTotals';
import PaymentAssetBadge from '@/components/payments/PaymentAssetBadge';
import { useWalletStore } from '@/store/walletStore';
import { InlineValidationMessage } from '@/components/ui/InlineValidationMessage';
import {
  matchesWalletAddress,
  validateWalletAddress,
} from '@/lib/paymentAddressSearch';
import { truncateAddress } from '@/lib/disbursements';
import {
  getPaymentLatencyMs,
  PAYMENT_SLOW_THRESHOLD_MS,
} from '@/lib/paymentLatency';
import BatchSettlementSummaryCard from './BatchSettlementSummaryCard';
import PaymentLatencyChart from '@/components/charts/PaymentLatencyChart';
import { DeadLetterPaymentsPanel } from './dead-letter-payments-panel';

type SortDirection = 'asc' | 'desc';

function SortableHeader({
  columnKey,
  label,
  activeKey,
  activeDir,
  onSort,
}: {
  columnKey: string;
  label: string;
  activeKey: string;
  activeDir: string;
  onSort: (key: string) => void;
}) {
  const isActive = activeKey === columnKey;
  return (
    <th
      className="cursor-pointer px-4 py-3 select-none"
      onClick={() => onSort(columnKey)}
      role="columnheader"
      aria-sort={
        isActive ? (activeDir === 'asc' ? 'ascending' : 'descending') : 'none'
      }
    >
      {label}
      {isActive && (
        <span className="ml-1 text-xs" aria-hidden>
          {activeDir === 'asc' ? '\u25B2' : '\u25BC'}
        </span>
      )}
    </th>
  );
}

const URL_DEFAULTS = {
  status: 'all',
  type: 'all',
  assetCode: 'all',
  walletAddress: '',
  txHash: '',
  dateFrom: '',
  dateTo: '',
  page: '1',
  perPage: '20',
  paymentId: '',
  sortKey: 'created_at',
  sortDir: 'desc',
  tab: 'payments',
};

function formatAmount(payment: Payment) {
  const sign = payment.type === 'penalty' ? '-' : '+';
  return `${sign}$${payment.amount}`;
}

function getStatusBadge(status: string) {
  switch (status.toUpperCase()) {
    case 'CONFIRMED':
      return 'bg-green-100 text-green-700';
    case 'RELEASED':
      return 'bg-blue-100 text-blue-700';
    case 'REFUNDED':
      return 'bg-yellow-100 text-yellow-700';
    case 'FAILED':
      return 'bg-red-100 text-red-700';
    default:
      return 'bg-gray-100 text-gray-700';
  }
}

function SafeExplorerLink({
  type,
  value,
  label,
}: {
  type: ExplorerEntityType;
  value: string | null | undefined;
  label?: string;
}) {
  const href =
    type === 'tx' && value
      ? getStellarExpertTxUrl(value)
      : explorerLink(type, value);
  if (!href || !value) return <span className="text-gray-400">—</span>;
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label="View on Stellar Expert"
      className="inline-flex items-center gap-1 font-mono text-xs text-blue-600 hover:underline"
      title={value}
      onClick={(e) => e.stopPropagation()}
    >
      {label ?? (type === 'tx' ? 'View on Stellar Expert' : `${value.slice(0, 8)}…`)}
      <ExternalLink className="h-3 w-3" />
    </a>
  );
}

export function PaymentsView() {
  const [urlState, setUrlState] = useUrlSync(URL_DEFAULTS);

  const statusFilter = urlState.status;
  const typeFilter = urlState.type;
  const assetFilter = urlState.assetCode;
  const walletAddress = urlState.walletAddress;
  const txHashFilter = urlState.txHash || '';
  const [txHashInput, setTxHashInput] = useState(txHashFilter);
  const [txHashError, setTxHashError] = useState<string | null>(null);

  const handleTxHashChange = (val: string) => {
    setTxHashInput(val);
    const trimmed = val.trim();
    if (!trimmed) {
      setTxHashError(null);
    } else if (!isValidStellarTxHash(trimmed)) {
      setTxHashError('Invalid Stellar transaction hash. Must be 64 hexadecimal characters.');
    } else {
      setTxHashError(null);
    }
  };

  const isTxHashInvalid =
    txHashInput.trim().length > 0 && !isValidStellarTxHash(txHashInput.trim());

  const handleTxHashSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = txHashInput.trim();
    if (!trimmed) {
      setUrlState({ txHash: '', page: '1' });
      setTxHashError(null);
      return;
    }
    if (!isValidStellarTxHash(trimmed)) {
      setTxHashError('Invalid Stellar transaction hash. Must be 64 hexadecimal characters.');
      return;
    }
    setTxHashError(null);
    setUrlState({ txHash: trimmed, page: '1' });
  };

  const handleClearTxHash = () => {
    setTxHashInput('');
    setTxHashError(null);
    setUrlState({ txHash: '', page: '1' });
  };

  const walletError = validateWalletAddress(walletAddress);
  const activeWalletAddress = walletError ? '' : walletAddress;
  const dateFrom = urlState.dateFrom;
  const dateTo = urlState.dateTo;
  const page = parseInt(urlState.page, 10);
  const perPage = parseInt(urlState.perPage, 10);
  const sortKey = urlState.sortKey;
  const sortDir = urlState.sortDir as SortDirection;
  const selectedPaymentId = urlState.paymentId || null;
  const isDeadLetterTab = urlState.tab === 'dead-letter';
  const trackedTokens = useWalletStore((state) => state.trackedTokens);

  const dateError =
    dateFrom && dateTo && dateFrom > dateTo
      ? 'Start date cannot be after end date.'
      : null;

  const hasActiveFilters =
    statusFilter !== URL_DEFAULTS.status ||
    typeFilter !== URL_DEFAULTS.type ||
    assetFilter !== URL_DEFAULTS.assetCode ||
    walletAddress !== URL_DEFAULTS.walletAddress ||
    txHashFilter !== URL_DEFAULTS.txHash ||
    dateFrom !== URL_DEFAULTS.dateFrom ||
    dateTo !== URL_DEFAULTS.dateTo;

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.payments.list({
      statusFilter,
      typeFilter,
      assetFilter,
      walletAddress,
      dateFrom,
      dateTo,
      page,
      perPage,
      sortKey,
      sortDir,
    }),
    queryFn: () =>
      PaymentService.fetchPayments({
        status: statusFilter !== 'all' ? statusFilter : undefined,
        type: typeFilter !== 'all' ? typeFilter : undefined,
        asset_code: assetFilter !== 'all' ? assetFilter : undefined,
        to_address: activeWalletAddress || undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        page,
        page_size: perPage,
        sort_by: sortKey,
        sort_dir: sortDir,
      }),
    enabled: !dateError && !isDeadLetterTab,
  });

  const payments = useMemo(() => data?.items ?? [], [data]);
  const filteredPayments = useMemo(() => {
    let result = activeWalletAddress
      ? payments.filter((payment) =>
          matchesWalletAddress(payment, activeWalletAddress)
        )
      : payments;

    if (txHashFilter) {
      result = result.filter(
        (payment) =>
          payment.transactionHash?.toLowerCase() === txHashFilter.toLowerCase()
      );
    }

    return result;
  }, [payments, activeWalletAddress, txHashFilter]);
  const assetOptions = useMemo(() => {
    const codes = new Set<string>(['XLM', 'USDC']);
    for (const payment of payments) {
      if (payment.assetCode) codes.add(payment.assetCode);
    }
    for (const token of trackedTokens) {
      if (token.symbol) codes.add(token.symbol);
    }
    return Array.from(codes).sort();
  }, [payments, trackedTokens]);
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / perPage);

  // #1005: totals for the rows currently on screen, shown in a sticky footer.
  const totals = useMemo(
    () => summarizePayments(filteredPayments),
    [filteredPayments]
  );

  const handleFilterChange = (key: string, value: string) => {
    setUrlState({ [key]: value, page: '1' } as Partial<typeof URL_DEFAULTS>);
  };

  const handlePageChange = (newPage: number) => {
    setUrlState({ page: String(newPage) });
  };

  const handleRowClick = (paymentId: string) => {
    setUrlState({ paymentId });
  };

  const handleCloseDrawer = () => {
    setUrlState({ paymentId: '' });
  };

  const handleSort = (key: string) => {
    const newDir = sortKey === key && sortDir === 'asc' ? 'desc' : 'asc';
    // Reset to the first page — row 1 of the new ordering is what the user wants.
    setUrlState({ sortKey: key, sortDir: newDir, page: '1' });
  };

  if (error && !isDeadLetterTab) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-red-500">Payments unavailable. Please try again.</p>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">Payments</h1>
          <span
            className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-medium text-slate-600"
            title="Stellar network context for this view"
          >
            {STELLAR_NETWORK_LABEL}
          </span>
        </div>
        </div>
        <div
          role="tablist"
          aria-label="Payment views"
          className="flex gap-2 border-b border-slate-200"
        >
          <button
            type="button"
            role="tab"
            aria-selected={!isDeadLetterTab}
            onClick={() => setUrlState({ tab: 'payments' })}
            className={`border-b-2 px-3 py-2 text-sm font-medium ${
              isDeadLetterTab
                ? 'border-transparent text-slate-500'
                : 'border-blue-600 text-blue-700'
            }`}
          >
            Payments
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={isDeadLetterTab}
            onClick={() => setUrlState({ tab: 'dead-letter', page: '1' })}
            className={`border-b-2 px-3 py-2 text-sm font-medium ${
              isDeadLetterTab
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-slate-500'
            }`}
          >
            Dead Letter Payments
          </button>
        </div>
        {isDeadLetterTab ? (
          <DeadLetterPaymentsPanel
            onSelectPayment={(paymentId) => setUrlState({ paymentId })}
          />
        ) : (
          <>
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              className="rounded border px-3 py-1.5 text-sm"
              aria-label="Filter by status"
            >
              <option value="all">All Statuses</option>
              <option value="PENDING">Pending</option>
              <option value="CONFIRMED">Confirmed</option>
              <option value="RELEASED">Released</option>
              <option value="REFUNDED">Refunded</option>
              <option value="FAILED">Failed</option>
            </select>
            <select
              value={typeFilter}
              onChange={(e) => handleFilterChange('type', e.target.value)}
              className="rounded border px-3 py-1.5 text-sm"
              aria-label="Filter by type"
            >
              <option value="all">All Types</option>
              <option value="reward">Reward</option>
              <option value="penalty">Penalty</option>
              <option value="manual">Manual</option>
            </select>
            <select
              value={assetFilter}
                  onChange={(e) =>
                    handleFilterChange('assetCode', e.target.value)
                  }
              className="rounded border px-3 py-1.5 text-sm"
              aria-label="Filter by asset"
            >
              <option value="all">All Assets</option>
              {assetOptions.map((code) => (
                <option key={code} value={code}>
                  {code === 'XLM' || code === 'USDC'
                    ? code
                    : `Custom SAC: ${code}`}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={dateFrom}
                  onChange={(e) =>
                    handleFilterChange('dateFrom', e.target.value)
                  }
              className={`rounded border px-3 py-1.5 text-sm ${dateError ? 'border-red-500' : ''}`}
              aria-label="Date from"
              aria-invalid={!!dateError}
            />
            <input
              type="date"
              value={dateTo}
              onChange={(e) => handleFilterChange('dateTo', e.target.value)}
              className={`rounded border px-3 py-1.5 text-sm ${dateError ? 'border-red-500' : ''}`}
              aria-label="Date to"
              aria-invalid={!!dateError}
            />
            <form
              onSubmit={handleTxHashSubmit}
              className="flex items-center gap-1.5"
              data-testid="tx-hash-form"
            >
              <div className="relative">
                <input
                  type="text"
                  value={txHashInput}
                  onChange={(e) => handleTxHashChange(e.target.value)}
                  placeholder="Filter by Tx Hash..."
                  className={`rounded border px-3 py-1.5 text-sm font-mono ${
                    txHashError ? 'border-red-500' : ''
                  }`}
                  aria-label="Filter by Stellar transaction hash"
                  aria-invalid={!!txHashError}
                  data-testid="tx-hash-input"
                />
                {txHashInput && (
                  <button
                    type="button"
                    onClick={handleClearTxHash}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    aria-label="Clear transaction hash filter"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <button
                type="submit"
                disabled={isTxHashInvalid}
                className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                data-testid="tx-hash-search-btn"
              >
                Search
              </button>
            </form>
            {hasActiveFilters && (
              <button
                onClick={() => {
                  setUrlState(URL_DEFAULTS);
                  setTxHashInput('');
                  setTxHashError(null);
                }}
                className="rounded border px-3 py-1.5 text-sm hover:bg-gray-50"
                aria-label="Clear all filters"
              >
                Clear Filters
              </button>
            )}
          </div>
          {dateError && (
            <p className="text-sm text-red-600" role="alert">
              {dateError}
            </p>
          )}
          {txHashError && (
            <p
              className="text-sm text-red-600"
              role="alert"
              data-testid="tx-hash-error"
            >
              {txHashError}
            </p>
          )}
        </div>

      <BatchSettlementSummaryCard payments={filteredPayments} />
      <PaymentLatencyChart payments={filteredPayments} />

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <SortableHeader
                columnKey="created_at"
                label="Date"
                activeKey={sortKey}
                activeDir={sortDir}
                onSort={handleSort}
              />
              <SortableHeader
                columnKey="amount"
                label="Amount"
                activeKey={sortKey}
                activeDir={sortDir}
                onSort={handleSort}
              />
              <SortableHeader
                columnKey="status"
                label="Status"
                activeKey={sortKey}
                activeDir={sortDir}
                onSort={handleSort}
              />
              <th className="px-4 py-3">
                      <label
                        htmlFor="wallet-address-search"
                        className="sr-only"
                      >
                  Search wallet address
                </label>
                <input
                  id="wallet-address-search"
                  type="search"
                  value={walletAddress}
                  onChange={(e) =>
                    handleFilterChange('walletAddress', e.target.value)
                  }
                  placeholder="Recipient G..."
                  className="w-full rounded border px-2 py-1 text-xs font-normal normal-case text-gray-700"
                  aria-label="Search wallet address"
                  aria-invalid={!!walletError}
                  aria-describedby={
                          walletError
                            ? 'wallet-address-search-error'
                            : undefined
                  }
                />
                <InlineValidationMessage
                  id="wallet-address-search-error"
                  message={walletError}
                  testId="wallet-address-search-error"
                />
              </th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Tx</th>
              <th className="px-4 py-3">Commission</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b">
                  <td colSpan={7} className="px-4 py-3">
                    <div className="h-4 animate-pulse rounded bg-gray-200" />
                  </td>
                </tr>
              ))
            ) : filteredPayments.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8">
                  <EmptyState
                    icon={Inbox}
                    title="No payments found"
                    description={
                      hasActiveFilters
                        ? 'Try adjusting your filters or clearing them to see all payments.'
                        : 'As soon as payments are processed, they will appear here.'
                    }
                    action={
                      hasActiveFilters
                        ? {
                            label: 'Clear Filters',
                            onClick: () => setUrlState(URL_DEFAULTS),
                          }
                        : undefined
                    }
                  />
                </td>
              </tr>
            ) : (
              filteredPayments.map((payment: Payment) => {
                const latencyMs = getPaymentLatencyMs(payment);
                const isSlow =
                        latencyMs !== null &&
                        latencyMs > PAYMENT_SLOW_THRESHOLD_MS;
                return (
                <tr
                  key={payment.id}
                  className="cursor-pointer border-b hover:bg-gray-50"
                  onClick={() => handleRowClick(payment.id)}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleRowClick(payment.id);
                    }
                  }}
                  role="button"
                  aria-label={`View payment ${payment.id}`}
                >
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                              <span>
                                {new Date(
                                  payment.createdAt
                                ).toLocaleDateString()}
                              </span>
                      {isSlow && (
                        <span
                          className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700"
                          title={`Confirmed in ${latencyMs}ms`}
                          data-testid="payment-latency-flag"
                        >
                          SLOW
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-medium">
                    <div className="flex items-center gap-2">
                      <span>{formatAmount(payment)}</span>
                              <PaymentAssetBadge
                                assetCode={payment.assetCode}
                              />
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span
                          tabIndex={0}
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 ${getStatusBadge(payment.status)}`}
                          aria-label={`${payment.status}: ${getPaymentStatusTooltip(payment.status)}`}
                        >
                          {payment.status}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        {getPaymentStatusTooltip(payment.status)}
                      </TooltipContent>
                    </Tooltip>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="font-mono text-xs text-gray-600"
                      title={payment.toAddress ?? undefined}
                    >
                      {truncateAddress(payment.toAddress)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {payment.type ?? 'N/A'}
                  </td>

                  <td className="px-4 py-3">
                    <SafeExplorerLink
                      type="tx"
                      value={payment.transactionHash}
                    />
                  </td>

                  <td className="px-4 py-3 text-gray-600">
                    {payment.commissionId
                      ? `${payment.commissionId.slice(0, 8)}...`
                      : 'N/A'}
                  </td>
                </tr>
                );
              })
            )}
          </tbody>
          {/* #1005: sticky totals for the rows on screen. */}
          {!isLoading && filteredPayments.length > 0 && (
            <tfoot className="sticky bottom-0 z-10 border-t-2 border-gray-200 bg-white text-sm font-semibold text-gray-700">
              <tr data-testid="payments-totals-row">
                <td className="px-4 py-3">
                  {totals.count} row{totals.count === 1 ? '' : 's'}
                </td>
                <td className="px-4 py-3">
                  <span className="text-green-700">
                    +{formatTotal(totals.rewards, totals.assetCode)}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500">Total</td>
                      <td
                        className="px-4 py-3 text-gray-500"
                        aria-label="Recipient totals not applicable"
                      />
                <td className="px-4 py-3 text-gray-500">Rewards</td>
                <td className="px-4 py-3">
                  <span className="text-red-700">
                    -{formatTotal(totals.penalties, totals.assetCode)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span
                    data-testid="payments-net-total"
                    className={
                      totals.net >= 0 ? 'text-gray-700' : 'text-red-700'
                    }
                  >
                    Net {formatTotal(totals.net, totals.assetCode)}
                  </span>
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Mobile/Card view for payment transactions (#478) */}
      <div data-testid="payment-transaction-cards" className="grid gap-3 sm:hidden">
        {filteredPayments.map((payment) => (
          <div
            key={payment.id}
            data-testid={`payment-card-${payment.id}`}
            onClick={() => handleRowClick(payment.id)}
            className="cursor-pointer rounded-lg border bg-white p-4 shadow-sm hover:border-blue-400"
          >
            <div className="flex items-center justify-between pb-2">
              <span className="font-semibold text-gray-900">{formatAmount(payment)}</span>
              <span
                data-testid="payment-status-badge"
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getStatusBadge(payment.status)}`}
              >
                {payment.status}
              </span>
            </div>
            <div className="space-y-1 text-xs text-gray-600">
              <p>Type: <span className="font-medium text-gray-800">{payment.type}</span></p>
              <p>Date: {new Date(payment.createdAt).toLocaleDateString()}</p>
              {payment.transactionHash && (
                <div className="pt-2">
                  <a
                    href={getStellarExpertTxUrl(payment.transactionHash)}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="View on Stellar Expert"
                    data-testid="stellar-expert-link"
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-1 rounded border border-blue-600 px-2.5 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50"
                  >
                    View on Stellar Expert
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center">
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  onClick={() => page > 1 && handlePageChange(page - 1)}
                  aria-disabled={page <= 1}
                  className={
                    page <= 1
                      ? 'pointer-events-none opacity-50'
                      : 'cursor-pointer'
                  }
                />
              </PaginationItem>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                const pageNum = i + 1;
                return (
                  <PaginationItem key={pageNum}>
                    <PaginationLink
                      onClick={() => handlePageChange(pageNum)}
                      isActive={page === pageNum}
                      className="cursor-pointer"
                    >
                      {pageNum}
                    </PaginationLink>
                  </PaginationItem>
                );
              })}
              {totalPages > 5 && (
                <PaginationItem>
                  <PaginationEllipsis />
                </PaginationItem>
              )}
              <PaginationItem>
                <PaginationNext
                  onClick={() =>
                    page < totalPages && handlePageChange(page + 1)
                  }
                  aria-disabled={page >= totalPages}
                  className={
                    page >= totalPages
                      ? 'pointer-events-none opacity-50'
                      : 'cursor-pointer'
                  }
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
          </>
        )}

      {selectedPaymentId && (
        <PaymentDetailDrawer
          paymentId={selectedPaymentId}
          onClose={handleCloseDrawer}
        />
      )}
      </div>
    </TooltipProvider>
  );
}

export { PaymentsView as PaymentTransactionsView };
export { isValidStellarTxHash, getStellarExpertTxUrl } from '@/lib/stellar';
export default PaymentsView;

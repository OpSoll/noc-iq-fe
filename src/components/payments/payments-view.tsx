'use client';

import { useUrlSync } from '@/hooks/useUrlSync';
import { PaymentService } from '@/services/paymentService';
import type { Payment } from '@/types/payment';
import { useQuery } from '@tanstack/react-query';
import { PaymentDetailDrawer } from './payment-detail-drawer';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
  PaginationEllipsis,
} from '@/components/ui/pagination';

const URL_DEFAULTS = {
  status: 'all',
  type: 'all',
  dateFrom: '',
  dateTo: '',
  page: '1',
  perPage: '20',
  paymentId: '',
  sortKey: 'created_at',
  sortDir: 'desc',
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

export function PaymentsView() {
  const [urlState, setUrlState] = useUrlSync(URL_DEFAULTS);

  const statusFilter = urlState.status;
  const typeFilter = urlState.type;
  const dateFrom = urlState.dateFrom;
  const dateTo = urlState.dateTo;
  const page = parseInt(urlState.page, 10);
  const perPage = parseInt(urlState.perPage, 10);
  const sortKey = urlState.sortKey;
  const sortDir = urlState.sortDir as 'asc' | 'desc';
  const selectedPaymentId = urlState.paymentId || null;

  const { data, isLoading, error } = useQuery({
    queryKey: ['payments', { statusFilter, typeFilter, dateFrom, dateTo, page, perPage, sortKey, sortDir }],
    queryFn: () =>
      PaymentService.fetchPayments({
        status: statusFilter !== 'all' ? statusFilter : undefined,
        type: typeFilter !== 'all' ? typeFilter : undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        page,
        page_size: perPage,
        sort_by: sortKey,
        sort_dir: sortDir,
      }),
  });

  const payments = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / perPage);

  const handleFilterChange = (key: string, value: string) => {
    setUrlState({ [key]: value, page: '1' } as any);
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
    setUrlState({ sortKey: key, sortDir: newDir });
  };

  if (error) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-red-500">Payments unavailable. Please try again.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold">Payments</h1>
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
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
            className="rounded border px-3 py-1.5 text-sm"
            aria-label="Date from"
          />
          <input
            type="date"
            value={dateTo}
            onChange={(e) => handleFilterChange('dateTo', e.target.value)}
            className="rounded border px-3 py-1.5 text-sm"
            aria-label="Date to"
          />
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-3">
                <button onClick={() => handleSort('created_at')} className="hover:underline" aria-sort={sortKey === 'created_at' ? sortDir === 'asc' ? 'ascending' : 'descending' : 'none'}>
                  Date {sortKey === 'created_at' && (sortDir === 'asc' ? '↑' : '↓')}
                </button>
              </th>
              <th className="px-4 py-3">Amount</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Commission</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b">
                  <td colSpan={5} className="px-4 py-3">
                    <div className="h-4 animate-pulse rounded bg-gray-200" />
                  </td>
                </tr>
              ))
            ) : payments.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                  No payments found.
                </td>
              </tr>
            ) : (
              payments.map((payment: Payment) => (
                <tr
                  key={payment.id}
                  className="cursor-pointer border-b hover:bg-gray-50"
                  onClick={() => handleRowClick(payment.id)}
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleRowClick(payment.id); } }}
                  role="button"
                  aria-label={`View payment ${payment.id}`}
                >
                  <td className="px-4 py-3">{new Date(payment.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3 font-medium">{formatAmount(payment)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${getStatusBadge(payment.status)}`}>
                      {payment.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{payment.type ?? 'N/A'}</td>
                  <td className="px-4 py-3 text-gray-600">{payment.commissionId ? `${payment.commissionId.slice(0, 8)}...` : 'N/A'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center">
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  onClick={() => page > 1 && handlePageChange(page - 1)}
                  aria-disabled={page <= 1}
                  className={page <= 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
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
                  onClick={() => page < totalPages && handlePageChange(page + 1)}
                  aria-disabled={page >= totalPages}
                  className={page >= totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}

      {selectedPaymentId && (
        <PaymentDetailDrawer paymentId={selectedPaymentId} onClose={handleCloseDrawer} />
      )}
    </div>
  );
}

export default PaymentsView;

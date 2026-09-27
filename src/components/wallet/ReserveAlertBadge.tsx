'use client';

import {
  calculateAvailableBalance,
  formatXlm,
  isLowAvailableBalance,
  LOW_BALANCE_WARNING_XLM,
  STROOPS_PER_XLM,
} from '@/lib/stellarReserve';
import { cn } from '@/lib/utils';

/**
 * Surfaces an account's Stellar minimum-reserve requirement and how much of
 * its native balance is actually spendable.
 *
 * Operators lose time to "insufficient balance" errors whose real cause is a
 * reserve that grew with every trustline and data entry. Showing
 * `total - reserve` up front makes the constraint visible.
 *
 * Closes #662 — minimum XLM reserve balance alert badge.
 */

export interface ReserveAlertBadgeProps {
  /** Total native balance in stroops (as returned by Horizon). */
  totalBalanceStroops: number;
  /** Number of subentries on the account, excluding the base entry. */
  subentryCount: number;
  /** Override for networks with a non-default `baseReserve`. */
  baseReserveStroops?: number;
  /** Available-balance threshold that triggers the warning state. */
  warningThresholdXlm?: number;
  className?: string;
}

export default function ReserveAlertBadge({
  totalBalanceStroops,
  subentryCount,
  baseReserveStroops,
  warningThresholdXlm = LOW_BALANCE_WARNING_XLM,
  className,
}: ReserveAlertBadgeProps) {
  const totalBalanceXlm = (Number.isFinite(totalBalanceStroops)
    ? totalBalanceStroops
    : 0) / STROOPS_PER_XLM;

  const {
    subentryCount: safeSubentryCount,
    baseReserveXlm,
    minimumReserveXlm,
    minimumReserveStroops,
    availableBalanceXlm,
  } = calculateAvailableBalance(
    totalBalanceXlm,
    subentryCount,
    baseReserveStroops
  );

  const isLow = isLowAvailableBalance(availableBalanceXlm, warningThresholdXlm);

  return (
    <div
      data-testid="reserve-alert-badge"
      data-low={isLow ? 'true' : 'false'}
      role={isLow ? 'alert' : 'group'}
      aria-label={`Minimum reserve ${minimumReserveXlm} XLM, available ${availableBalanceXlm} XLM`}
      className={cn(
        'rounded-lg border p-3 text-sm',
        isLow
          ? 'border-amber-300 bg-amber-50 text-amber-900'
          : 'border-slate-200 bg-white text-slate-800',
        className
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide">
          Minimum reserve
        </h3>
        <span
          data-testid="reserve-amount"
          className="rounded-full bg-black/5 px-2 py-0.5 font-mono text-xs"
        >
          {formatXlm(minimumReserveStroops)} XLM
        </span>
      </div>

      <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        <dt className="text-slate-500">Subentries</dt>
        <dd
          data-testid="reserve-subentries"
          className="text-right font-mono font-medium"
        >
          {safeSubentryCount}
        </dd>

        <dt className="text-slate-500">Base reserve</dt>
        <dd className="text-right font-mono font-medium">
          {baseReserveXlm} XLM
        </dd>

        <dt className="text-slate-500">Total balance</dt>
        <dd className="text-right font-mono font-medium">
          {formatXlm(totalBalanceStroops)} XLM
        </dd>

        <dt className="font-medium text-slate-600">Available</dt>
        <dd
          data-testid="reserve-available"
          className="text-right font-mono font-semibold"
        >
          {availableBalanceXlm.toFixed(4).replace(/\.?0+$/, '')} XLM
        </dd>
      </dl>

      {isLow && (
        <p data-testid="reserve-warning" className="mt-2 text-xs">
          Available balance is below {warningThresholdXlm} XLM. Transactions
          will fail with <code className="font-mono">tx_insufficient_balance</code>{' '}
          until this account is funded or its subentries are removed.
        </p>
      )}
    </div>
  );
}

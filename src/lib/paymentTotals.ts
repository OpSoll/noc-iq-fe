/**
 * Payments table totals (#1005).
 *
 * The payments table paginates, so a user comparing a page of payments has no
 * way to see the combined value of what is on screen. This computes the totals
 * for the rows currently rendered, which the table shows in a sticky footer.
 *
 * Pure and side-effect free so the arithmetic can be unit tested without
 * rendering the table.
 */

import type { Payment } from '@/types/payment';

export interface PaymentTotals {
  /** Sum of rewards (a positive contribution). */
  rewards: number;
  /** Sum of penalties, as a positive magnitude. */
  penalties: number;
  /** Rewards minus penalties. */
  net: number;
  /** Number of rows included. */
  count: number;
  /** Currency/asset code of the included rows, or null when mixed/unknown. */
  assetCode: string | null;
}

/** A finite numeric amount, falling back to 0 for missing/invalid values. */
function safeAmount(payment: Payment): number {
  const value = payment.amountValue;
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

/**
 * Totals for a set of payments. Penalties are reported as a positive magnitude
 * (`penalties`), while `net` applies their negative sign, so the footer can show
 * "$120 in penalties" and a net that is the sum of the two.
 */
export function summarizePayments(payments: Payment[]): PaymentTotals {
  let rewards = 0;
  let penalties = 0;
  let assetCode: string | null = null;
  let mixedAssets = false;

  for (const payment of payments) {
    const amount = safeAmount(payment);
    if (payment.type === 'penalty') {
      penalties += Math.abs(amount);
    } else {
      rewards += Math.abs(amount);
    }

    if (payment.assetCode) {
      if (assetCode === null) {
        assetCode = payment.assetCode;
      } else if (assetCode !== payment.assetCode) {
        mixedAssets = true;
      }
    }
  }

  return {
    rewards,
    penalties,
    net: rewards - penalties,
    count: payments.length,
    assetCode: mixedAssets ? null : assetCode,
  };
}

/** `$1,234.50` (2 dp) or `$1,235` when the value is a whole number. */
export function formatTotal(value: number, assetCode?: string | null): string {
  const symbol = assetCode ? `${assetCode} ` : '$';
  const rounded = Math.round(value * 100) / 100;
  const hasCents = Math.abs(rounded % 1) > 0;
  const body = rounded.toLocaleString('en-US', {
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: 2,
  });
  return `${symbol}${body}`;
}

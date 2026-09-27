/**
 * Stellar minimum-reserve arithmetic.
 *
 * Every account must hold a balance of at least
 * `(2 + subentryCount) * baseReserve` — the base entry plus one subentry
 * per trustline, data entry, offer, or sponsorship — otherwise the network
 * rejects the transaction that would grow the account.
 *
 * This is the rule operators hit as "my XLM balance is fine, my transaction
 * still fails with tx_insufficient_balance": the fee is paid on top of a
 * reserve that silently grew with each trustline.
 *
 * Closes #662 — minimum XLM reserve balance alert badge.
 */

/** One XLM in stroops. */
export const STROOPS_PER_XLM = 10_000_000;

/** `baseReserve` from `network.toml`: 0.5 XLM. */
export const BASE_RESERVE_STROOPS = 5_000_000;

/** The account's own base entry counts as one subentry's worth of reserve. */
export const BASE_ENTRY_COUNT = 2;

export interface ReserveBreakdown {
  /** Number of subentries the account currently holds. */
  subentryCount: number;
  /** `baseReserve` expressed in XLM. */
  baseReserveXlm: number;
  /** Total reserve locked up by the account, in XLM. */
  minimumReserveXlm: number;
  /** Total reserve locked up by the account, in stroops. */
  minimumReserveStroops: number;
}

/**
 * Computes the minimum balance an account must maintain.
 *
 * @param subentryCount total subentries on the account, excluding the base entry
 * @param baseReserveStroops override for networks with a different `baseReserve`
 */
export function calculateMinimumReserve(
  subentryCount: number,
  baseReserveStroops: number = BASE_RESERVE_STROOPS
): ReserveBreakdown {
  const safeSubentries = Math.max(0, Math.floor(subentryCount));
  const safeBase = Math.max(0, Math.floor(baseReserveStroops));
  const minimumReserveStroops =
    (BASE_ENTRY_COUNT + safeSubentries) * safeBase;

  return {
    subentryCount: safeSubentries,
    baseReserveXlm: safeBase / STROOPS_PER_XLM,
    minimumReserveXlm: minimumReserveStroops / STROOPS_PER_XLM,
    minimumReserveStroops,
  };
}

export interface AvailableBalance extends ReserveBreakdown {
  /** Total native XLM balance held by the account, in XLM. */
  totalBalanceXlm: number;
  /** Spendable balance once the reserve is satisfied: `total - reserve`. */
  availableBalanceXlm: number;
  /** True when the account can no longer pay a basic transaction fee. */
  isBelowMinimum: boolean;
}

/**
 * Available balance is `total - minimumReserve`, which is what the account can
 * actually spend. It is clamped at zero: an account can dip *below* its
 * reserve through fee payment, and reporting a negative spendable balance is
 * more confusing than reporting zero.
 */
export function calculateAvailableBalance(
  totalBalanceXlm: number,
  subentryCount: number,
  baseReserveStroops: number = BASE_RESERVE_STROOPS
): AvailableBalance {
  const reserve = calculateMinimumReserve(subentryCount, baseReserveStroops);
  const safeTotal = Number.isFinite(totalBalanceXlm)
    ? totalBalanceXlm
    : 0;
  const available = safeTotal - reserve.minimumReserveXlm;

  return {
    ...reserve,
    totalBalanceXlm: safeTotal,
    availableBalanceXlm: Math.max(0, available),
    isBelowMinimum: available <= 0,
  };
}

/** Below this much spendable XLM the account cannot reliably submit a transaction. */
export const LOW_BALANCE_WARNING_XLM = 2;

/**
 * Whether the account is running low.
 *
 * The threshold is deliberately on *available* (post-reserve) balance: a
 * 500 XLM account with 1,000 subentries holds a 500 XLM reserve and is far
 * more at risk than a 3 XLM account with no trustlines.
 */
export function isLowAvailableBalance(
  availableBalanceXlm: number,
  thresholdXlm: number = LOW_BALANCE_WARNING_XLM
): boolean {
  return availableBalanceXlm < thresholdXlm;
}

/** Formats a stroop amount as XLM, trimming trailing zeros. */
export function formatXlm(
  stroops: number,
  maxDecimals: number = 7
): string {
  if (!Number.isFinite(stroops)) return '0';
  const sign = stroops < 0 ? '-' : '';
  const abs = Math.abs(Math.trunc(stroops));
  const whole = Math.floor(abs / STROOPS_PER_XLM);
  const fraction = String(abs % STROOPS_PER_XLM).padStart(7, '0');
  const trimmed = fraction.slice(0, maxDecimals).replace(/0+$/, '');
  return trimmed ? `${sign}${whole}.${trimmed}` : `${sign}${whole}`;
}

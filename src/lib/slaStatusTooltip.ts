import type { SLAResult } from '@/types/sla';

/**
 * SLA status tooltip copy (#985).
 *
 * The SLA badges on the outage detail page render `met` / `violated` with no
 * explanation, so an operator looking at a "violated" badge cannot tell *why*
 * the SLA broke down. This module turns an {@link SLAResult} (plus an optional
 * backend reason code) into a concise, human-readable explanation.
 *
 * The copy always states the computed outcome with the actual numbers
 * (`MTTR 42m vs 30m threshold`), so the tooltip stays useful even when the
 * backend does not supply a reason code — that is the fallback path the issue
 * calls out.
 */

/** Canonical descriptions for known backend SLA reason codes. */
const REASON_CODE_EXPLANATIONS: Record<string, string> = {
  MTTR_EXCEEDED: 'Mean time to repair exceeded the SLA threshold.',
  MTTR_MET: 'Outage was resolved within the SLA window.',
  SEVERITY_ADJUSTMENT: 'The SLA threshold was adjusted for this severity.',
  BUSINESS_HOURS: 'The calculation was adjusted for business hours.',
  MANUAL_OVERRIDE: 'An administrator manually overrode the SLA result.',
  PENALTY_APPLIED: 'A penalty was applied for missing the SLA target.',
  REWARD_APPLIED: 'A reward was applied for beating the SLA target.',
};

/** Rendered when the result carries no reason code and no usable numbers. */
export const SLA_TOOLTIP_FALLBACK = 'SLA status computed for this outage.';

/** Short, human phrase for the overall outcome. */
function statusExplanation(result: SLAResult): string {
  return result.status === 'violated'
    ? 'SLA target was violated.'
    : 'SLA target was met.';
}

/** `42m` / `1h 5m` — minutes as a compact duration. */
function formatMinutes(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes < 0) return '';
  const whole = Math.round(minutes);
  if (whole < 60) return `${whole}m`;
  const hours = Math.floor(whole / 60);
  const rest = whole % 60;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}

/** `MTTR 42m vs 30m threshold`, or `''` when the numbers are unusable. */
function formatMttr(result: SLAResult): string {
  const mttr = formatMinutes(result.mttr_minutes);
  const threshold = formatMinutes(result.threshold_minutes);
  if (!mttr || !threshold) return '';
  return `MTTR ${mttr} vs ${threshold} threshold`;
}

/**
 * Builds the tooltip text for an SLA badge: the reason-code explanation when
 * available, otherwise the outcome plus MTTR/threshold figures, falling back to
 * a generic sentence when nothing else is usable.
 */
export function getSlaStatusTooltip(
  result: SLAResult | null | undefined,
  reasonCode?: string | null
): string {
  if (!result) return SLA_TOOLTIP_FALLBACK;

  const parts: string[] = [];

  const explanation = reasonCode
    ? REASON_CODE_EXPLANATIONS[reasonCode]
    : undefined;
  parts.push(explanation ?? statusExplanation(result));

  const mttr = formatMttr(result);
  if (mttr) parts.push(mttr);

  const text = parts.filter(Boolean).join(' ');
  return text || SLA_TOOLTIP_FALLBACK;
}

/** Tooltip for the badge showing `met` / `violated`. */
export function getSlaStatusBadgeTooltip(
  result: SLAResult | null | undefined,
  reasonCode?: string | null
): string {
  return getSlaStatusTooltip(result, reasonCode);
}

/** Tooltip for the payment-type / rating badge (e.g. `penalty · poor`). */
export function getSlaAmountTooltip(
  result: SLAResult | null | undefined
): string {
  if (!result) return SLA_TOOLTIP_FALLBACK;

  const { amount, payment_type: paymentType } = result;
  if (!Number.isFinite(amount)) return SLA_TOOLTIP_FALLBACK;

  const value = Math.abs(amount);
  const verb = amount >= 0 ? 'reward' : 'penalty';
  const type = paymentType ?? verb;
  return `Financial ${verb} of ${value} (${type}).`;
}

/** Tooltip for the rating badge. */
export function getSlaRatingTooltip(
  result: SLAResult | null | undefined
): string {
  if (!result) return SLA_TOOLTIP_FALLBACK;

  const descriptions: Record<SLAResult['rating'], string> = {
    exceptional: 'Resolved far faster than the SLA window required.',
    excellent: 'Resolved comfortably within the SLA window.',
    good: 'Resolved within the SLA window.',
    poor: 'Resolution took longer than the SLA window allows.',
  };
  return descriptions[result.rating] ?? SLA_TOOLTIP_FALLBACK;
}

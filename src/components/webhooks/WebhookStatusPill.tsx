'use client';

import {
  HEALTH_CLASSES,
  HEALTH_DESCRIPTIONS,
  HEALTH_DOT_CLASSES,
  HEALTH_LABELS,
  healthTooltip,
  type WebhookHealth,
} from '@/lib/webhookHealth';
import { cn } from '@/lib/utils';

/**
 * Colour-coded health indicator for a webhook endpoint.
 *
 * Renders the endpoint state — Healthy (green), Degraded (yellow), Disabled
 * (red) — with the underlying success rate available on hover/focus, and
 * offers a re-enable path for endpoints that were auto-disabled.
 *
 * Closes #667 — webhook endpoint health status pill indicator.
 */

export interface WebhookStatusPillProps {
  health: WebhookHealth;
  /** Opens the re-enable confirmation for a disabled endpoint. */
  onReenable?: () => void;
  className?: string;
}

export default function WebhookStatusPill({
  health,
  onReenable,
  className,
}: WebhookStatusPillProps) {
  const tooltip = healthTooltip(health);
  const canReenable = health.canReenable && Boolean(onReenable);

  return (
    <span className={cn('inline-flex items-center', className)}>
      <span
        data-testid="webhook-status-pill"
        data-status={health.status}
        title={tooltip}
        aria-label={`Endpoint health: ${HEALTH_LABELS[health.status]}. ${tooltip}`}
        className={cn(
          'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium',
          HEALTH_CLASSES[health.status]
        )}
      >
        <span
          aria-hidden="true"
          className={cn('mr-1.5 h-1.5 w-1.5 rounded-full', HEALTH_DOT_CLASSES[health.status])}
        />
        {HEALTH_LABELS[health.status]}
        <span className="sr-only"> — {HEALTH_DESCRIPTIONS[health.status]}</span>
      </span>

      {canReenable && (
        <button
          type="button"
          onClick={onReenable}
          data-testid="webhook-reenable-button"
          className="ml-2 rounded-md border border-red-300 px-2 py-0.5 text-xs font-medium text-red-700 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
        >
          Re-enable
        </button>
      )}
    </span>
  );
}

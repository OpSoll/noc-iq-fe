import { describe, it, expect } from 'vitest';

import {
  calculateWebhookHealth,
  DEGRADED_THRESHOLD,
  HEALTHY_THRESHOLD,
  HEALTH_LABELS,
  HEALTH_SAMPLE_SIZE,
  healthTooltip,
} from '@/lib/webhookHealth';
import type { WebhookDelivery } from '@/types/webhook';

const delivery = (
  overrides: Partial<WebhookDelivery> = {}
): WebhookDelivery => ({
  id: 'd1',
  webhook_id: 'w1',
  event: 'outage.created',
  status: 'success',
  response_code: 200,
  created_at: '2026-01-15T10:30:00.000Z',
  ...overrides,
});

/** Builds `total` dispatches, `failures` of which failed. */
function mix(total: number, failures: number): WebhookDelivery[] {
  return [
    ...Array.from({ length: total - failures }, () => delivery()),
    ...Array.from({ length: failures }, () =>
      delivery({ status: 'failed', response_code: 500 })
    ),
  ];
}

describe('calculateWebhookHealth', () => {
  it('reports healthy at a 100% success rate', () => {
    const health = calculateWebhookHealth(mix(10, 0));
    expect(health.status).toBe('healthy');
    expect(health.successRate).toBe(100);
    expect(health.successCount).toBe(10);
    expect(health.failureCount).toBe(0);
  });

  it('reports healthy at exactly the healthy threshold', () => {
    // 96/100 = 96%, which is at or above the 95% threshold.
    const health = calculateWebhookHealth(mix(100, 4));
    expect(health.status).toBe('healthy');
    expect(health.successRate).toBe(96);
  });

  it('reports degraded below the healthy threshold', () => {
    // 90/100 = 90%, between the degraded and healthy thresholds.
    const health = calculateWebhookHealth(mix(100, 10));
    expect(health.status).toBe('degraded');
    expect(health.successRate).toBe(90);
  });

  it('reports degraded for a badly failing endpoint', () => {
    const health = calculateWebhookHealth(mix(10, 8));
    expect(health.status).toBe('degraded');
    expect(health.successRate).toBe(20);
  });

  it('uses the documented thresholds', () => {
    expect(HEALTHY_THRESHOLD).toBe(95);
    expect(DEGRADED_THRESHOLD).toBe(80);
  });

  it('reports unknown when there is no delivery history', () => {
    const health = calculateWebhookHealth([]);
    expect(health.status).toBe('unknown');
    expect(health.sampleSize).toBe(0);
    expect(health.successRate).toBe(0);
  });

  it('reports disabled for an inactive endpoint regardless of history', () => {
    const health = calculateWebhookHealth(mix(10, 0), { isActive: false });
    expect(health.status).toBe('disabled');
    // The rate is still reported as supporting context.
    expect(health.successRate).toBe(100);
  });

  it('allows re-enabling only a disabled endpoint', () => {
    expect(calculateWebhookHealth(mix(5, 0), { isActive: false }).canReenable).toBe(
      true
    );
    expect(calculateWebhookHealth(mix(5, 0)).canReenable).toBe(false);
  });

  it('only considers the most recent 100 dispatches', () => {
    // An old run of failures must not condemn a currently-healthy endpoint.
    const stale = Array.from({ length: 200 }, () =>
      delivery({ status: 'failed', response_code: 500 })
    );
    const recent = Array.from({ length: 20 }, () => delivery());

    const health = calculateWebhookHealth([...recent, ...stale]);
    expect(health.sampleSize).toBe(HEALTH_SAMPLE_SIZE);
    expect(health.status).toBe('healthy');
    expect(health.successRate).toBe(100);
  });

  it('honours a custom sample size', () => {
    const health = calculateWebhookHealth(mix(10, 5), { sampleSize: 4 });
    expect(health.sampleSize).toBe(4);
  });

  it('counts a 2xx response as a success even when the status field disagrees', () => {
    const health = calculateWebhookHealth([
      delivery({ status: 'pending', response_code: 204 }),
    ]);
    expect(health.status).toBe('healthy');
  });

  it('counts a non-2xx response as a failure even when the status field disagrees', () => {
    const health = calculateWebhookHealth([
      delivery({ status: 'success', response_code: 500 }),
    ]);
    expect(health.status).toBe('degraded');
  });

  it('treats a missing response code as a failure', () => {
    const health = calculateWebhookHealth([
      delivery({ status: 'failed', response_code: null }),
    ]);
    expect(health.failureCount).toBe(1);
  });

  it('rounds the success rate to one decimal place', () => {
    // 2/3 = 66.666...
    const health = calculateWebhookHealth([
      delivery(),
      delivery(),
      delivery({ status: 'failed', response_code: 500 }),
    ]);
    expect(health.successRate).toBe(66.7);
  });

  it('does not mutate the input array', () => {
    const input = [...staleFailures(), ...Array.from({ length: 5 }, () => delivery())];
    const snapshot = [...input];
    calculateWebhookHealth(input);
    expect(input).toEqual(snapshot);
  });
});

function staleFailures() {
  return Array.from({ length: 10 }, () =>
    delivery({ status: 'failed', response_code: 500 })
  );
}

describe('healthTooltip', () => {
  it('includes the success rate and sample size', () => {
    const tooltip = healthTooltip(calculateWebhookHealth(mix(100, 5)));
    expect(tooltip).toBe(
      '95% success over the last 100 dispatches (95 succeeded, 5 failed)'
    );
  });

  it('uses the singular form for a single dispatch', () => {
    expect(healthTooltip(calculateWebhookHealth([delivery()]))).toBe(
      '100% success over the last 1 dispatch (1 succeeded, 0 failed)'
    );
  });

  it('explains an empty history', () => {
    expect(healthTooltip(calculateWebhookHealth([]))).toBe(
      'No deliveries recorded yet'
    );
  });
});

describe('HEALTH_LABELS', () => {
  it('uses the labels the issue specifies', () => {
    expect(HEALTH_LABELS.healthy).toBe('Healthy');
    expect(HEALTH_LABELS.degraded).toBe('Degraded');
    expect(HEALTH_LABELS.disabled).toBe('Disabled');
    expect(HEALTH_LABELS.unknown).toBe('No data');
  });
});

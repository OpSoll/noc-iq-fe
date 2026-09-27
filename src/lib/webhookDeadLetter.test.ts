import { describe, it, expect } from 'vitest';

import {
  formatAttemptTime,
  getBatchActionState,
  MAX_PURGE_SELECTION,
  toDeadLetterItems,
} from '@/lib/webhookDeadLetter';
import type { WebhookDelivery } from '@/types/webhook';

const delivery = (
  overrides: Partial<WebhookDelivery> = {}
): WebhookDelivery => ({
  id: 'd1',
  webhook_id: 'w1',
  event: 'outage.created',
  status: 'failed',
  response_code: 500,
  created_at: '2026-01-15T10:30:00.000Z',
  ...overrides,
});

describe('toDeadLetterItems', () => {
  it('keeps a dispatch that exhausted its retries', () => {
    const items = toDeadLetterItems([
      delivery({ id: 'a', attempts: 5, status: 'failed', response_code: 500 }),
    ]);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      id: 'a',
      event: 'outage.created',
      error: 'HTTP 500',
      attempts: 5,
      lastAttemptAt: '2026-01-15T10:30:00.000Z',
    });
  });

  it('drops a dispatch that has retries remaining', () => {
    const items = toDeadLetterItems([
      delivery({ id: 'a', attempts: 2, status: 'failed', response_code: 500 }),
    ]);
    expect(items).toHaveLength(0);
  });

  it('drops a dispatch that succeeded despite reaching the retry limit', () => {
    const items = toDeadLetterItems([
      delivery({ id: 'a', attempts: 5, status: 'success', response_code: 200 }),
    ]);
    expect(items).toHaveLength(0);
  });

  it('reports the response code as the error', () => {
    const items = toDeadLetterItems([
      delivery({ id: 'a', attempts: 6, response_code: 404 }),
    ]);
    expect(items[0].error).toBe('HTTP 404');
  });

  it('falls back to the status when there is no response code', () => {
    const items = toDeadLetterItems([
      delivery({ id: 'a', attempts: 6, response_code: null, status: 'failed' }),
    ]);
    expect(items[0].error).toBe('failed');
  });

  it('carries the endpoint URL and replayable payload', () => {
    const items = toDeadLetterItems(
      [delivery({ id: 'a', attempts: 6, request_body: { outage_id: 7 } })],
      { webhookUrl: 'https://example.com/hook' }
    );
    expect(items[0].webhookUrl).toBe('https://example.com/hook');
    expect(items[0].payload).toEqual({ outage_id: 7 });
  });

  it('honours a custom exhaustion threshold', () => {
    const input = [delivery({ id: 'a', attempts: 3 })];
    expect(toDeadLetterItems(input, { exhaustedAttempts: 5 })).toHaveLength(0);
    expect(toDeadLetterItems(input, { exhaustedAttempts: 3 })).toHaveLength(1);
  });

  it('treats a missing attempt count as a single attempt', () => {
    expect(
      toDeadLetterItems([delivery({ id: 'a' })], { exhaustedAttempts: 1 })
    ).toHaveLength(1);
  });

  it('accepts a stringified attempt count', () => {
    expect(
      toDeadLetterItems([delivery({ id: 'a', attempts: '6' } as never)])
    ).toHaveLength(1);
  });

  it('handles an empty input', () => {
    expect(toDeadLetterItems([])).toHaveLength(0);
  });
});

describe('getBatchActionState', () => {
  it('blocks both actions with nothing selected', () => {
    const state = getBatchActionState(0);
    expect(state.canReplay).toBe(false);
    expect(state.canPurge).toBe(false);
    expect(state.replayBlockedReason).toBe('Select at least one dispatch');
    expect(state.purgeBlockedReason).toBe('Select at least one dispatch');
  });

  it('enables both actions with a selection', () => {
    const state = getBatchActionState(3);
    expect(state.canReplay).toBe(true);
    expect(state.canPurge).toBe(true);
    expect(state.replayBlockedReason).toBeNull();
    expect(state.purgeBlockedReason).toBeNull();
  });

  it('caps how many items can be purged at once', () => {
    expect(getBatchActionState(MAX_PURGE_SELECTION).canPurge).toBe(true);
    const over = getBatchActionState(MAX_PURGE_SELECTION + 1);
    expect(over.canPurge).toBe(false);
    // Replay is still allowed — only the destructive action is capped.
    expect(over.canReplay).toBe(true);
    expect(over.purgeBlockedReason).toMatch(/limited to 200 items/);
  });

  it('disables both actions while a mutation is in flight', () => {
    const state = getBatchActionState(3, true);
    expect(state.canReplay).toBe(false);
    expect(state.canPurge).toBe(false);
    expect(state.replayBlockedReason).toBe('Working…');
  });
});

describe('formatAttemptTime', () => {
  it('formats a timestamp in UTC', () => {
    expect(formatAttemptTime('2026-01-15T10:30:00.000Z')).toMatch(/15/);
    expect(formatAttemptTime('2026-01-15T10:30:00.000Z')).toMatch(/10:30/);
  });

  it('handles missing and invalid timestamps', () => {
    expect(formatAttemptTime(null)).toBe('—');
    expect(formatAttemptTime('nope')).toBe('—');
  });
});

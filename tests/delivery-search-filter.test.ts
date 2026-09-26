import { describe, it, expect } from 'vitest';

import type { WebhookDelivery } from '@/types/webhook';
import {
  EMPTY_DELIVERY_LOG_FILTERS,
  filterDeliveryLogs,
  isDeliveryLogFilterActive,
  matchesDeliveryLog,
  statusCategoryOf,
} from '@/lib/webhookDeliveryFilter';

const URL = 'https://example.com/hook';

function delivery(overrides: Partial<WebhookDelivery>): WebhookDelivery {
  return {
    id: 'dlv-1',
    webhook_id: 'wh-1',
    event: 'outage.created',
    status: 'success',
    response_code: 200,
    created_at: '2026-09-01T10:00:00.000Z',
    ...overrides,
  };
}

const LOG: WebhookDelivery[] = [
  delivery({ id: 'dlv-ok-1', response_code: 200, status: 'success' }),
  delivery({
    id: 'dlv-client-2',
    event: 'payment.processed',
    response_code: 404,
    status: 'failed',
    response_body: { error: 'endpoint not found' },
    created_at: '2026-09-02T10:00:00.000Z',
  }),
  delivery({
    id: 'dlv-server-3',
    event: 'sla.breached',
    response_code: 502,
    status: 'failed',
    response_body: 'Bad Gateway: upstream timeout',
    created_at: '2026-09-03T10:00:00.000Z',
  }),
];

describe('statusCategoryOf', () => {
  it('buckets HTTP codes into 2xx / 4xx / 5xx', () => {
    expect(statusCategoryOf(200)).toBe('2xx');
    expect(statusCategoryOf(299)).toBe('2xx');
    expect(statusCategoryOf(404)).toBe('4xx');
    expect(statusCategoryOf(500)).toBe('5xx');
    expect(statusCategoryOf(503)).toBe('5xx');
  });

  it('treats missing and out-of-bucket codes as other', () => {
    expect(statusCategoryOf(null)).toBe('other');
    expect(statusCategoryOf(undefined)).toBe('other');
    expect(statusCategoryOf(302)).toBe('other');
  });
});

describe('delivery log search filter predicate', () => {
  it('matches by event (delivery) ID', () => {
    const filters = { ...EMPTY_DELIVERY_LOG_FILTERS, search: 'dlv-client-2' };
    expect(filterDeliveryLogs(LOG, filters, { webhookUrl: URL })).toHaveLength(
      1
    );
    expect(filterDeliveryLogs(LOG, filters, { webhookUrl: URL })[0].id).toBe(
      'dlv-client-2'
    );
  });

  it('matches by webhook URL', () => {
    const filters = { ...EMPTY_DELIVERY_LOG_FILTERS, search: 'example.com' };
    expect(filterDeliveryLogs(LOG, filters, { webhookUrl: URL })).toHaveLength(
      3
    );
  });

  it('matches by error text in the response body', () => {
    const notFound = {
      ...EMPTY_DELIVERY_LOG_FILTERS,
      search: 'endpoint not found',
    };
    expect(filterDeliveryLogs(LOG, notFound)).toEqual([LOG[1]]);

    const gateway = {
      ...EMPTY_DELIVERY_LOG_FILTERS,
      search: 'UPSTREAM TIMEOUT',
    };
    expect(filterDeliveryLogs(LOG, gateway)).toEqual([LOG[2]]);
  });

  it('is case-insensitive and ignores surrounding whitespace', () => {
    const filters = {
      ...EMPTY_DELIVERY_LOG_FILTERS,
      search: '  DLV-OK-1  ',
    };
    expect(filterDeliveryLogs(LOG, filters)).toEqual([LOG[0]]);
  });

  it('filters by HTTP status category (2xx, 4xx, 5xx)', () => {
    expect(
      filterDeliveryLogs(LOG, {
        ...EMPTY_DELIVERY_LOG_FILTERS,
        statusCategory: '2xx',
      })
    ).toEqual([LOG[0]]);
    expect(
      filterDeliveryLogs(LOG, {
        ...EMPTY_DELIVERY_LOG_FILTERS,
        statusCategory: '4xx',
      })
    ).toEqual([LOG[1]]);
    expect(
      filterDeliveryLogs(LOG, {
        ...EMPTY_DELIVERY_LOG_FILTERS,
        statusCategory: '5xx',
      })
    ).toEqual([LOG[2]]);
  });

  it('filters by event topic and date', () => {
    expect(
      filterDeliveryLogs(LOG, {
        ...EMPTY_DELIVERY_LOG_FILTERS,
        eventTopic: 'sla.breached',
      })
    ).toEqual([LOG[2]]);
    expect(
      filterDeliveryLogs(LOG, {
        ...EMPTY_DELIVERY_LOG_FILTERS,
        date: '2026-09-02',
      })
    ).toEqual([LOG[1]]);
  });

  it('combines search, status, topic, and date filters', () => {
    const filters = {
      search: 'dlv',
      statusCategory: '5xx' as const,
      eventTopic: 'sla.breached',
      date: '2026-09-03',
    };
    expect(filterDeliveryLogs(LOG, filters)).toEqual([LOG[2]]);
    expect(matchesDeliveryLog(LOG[0], filters)).toBe(false);
  });

  it('clearing the filters restores the full delivery log view', () => {
    const active = {
      search: 'timeout',
      statusCategory: '5xx' as const,
      eventTopic: 'all',
      date: '',
    };
    expect(isDeliveryLogFilterActive(active)).toBe(true);
    expect(filterDeliveryLogs(LOG, active)).toHaveLength(1);

    expect(isDeliveryLogFilterActive(EMPTY_DELIVERY_LOG_FILTERS)).toBe(false);
    const cleared = filterDeliveryLogs(LOG, {
      ...EMPTY_DELIVERY_LOG_FILTERS,
    });
    expect(cleared).toHaveLength(3);
    expect(cleared).toEqual(LOG);
  });
});

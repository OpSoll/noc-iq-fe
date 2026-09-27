import { describe, it, expect } from 'vitest';

import {
  formatBody,
  formatDeliveryTime,
  getDeliveryAttemptCount,
  getDeliveryHeaders,
  getDeliveryHttpStatus,
  getDeliveryLatencyMs,
} from '@/lib/webhookDeliveryLog';
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

describe('getDeliveryHttpStatus', () => {
  it('labels common success codes', () => {
    expect(getDeliveryHttpStatus(delivery({ response_code: 200 })).label).toBe(
      '200 OK'
    );
    expect(getDeliveryHttpStatus(delivery({ response_code: 202 })).label).toBe(
      '202 Accepted'
    );
    expect(getDeliveryHttpStatus(delivery({ response_code: 204 })).label).toBe(
      '204 No Content'
    );
  });

  it('labels common client errors', () => {
    expect(getDeliveryHttpStatus(delivery({ response_code: 404 })).label).toBe(
      '404 Not Found'
    );
    expect(getDeliveryHttpStatus(delivery({ response_code: 401 })).label).toBe(
      '401 Unauthorized'
    );
    expect(getDeliveryHttpStatus(delivery({ response_code: 429 })).label).toBe(
      '429 Too Many Requests'
    );
  });

  it('labels common server errors', () => {
    expect(getDeliveryHttpStatus(delivery({ response_code: 500 })).label).toBe(
      '500 Internal Server Error'
    );
    expect(getDeliveryHttpStatus(delivery({ response_code: 503 })).label).toBe(
      '503 Service Unavailable'
    );
    expect(getDeliveryHttpStatus(delivery({ response_code: 504 })).label).toBe(
      '504 Gateway Timeout'
    );
  });

  it('categorises by status class', () => {
    expect(getDeliveryHttpStatus(delivery({ response_code: 200 })).category).toBe(
      'success'
    );
    expect(
      getDeliveryHttpStatus(delivery({ response_code: 404 })).category
    ).toBe('client_error');
    expect(
      getDeliveryHttpStatus(delivery({ response_code: 502 })).category
    ).toBe('server_error');
  });

  it('falls back to a generic reason for an unknown code', () => {
    expect(getDeliveryHttpStatus(delivery({ response_code: 599 })).label).toBe(
      '599 Error'
    );
  });

  it('reports a missing response as having none', () => {
    const status = getDeliveryHttpStatus(delivery({ response_code: null }));
    expect(status.category).toBe('unknown');
    expect(status.label).toBe('No response');
    expect(status.code).toBeNull();
  });
});

describe('getDeliveryAttemptCount', () => {
  it('defaults to a single attempt', () => {
    expect(getDeliveryAttemptCount(delivery())).toBe(1);
  });

  it('reads a numeric attempt count', () => {
    expect(getDeliveryAttemptCount(delivery({ attempts: 7 } as never))).toBe(7);
  });

  it('reads a stringified attempt count', () => {
    expect(getDeliveryAttemptCount(delivery({ attempts: '9' } as never))).toBe(9);
  });

  it('ignores a malformed attempt count', () => {
    expect(getDeliveryAttemptCount(delivery({ attempts: 'x' } as never))).toBe(1);
    expect(getDeliveryAttemptCount(delivery({ attempts: -3 } as never))).toBe(0);
  });
});

describe('getDeliveryLatencyMs', () => {
  it('reads a numeric latency', () => {
    expect(getDeliveryLatencyMs(delivery({ latency_ms: 123.4 } as never))).toBe(
      123.4
    );
  });

  it('reads a stringified latency', () => {
    expect(getDeliveryLatencyMs(delivery({ latency_ms: '80' } as never))).toBe(80);
  });

  it('returns null when no latency was recorded', () => {
    expect(getDeliveryLatencyMs(delivery())).toBeNull();
    expect(getDeliveryLatencyMs(delivery({ latency_ms: 'abc' } as never))).toBeNull();
  });
});

describe('getDeliveryHeaders', () => {
  it('reads headers from a record', () => {
    expect(
      getDeliveryHeaders(
        delivery({ request_headers: { 'X-Trace': 'abc' } } as never)
      ).request
    ).toEqual([['X-Trace', 'abc']]);
  });

  it('reads headers from an entry array', () => {
    expect(
      getDeliveryHeaders(
        delivery({ response_headers: [['X-Trace', 'abc']] } as never)
      ).response
    ).toEqual([['X-Trace', 'abc']]);
  });

  it('redacts sensitive headers so signatures are not rendered', () => {
    const headers = getDeliveryHeaders(
      delivery({
        request_headers: {
          Authorization: 'Bearer secret',
          Cookie: 'session=1',
          'X-Signature': 'sig',
          'X-Safe': 'ok',
        },
        response_headers: { 'Set-Cookie': 'a=b', 'Content-Type': 'application/json' },
      } as never)
    );

    expect(headers.request).toEqual([['X-Safe', 'ok']]);
    expect(headers.response).toEqual([['Content-Type', 'application/json']]);
  });

  it('returns empty lists when there are no headers', () => {
    expect(getDeliveryHeaders(delivery())).toEqual({
      request: [],
      response: [],
    });
  });

  it('ignores a malformed header array', () => {
    expect(
      getDeliveryHeaders(delivery({ request_headers: ['nope'] } as never))
        .request
    ).toEqual([]);
  });
});

describe('formatBody', () => {
  it('pretty-prints an object body', () => {
    expect(formatBody({ outage_id: 7 })).toBe('{\n  "outage_id": 7\n}');
  });

  it('pretty-prints a JSON string body', () => {
    expect(formatBody('{"outage_id":7}')).toBe('{\n  "outage_id": 7\n}');
  });

  it('shows a non-JSON string verbatim', () => {
    expect(formatBody('plain text body')).toBe('plain text body');
  });

  it('renders an em dash for an empty body', () => {
    expect(formatBody(null)).toBe('—');
    expect(formatBody(undefined)).toBe('—');
    expect(formatBody('')).toBe('—');
  });
});

describe('formatDeliveryTime', () => {
  it('formats a timestamp in UTC', () => {
    const formatted = formatDeliveryTime('2026-01-15T10:30:00.000Z');
    expect(formatted).toMatch(/15/);
    expect(formatted).toMatch(/10:30:00/);
  });

  it('handles missing and invalid timestamps', () => {
    expect(formatDeliveryTime(null)).toBe('—');
    expect(formatDeliveryTime('nope')).toBe('—');
  });
});

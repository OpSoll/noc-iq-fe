// src/components/outages/__tests__/useTimelineLayout.test.ts

import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  calculateTimelineLayout,
} from '../useTimelineLayout';

describe(
  'calculateTimelineLayout',
  () => {
    it(
      'calculates deterministic positions for outage bars',
      () => {
        const viewWindow = {
          start: new Date(
            '2026-01-01T00:00:00.000Z',
          ),
          end: new Date(
            '2026-01-01T24:00:00.000Z',
          ),
        };

        const outages = [
          {
            id: 'OUT-001',
            service: 'API Gateway',
            severity: 'critical' as const,
            status: 'resolved' as const,
            startedAt:
              '2026-01-01T02:00:00.000Z',
            resolvedAt:
              '2026-01-01T06:00:00.000Z',
          },
          {
            id: 'OUT-002',
            service: 'Database',
            severity: 'high' as const,
            status: 'monitoring' as const,
            startedAt:
              '2026-01-01T04:00:00.000Z',
            resolvedAt:
              '2026-01-01T10:00:00.000Z',
          },
        ];

        const result =
          calculateTimelineLayout(
            outages,
            viewWindow,
            1200,
          );

        expect(result).toMatchSnapshot();
      },
    );
  },
);
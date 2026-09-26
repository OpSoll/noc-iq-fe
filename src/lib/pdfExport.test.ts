import { describe, it, expect } from 'vitest';
// Closes #450: unit tests for the SLA PDF report filename convention.

import { buildSlaReportFilename } from '@/lib/pdfExport';

describe('buildSlaReportFilename', () => {
  it('uses the filtered date_to month when present', () => {
    expect(
      buildSlaReportFilename({ date_from: '2026-07-01', date_to: '2026-08-15' })
    ).toBe('sla-report-2026-08.pdf');
  });

  it("falls back to date_from's month when date_to is unset", () => {
    expect(buildSlaReportFilename({ date_from: '2026-03-05' })).toBe(
      'sla-report-2026-03.pdf'
    );
  });

  it('falls back to the generation month when no filters are set', () => {
    expect(buildSlaReportFilename({}, new Date('2026-11-02T00:00:00Z'))).toBe(
      'sla-report-2026-11.pdf'
    );
  });
});

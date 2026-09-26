import { describe, expect, it } from 'vitest';

import {
  generateSampleCsv,
  SAMPLE_CSV_HEADERS,
  SAMPLE_CSV_ROWS,
} from '../SampleDownload';

describe('generateSampleCsv (issue #629)', () => {
  it('includes all supported column headers', () => {
    const csv = generateSampleCsv();
    const headerLine = csv
      .split('\n')
      .find((l) => l.startsWith('service_id'));
    expect(headerLine).toBeDefined();
    for (const h of SAMPLE_CSV_HEADERS) {
      expect(headerLine).toContain(h);
    }
  });

  it('includes 3 sample data rows', () => {
    const csv = generateSampleCsv();
    for (const row of SAMPLE_CSV_ROWS) {
      expect(csv).toContain(row[0]); // service_id
      expect(csv).toContain(row[2]); // start_time ISO
    }
  });

  it('includes explanatory comment lines', () => {
    const csv = generateSampleCsv();
    expect(csv).toMatch(/^# /m);
    expect(csv.toLowerCase()).toContain('required');
    expect(csv.toLowerCase()).toContain('iso-8601');
  });

  it('produces valid CSV structure (header + 3 data rows at minimum)', () => {
    const lines = generateSampleCsv()
      .split('\n')
      .filter((l) => l.trim() && !l.startsWith('#'));
    expect(lines.length).toBeGreaterThanOrEqual(4); // header + 3 rows
    expect(lines[0].split(',').length).toBe(SAMPLE_CSV_HEADERS.length);
  });
});

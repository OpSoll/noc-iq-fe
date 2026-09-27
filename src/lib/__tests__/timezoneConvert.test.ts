import { describe, it, expect } from 'vitest';
import {
  convertTimestampToUtc,
  previewTimestampConversions,
  convertRowTimestampsToUtc,
  getOffsetMinutes,
} from '../timezoneConvert';

describe('timezoneConvert (#634)', () => {
  it('leaves UTC source with Z suffix normalized', () => {
    const iso = convertTimestampToUtc('2026-01-15T12:00:00Z', 'UTC');
    expect(iso).toBe('2026-01-15T12:00:00.000Z');
  });

  it('converts EST wall time to UTC (+5h)', () => {
    const iso = convertTimestampToUtc('2026-01-15 12:00:00', 'EST');
    expect(iso).toBe('2026-01-15T17:00:00.000Z');
  });

  it('converts PST wall time to UTC (+8h)', () => {
    const iso = convertTimestampToUtc('2026-01-15T00:00:00', 'PST');
    expect(iso).toBe('2026-01-15T08:00:00.000Z');
  });

  it('converts CET wall time to UTC (-1h)', () => {
    const iso = convertTimestampToUtc('2026-06-01T14:30:00', 'CET');
    expect(iso).toBe('2026-06-01T13:30:00.000Z');
  });

  it('previewTimestampConversions includes errors for bad input', () => {
    const previews = previewTimestampConversions(
      ['2026-01-01T00:00:00', 'not-a-date'],
      'UTC',
    );
    expect(previews[0].utc).toContain('2026-01-01');
    expect(previews[1].error).toBeTruthy();
  });

  it('convertRowTimestampsToUtc maps start_time and end_time', () => {
    const rows = convertRowTimestampsToUtc(
      [
        {
          service_id: 's1',
          start_time: '2026-01-15 12:00:00',
          end_time: '2026-01-15 13:00:00',
        },
      ],
      ['start_time', 'end_time'],
      'EST',
    );
    expect(rows[0].start_time).toBe('2026-01-15T17:00:00.000Z');
    expect(rows[0].end_time).toBe('2026-01-15T18:00:00.000Z');
  });

  it('getOffsetMinutes returns fixed offsets for named zones', () => {
    expect(getOffsetMinutes('UTC')).toBe(0);
    expect(getOffsetMinutes('EST')).toBe(-300);
    expect(getOffsetMinutes('PST')).toBe(-480);
    expect(getOffsetMinutes('CET')).toBe(60);
  });
});

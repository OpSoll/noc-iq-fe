import { describe, expect, it } from 'vitest';

import {
  formatProgressLabel,
  type ImportProgressState,
} from '../ImportProgress';

describe('ImportProgress state helpers (issue #630)', () => {
  it('formats processed / total counts', () => {
    const state: ImportProgressState = {
      phase: 'processing',
      percent: 45,
      processed: 450,
      total: 1000,
    };
    expect(formatProgressLabel(state)).toBe('450 / 1,000');
  });

  it('falls back to percent when total is zero', () => {
    const state: ImportProgressState = {
      phase: 'uploading',
      percent: 12,
      processed: 0,
      total: 0,
    };
    expect(formatProgressLabel(state)).toBe('12%');
  });

  it('supports completion summary shape', () => {
    const state: ImportProgressState = {
      phase: 'success',
      percent: 100,
      processed: 1000,
      total: 1000,
      summary: { total: 1000, imported: 980, failed: 20, skipped: 0 },
    };
    expect(state.summary?.imported).toBe(980);
    expect(state.summary?.failed).toBe(20);
    expect(formatProgressLabel(state)).toBe('1,000 / 1,000');
  });
});

import { beforeEach, describe, expect, it } from 'vitest';

import {
  ALLOWED_PAGE_SIZES,
  DEFAULT_PAGE_SIZE,
  PAGE_SIZE_STORAGE_KEY,
  parsePageSize,
  readPersistedPageSize,
  usePreferenceStore,
  writePersistedPageSize,
} from './preferenceStore';

/**
 * #1013 — persisted page-size preference: storage read/write and invalid-value
 * fallback.
 */
describe('parsePageSize (#1013)', () => {
  it('accepts positive integers from strings and numbers', () => {
    expect(parsePageSize('50')).toBe(50);
    expect(parsePageSize(50)).toBe(50);
    expect(parsePageSize(' 25 ')).toBe(25);
  });

  it('rejects missing/empty values', () => {
    expect(parsePageSize(null)).toBeNull();
    expect(parsePageSize(undefined)).toBeNull();
    expect(parsePageSize('')).toBeNull();
  });

  it('rejects non-numeric values', () => {
    expect(parsePageSize('abc')).toBeNull();
    expect(parsePageSize('10px')).toBeNull();
  });

  it('rejects zero, negatives, fractions and NaN', () => {
    expect(parsePageSize(0)).toBeNull();
    expect(parsePageSize(-5)).toBeNull();
    expect(parsePageSize(2.5)).toBeNull();
    expect(parsePageSize(Number.NaN)).toBeNull();
  });
});

describe('persisted page size read/write (#1013)', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('write then read round-trips the value', () => {
    writePersistedPageSize(50);
    expect(window.localStorage.getItem(PAGE_SIZE_STORAGE_KEY)).toBe('50');
    expect(readPersistedPageSize()).toBe(50);
  });

  it('returns the default when nothing is stored', () => {
    expect(readPersistedPageSize()).toBe(DEFAULT_PAGE_SIZE);
  });

  it('falls back to the default for an invalid stored value', () => {
    window.localStorage.setItem(PAGE_SIZE_STORAGE_KEY, 'not-a-number');
    expect(readPersistedPageSize()).toBe(DEFAULT_PAGE_SIZE);
  });

  it('falls back to the default for a zero/negative stored value', () => {
    window.localStorage.setItem(PAGE_SIZE_STORAGE_KEY, '0');
    expect(readPersistedPageSize()).toBe(DEFAULT_PAGE_SIZE);
    window.localStorage.setItem(PAGE_SIZE_STORAGE_KEY, '-10');
    expect(readPersistedPageSize()).toBe(DEFAULT_PAGE_SIZE);
  });

  it('accepts every allowed option', () => {
    for (const size of ALLOWED_PAGE_SIZES) {
      writePersistedPageSize(size);
      expect(readPersistedPageSize()).toBe(size);
    }
  });
});

describe('usePreferenceStore (#1013)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    usePreferenceStore.getState().hydrate();
  });

  it('exposes the default page size initially', () => {
    expect(usePreferenceStore.getState().pageSize).toBe(DEFAULT_PAGE_SIZE);
  });

  it('setPageSize updates state and persists it (write path)', () => {
    usePreferenceStore.getState().setPageSize(50);
    expect(usePreferenceStore.getState().pageSize).toBe(50);
    expect(window.localStorage.getItem(PAGE_SIZE_STORAGE_KEY)).toBe('50');
  });

  it('a new store instance reads the persisted value (read path)', () => {
    window.localStorage.setItem(PAGE_SIZE_STORAGE_KEY, '100');
    usePreferenceStore.getState().hydrate();
    expect(usePreferenceStore.getState().pageSize).toBe(100);
  });

  it('hydrate falls back for an invalid persisted value', () => {
    window.localStorage.setItem(PAGE_SIZE_STORAGE_KEY, 'garbage');
    usePreferenceStore.getState().hydrate();
    expect(usePreferenceStore.getState().pageSize).toBe(DEFAULT_PAGE_SIZE);
  });

  it('ignores an invalid setPageSize and does not persist it', () => {
    usePreferenceStore.getState().setPageSize(75);
    usePreferenceStore.getState().setPageSize(0);
    usePreferenceStore.getState().setPageSize(Number.NaN);

    expect(usePreferenceStore.getState().pageSize).toBe(75);
    expect(window.localStorage.getItem(PAGE_SIZE_STORAGE_KEY)).toBe('75');
  });
});

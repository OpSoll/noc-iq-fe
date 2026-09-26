import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockSearchParamsGet = vi.fn();
const mockSearchParamsToString = vi.fn();

vi.mock('next/navigation', () => ({
  useSearchParams: () => ({
    get: mockSearchParamsGet,
    toString: mockSearchParamsToString,
  }),
}));

import { useUrlSync } from '@/hooks/useUrlSync';

const defaults = { search: '', severity: '', date_from: '', date_to: '' };

describe('useUrlSync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParamsGet.mockReturnValue(null);
    mockSearchParamsToString.mockReturnValue('');
    window.history.replaceState(null, '', '/outages?keep=1#table');
  });

  it('initializes filter state from URL parameters and defaults', () => {
    mockSearchParamsGet.mockImplementation((key: string) => {
      const params = { search: 'db', severity: 'critical' };
      return params[key as keyof typeof params] ?? null;
    });

    const { result } = renderHook(() => useUrlSync(defaults));

    expect(result.current[0]).toEqual({
      search: 'db',
      severity: 'critical',
      date_from: '',
      date_to: '',
    });
  });

  it('updates and removes query parameters while preserving other URL parts', () => {
    mockSearchParamsToString.mockReturnValue('keep=1&search=old');
    const { result } = renderHook(() => useUrlSync(defaults));

    act(() => {
      result.current[1]({ search: 'db', severity: 'critical' });
    });

    expect(window.location.pathname).toBe('/outages');
    expect(window.location.hash).toBe('#table');
    expect(new URLSearchParams(window.location.search).get('keep')).toBe('1');
    const updatedParams = new URLSearchParams(window.location.search);
    expect(updatedParams.get('search')).toBe('db');
    expect(updatedParams.get('severity')).toBe('critical');

    mockSearchParamsToString.mockReturnValue(
      'keep=1&search=db&severity=critical'
    );
    act(() => {
      result.current[1]({ search: '' });
    });

    expect(new URLSearchParams(window.location.search).has('search')).toBe(
      false
    );
  });
});

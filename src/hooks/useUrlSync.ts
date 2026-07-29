'use client';

import { useCallback } from 'react';
import { useSearchParams } from 'next/navigation';

export function useUrlSync<T extends Record<string, string>>(defaults: T) {
  const searchParams = useSearchParams();

  const state = Object.keys(defaults).reduce((acc, key) => {
    const value = searchParams.get(key);
    acc[key as keyof T] = (value !== null ? value : defaults[key]) as T[keyof T];
    return acc;
  }, {} as T);

  const setState = useCallback(
    (updates: Partial<T>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === defaults[key as keyof T]) {
          params.delete(key);
        } else {
          params.set(key, String(value));
        }
      }
      const newUrl = params.toString() ? `?${params.toString()}` : window.location.pathname;
      window.history.replaceState(null, '', newUrl);
    },
    [searchParams, defaults],
  );

  return [state, setState] as const;
}

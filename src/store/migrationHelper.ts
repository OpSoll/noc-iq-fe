/* eslint-disable @typescript-eslint/no-explicit-any */
import type { PersistOptions } from 'zustand/middleware';

export function createMigratedPersistOptions<T extends object>(
  name: string,
  version: number,
  migrations: Record<number, (persistedState: any) => any>
): PersistOptions<T> {
  return {
    name,
    version,
    migrate: (persistedState: any, stateVersion: number) => {
      let state = persistedState;
      for (let v = stateVersion; v < version; v++) {
        if (migrations[v]) {
          state = migrations[v](state);
        }
      }
      return state as T;
    },
  };
}

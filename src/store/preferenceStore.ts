import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface PreferenceState {
  pageSize: number;
  setPageSize: (size: number) => void;
}

export const usePreferenceStore = create<PreferenceState>()(
  persist(
    (set) => ({
      pageSize: 25,
      setPageSize: (size) => set({ pageSize: size }),
    }),
    {
      name: 'noc_user_preferences',
    }
  )
);

import { create } from 'zustand';
interface PreferenceState {
  pageSize: number;
  setPageSize: (size: number) => void;
}
export const usePreferenceStore = create<PreferenceState>((set) => ({
  pageSize: 25,
  setPageSize: (pageSize) => set({ pageSize }),
}));

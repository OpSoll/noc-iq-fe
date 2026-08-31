import { create } from 'zustand';

interface SettingsState {
  theme: 'light' | 'dark' | 'system';
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  resetAll: () => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  theme: 'system',
  setTheme: (theme) => set({ theme }),
  resetAll: () => {
    localStorage.clear();
    set({ theme: 'system' });
  },
}));

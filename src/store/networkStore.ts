import { create } from 'zustand';

interface NetworkStoreState {
  isOnline: boolean;
  setIsOnline: (online: boolean) => void;
}

export const useNetworkStore = create<NetworkStoreState>((set) => ({
  isOnline: typeof window !== 'undefined' ? navigator.onLine : true,
  setIsOnline: (online) => set({ isOnline: online }),
}));

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => useNetworkStore.getState().setIsOnline(true));
  window.addEventListener('offline', () => useNetworkStore.getState().setIsOnline(false));
}

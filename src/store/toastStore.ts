import { create } from 'zustand';

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
  timestamp: number;
}

interface ToastStoreState {
  toasts: Toast[];
  addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  removeToast: (id: string) => void;
}

export const useToastStore = create<ToastStoreState>((set, get) => ({
  toasts: [],
  addToast: (message, type = 'info') => {
    const now = Date.now();
    const existing = get().toasts.find(t => t.message === message && now - t.timestamp < 2000);
    if (existing) return; // Deduplicate within 2s

    const id = Math.random().toString(36).substring(7);
    set(state => ({
      toasts: [...state.toasts, { id, message, type, timestamp: now }]
    }));
  },
  removeToast: (id) => set(state => ({
    toasts: state.toasts.filter(t => t.id !== id)
  })),
}));

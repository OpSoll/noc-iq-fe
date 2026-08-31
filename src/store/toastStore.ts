import { create } from 'zustand';
interface Toast {
  id: string;
  message: string;
}
interface ToastStoreState {
  toasts: Toast[];
  addToast: (message: string) => void;
}
export const useToastStore = create<ToastStoreState>((set) => ({
  toasts: [],
  addToast: (message) => set((state) => ({ toasts: [...state.toasts, { id: Math.random().toString(), message }] })),
}));

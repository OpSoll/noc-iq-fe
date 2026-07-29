// Simple event emitter for network status
type Listener = (isOnline: boolean) => void;
let listener: Listener | null = null;

export const networkEvents = {
  subscribe: (newListener: Listener) => {
    listener = newListener;
    return () => {
      listener = null;
    };
  },
  emit: (isOnline: boolean) => {
    if (listener) {
      listener(isOnline);
    }
  },
};

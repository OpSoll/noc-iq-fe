"use client";

import { networkEvents } from "@/lib/network-events";
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
} from "react";

interface NetworkStatusState {
  isOnline: boolean;
  triggerRetry: () => void;
  setIsOnline: (isOnline: boolean) => void;
}

const NetworkStatusContext = createContext<NetworkStatusState | undefined>(
  undefined,
);

export function NetworkStatusProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isOnline, setIsOnline] = useState(true);
  const [retry, setRetry] = useState(0);

  const triggerRetry = useCallback(() => {
    setRetry((c) => c + 1);
  }, []);

  useEffect(() => {
    const onlineHandler = () => setIsOnline(true);
    const offlineHandler = () => setIsOnline(false);

    window.addEventListener("online", onlineHandler);
    window.addEventListener("offline", offlineHandler);

    const unsubscribe = networkEvents.subscribe(setIsOnline);

    // Initial check
    setIsOnline(navigator.onLine);

    return () => {
      window.removeEventListener("online", onlineHandler);
      window.removeEventListener("offline", offlineHandler);
      unsubscribe();
    };
  }, []);

  const value = useMemo(
    () => ({ isOnline, triggerRetry }),
    [isOnline, triggerRetry],
  );

  return (
    <NetworkStatusContext.Provider value={value}>
      {children}
    </NetworkStatusContext.Provider>
  );
}

export function useNetworkStatus() {
  const context = useContext(NetworkStatusContext);
  if (context === undefined) {
    throw new Error(
      "useNetworkStatus must be used within a NetworkStatusProvider",
    );
  }
  return context;
}
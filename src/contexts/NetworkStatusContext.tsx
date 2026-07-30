"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
} from "react";
import { networkEvents } from "@/lib/network-events";

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
  const [isOnline, setIsOnline] = useState(() =>
    typeof window !== "undefined" ? navigator.onLine : true,
  );
  const [, setRetry] = useState(0);

  const triggerRetry = useCallback(() => {
    setRetry((c) => c + 1);
  }, []);

  useEffect(() => {
    const onlineHandler = () => setIsOnline(true);
    const offlineHandler = () => setIsOnline(false);

    window.addEventListener("online", onlineHandler);
    window.addEventListener("offline", offlineHandler);

    const unsubscribe = networkEvents.subscribe(setIsOnline);

    return () => {
      window.removeEventListener("online", onlineHandler);
      window.removeEventListener("offline", offlineHandler);
      unsubscribe();
    };
  }, []);

  const value = useMemo(
    () => ({ isOnline, triggerRetry, setIsOnline }),
    [isOnline, triggerRetry, setIsOnline],
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
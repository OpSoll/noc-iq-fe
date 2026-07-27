"use client";

import { createContext, ReactNode, useContext } from "react";
import { isFeatureEnabled, type FeatureFlag } from "@/lib/featureFlags";

interface FeatureFlagContextValue {
  isEnabled: (flag: FeatureFlag) => boolean;
}

const FeatureFlagContext = createContext<FeatureFlagContextValue>({
  isEnabled: () => false,
});

export function FeatureFlagProvider({ children }: { children: ReactNode }) {
  const value: FeatureFlagContextValue = {
    isEnabled: (flag) => isFeatureEnabled(flag),
  };

  return (
    <FeatureFlagContext.Provider value={value}>
      {children}
    </FeatureFlagContext.Provider>
  );
}

export function useFeatureFlag(flag: FeatureFlag): boolean {
  const ctx = useContext(FeatureFlagContext);
  return ctx.isEnabled(flag);
}

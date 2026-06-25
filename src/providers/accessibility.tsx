"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type AccessibilityMode = "default" | "high-contrast" | "reduced-motion";

interface AccessibilityContextValue {
  mode: AccessibilityMode;
  setMode: (mode: AccessibilityMode) => void;
  isHighContrast: boolean;
  isReducedMotion: boolean;
}

const STORAGE_KEY = "noc_a11y_mode";

const AccessibilityContext = createContext<AccessibilityContextValue | null>(null);

function getStoredMode(): AccessibilityMode {
  if (typeof window === "undefined") return "default";
  const stored = localStorage.getItem(STORAGE_KEY) as AccessibilityMode | null;

  if (stored === "high-contrast" || stored === "reduced-motion") {
    return stored;
  }
  // Check system preference for reduced motion
  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;
  if (prefersReducedMotion) return "reduced-motion";

  return "default";
}

export function AccessibilityProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<AccessibilityMode>("default");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setModeState(getStoredMode());
    setHydrated(true);
  }, []);

  const setMode = useCallback((newMode: AccessibilityMode) => {
    setModeState(newMode);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, newMode);
    }
  }, []);

  // Apply mode classes to <html>
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("a11y-high-contrast", "a11y-reduced-motion");
    if (mode === "high-contrast") {
      root.classList.add("a11y-high-contrast");
    } else if (mode === "reduced-motion") {
      root.classList.add("a11y-reduced-motion");
    }
  }, [mode]);

  // Listen for system preference changes
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    function handleChange() {
      if (mediaQuery.matches && mode === "default") {
        setModeState("reduced-motion");
      }
    }
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [mode]);

  const value = useMemo<AccessibilityContextValue>(
    () => ({
      mode,
      setMode,
      isHighContrast: mode === "high-contrast",
      isReducedMotion: mode === "reduced-motion",
    }),
    [mode, setMode],
  );

  // Don't render with incorrect mode before hydration
  if (!hydrated) return <>{children}</>;

  return (
    <AccessibilityContext.Provider value={value}>
      {children}
    </AccessibilityContext.Provider>
  );
}

export function useAccessibility(): AccessibilityContextValue {
  const context = useContext(AccessibilityContext);
  if (!context) {
    throw new Error("useAccessibility must be used within AccessibilityProvider");
  }
  return context;
}

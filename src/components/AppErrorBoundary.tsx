"use client";
import { Component, useEffect, useState, type ReactNode } from "react";
// Closes #337: error boundary with contextual fallback UI per route section
// Closes #338: dark mode support with system preference detection + toggle

interface BoundaryProps {
  children: ReactNode;
  section?: string;
  fallback?: ReactNode;
}
interface BoundaryState {
  hasError: boolean;
}
export class AppErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div role="alert" className="p-4 text-sm text-destructive">
            Something went wrong{this.props.section ? ` in ${this.props.section}` : ""}.
          </div>
        )
      );
    }
    return this.props.children;
  }
}

const DARK_MODE_KEY = "noc_dark_mode";
export function useDarkMode() {
  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    const stored = localStorage.getItem(DARK_MODE_KEY);
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    setIsDark(stored ? stored === "true" : prefersDark);
  }, []);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
  }, [isDark]);
  const toggle = () => {
    setIsDark((prev) => {
      localStorage.setItem(DARK_MODE_KEY, String(!prev));
      return !prev;
    });
  };

  return { isDark, toggle };
}

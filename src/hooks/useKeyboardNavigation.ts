"use client";

import { useEffect, useCallback, useMemo } from "react";
import { useRouter, usePathname } from "next/navigation";

export interface ShortcutBinding {
  key: string;
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
  description: string;
  action: () => void;
  scope?: string;
}

const DEFAULT_BINDINGS: ShortcutBinding[] = [
  { key: "d", ctrl: true, description: "Go to dashboard", action: () => {}, scope: "global" },
  { key: "o", ctrl: true, description: "Go to outages", action: () => {}, scope: "global" },
  { key: "p", ctrl: true, description: "Go to payments", action: () => {}, scope: "global" },
  { key: "s", ctrl: true, description: "Go to settings", action: () => {}, scope: "global" },
  { key: "w", ctrl: true, description: "Go to webhooks", action: () => {}, scope: "global" },
  { key: "b", ctrl: true, description: "Go to bulk import", action: () => {}, scope: "global" },
  { key: "Escape", description: "Close drawer or cancel", action: () => {}, scope: "global" },
  { key: "?", description: "Show keyboard shortcuts", action: () => {}, scope: "global" },
];

export function useKeyboardNavigation(extraBindings: ShortcutBinding[] = []) {
  const router = useRouter();
  const pathname = usePathname();

  const routeBindings: ShortcutBinding[] = useMemo(
    () => [
      { key: "d", ctrl: true, description: "Go to dashboard", action: () => router.push("/") },
      { key: "o", ctrl: true, description: "Go to outages", action: () => router.push("/outages") },
      { key: "p", ctrl: true, description: "Go to payments", action: () => router.push("/payments") },
      { key: "s", ctrl: true, description: "Go to settings", action: () => router.push("/setting") },
      { key: "w", ctrl: true, description: "Go to webhooks", action: () => router.push("/webhooks") },
      { key: "b", ctrl: true, description: "Go to bulk import", action: () => router.push("/bulk-import") },
    ],
    [router],
  );

  const allBindings = useMemo(
    () => [...routeBindings, ...extraBindings],
    [routeBindings, extraBindings],
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      for (const binding of allBindings) {
        const ctrlOrMeta = binding.ctrl || binding.meta;
        const keyMatch = event.key.toLowerCase() === binding.key.toLowerCase() ||
          event.key === binding.key;

        if (!keyMatch) continue;
        if (ctrlOrMeta && !(event.ctrlKey || event.metaKey)) continue;
        if (binding.shift && !event.shiftKey) continue;
        if (ctrlOrMeta && (event.ctrlKey || event.metaKey)) {
          event.preventDefault();
          binding.action();
          return;
        }
        if (!ctrlOrMeta && !event.ctrlKey && !event.metaKey) {
          event.preventDefault();
          binding.action();
          return;
        }
      }
    },
    [allBindings],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return { bindings: allBindings };
}

export function getScopeForPath(pathname: string): string {
  if (pathname.startsWith("/outages")) return "outages";
  if (pathname.startsWith("/payments")) return "payments";
  if (pathname.startsWith("/webhooks")) return "webhooks";
  if (pathname.startsWith("/setting")) return "settings";
  if (pathname.startsWith("/bulk-import")) return "bulk-import";
  if (pathname.startsWith("/config")) return "config";
  return "global";
}

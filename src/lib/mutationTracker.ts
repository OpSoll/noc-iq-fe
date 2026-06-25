"use client";

export interface PendingMutation {
  id: string;
  description: string;
  url: string;
  method: string;
  data: unknown;
  timestamp: number;
}

const MUTATIONS_KEY = "noc_pending_mutations";

export function getPendingMutations(): PendingMutation[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(MUTATIONS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addPendingMutation(mutation: PendingMutation): void {
  if (typeof window === "undefined") return;
  const existing = getPendingMutations();
  existing.push(mutation);
  try {
    sessionStorage.setItem(MUTATIONS_KEY, JSON.stringify(existing.slice(-10)));
  } catch {
    // storage full
  }
}

export function clearPendingMutation(id: string): void {
  const existing = getPendingMutations().filter((m) => m.id !== id);
  try {
    sessionStorage.setItem(MUTATIONS_KEY, JSON.stringify(existing));
  } catch {
    // storage unavailable
  }
}

export function clearAllPendingMutations(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(MUTATIONS_KEY);
  } catch {
    // storage unavailable
  }
}

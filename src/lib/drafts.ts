const DRAFT_PREFIX = "noc_draft_";
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

export interface DraftData {
  values: Record<string, string>;
  savedAt: number;
  expiresAt: number;
}

export function saveDraft(key: string, values: Record<string, string>, ttl = DEFAULT_TTL_MS): void {
  if (typeof window === "undefined") return;
  const now = Date.now();
  const draft: DraftData = { values, savedAt: now, expiresAt: now + ttl };
  try {
    sessionStorage.setItem(DRAFT_PREFIX + key, JSON.stringify(draft));
  } catch {
    // sessionStorage full or unavailable
  }
}

export function loadDraft(key: string): DraftData | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(DRAFT_PREFIX + key);
    if (!raw) return null;
    const draft: DraftData = JSON.parse(raw);
    if (Date.now() > draft.expiresAt) {
      sessionStorage.removeItem(DRAFT_PREFIX + key);
      return null;
    }
    return draft;
  } catch {
    return null;
  }
}

export function clearDraft(key: string): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(DRAFT_PREFIX + key);
}

export function useDraftRestore<T extends Record<string, string>>(
  draftKey: string,
  initialState: T,
): { restored: boolean; values: T } {
  if (typeof window === "undefined") return { restored: false, values: initialState };
  const draft = loadDraft(draftKey);
  if (draft) {
    const merged = { ...initialState };
    for (const k of Object.keys(initialState)) {
      if (draft.values[k] !== undefined) {
        (merged as Record<string, string>)[k] = draft.values[k];
      }
    }
    return { restored: true, values: merged as T };
  }
  return { restored: false, values: initialState };
}

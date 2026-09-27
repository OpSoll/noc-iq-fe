/**
 * Persistence for the collapsed navigation sidebar.
 *
 * The sidebar's expanded width is unusable on a 13" laptop, and re-collapsing
 * it on every page load means an operator who prefers the compact view keeps
 * paying the cost of the wide one. Persisting the preference makes the
 * choice stick.
 *
 * Closes #676 — sidebar navigation auto-collapse state persistence.
 */

/** localStorage key for the collapsed preference. */
export const SIDEBAR_COLLAPSED_KEY = 'noc_sidebar_collapsed';

/** Below this viewport width the sidebar starts collapsed regardless. */
export const SIDEBAR_AUTO_COLLAPSE_BREAKPOINT = 1024;

export function readCollapsedPreference(): boolean | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
    if (stored === 'true') return true;
    if (stored === 'false') return false;
    return null;
  } catch {
    // Storage blocked (private mode, sandboxed iframe). Fall back to the
    // viewport default rather than failing to render.
    return null;
  }
}

export function writeCollapsedPreference(collapsed: boolean) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(collapsed));
  } catch {
    // A failed write only costs the preference next reload.
  }
}

export function clearCollapsedPreference() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(SIDEBAR_COLLAPSED_KEY);
  } catch {
    // Ignore.
  }
}

/** True when the viewport is narrow enough that the sidebar should collapse. */
export function shouldAutoCollapse(width: number): boolean {
  return width > 0 && width < SIDEBAR_AUTO_COLLAPSE_BREAKPOINT;
}

/**
 * Resolves the initial collapsed state.
 *
 * A stored preference always wins: someone who deliberately chose collapsed on
 * a wide monitor should not have it overridden by the viewport. Only when no
 * preference exists does the viewport decide.
 */
export function getInitialCollapsedState(
  viewportWidth?: number,
  stored: boolean | null = readCollapsedPreference()
): boolean {
  if (stored !== null) return stored;
  if (viewportWidth === undefined) return false;
  return shouldAutoCollapse(viewportWidth);
}

/**
 * Effective collapsed state, given whether the user has taken control.
 *
 * Below the breakpoint the sidebar stays collapsed no matter the preference —
 * that is the whole reason the breakpoint exists — but the operator can still
 * expand it to reach a label, so an explicit choice is respected.
 */
export function getEffectiveCollapsedState(
  viewportWidth: number,
  userPrefersCollapsed: boolean | null
): boolean {
  if (shouldAutoCollapse(viewportWidth)) return true;
  return userPrefersCollapsed === true;
}

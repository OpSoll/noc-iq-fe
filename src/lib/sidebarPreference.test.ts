import { afterEach, beforeEach, describe, it, expect } from 'vitest';

import {
  clearCollapsedPreference,
  getEffectiveCollapsedState,
  getInitialCollapsedState,
  readCollapsedPreference,
  shouldAutoCollapse,
  SIDEBAR_AUTO_COLLAPSE_BREAKPOINT,
  SIDEBAR_COLLAPSED_KEY,
  writeCollapsedPreference,
} from '@/lib/sidebarPreference';

describe('collapsed preference storage', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it('returns null when nothing is stored', () => {
    expect(readCollapsedPreference()).toBeNull();
  });

  it('round-trips a collapsed preference', () => {
    writeCollapsedPreference(true);
    expect(readCollapsedPreference()).toBe(true);
  });

  it('round-trips an expanded preference', () => {
    writeCollapsedPreference(false);
    expect(readCollapsedPreference()).toBe(false);
  });

  it('writes under the documented key', () => {
    writeCollapsedPreference(true);
    expect(window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY)).toBe('true');
  });

  it('clears the preference', () => {
    writeCollapsedPreference(true);
    clearCollapsedPreference();
    expect(readCollapsedPreference()).toBeNull();
  });

  it('ignores a corrupt stored value', () => {
    window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, 'yes-please');
    expect(readCollapsedPreference()).toBeNull();
  });
});

describe('shouldAutoCollapse', () => {
  it('collapses below the breakpoint', () => {
    expect(shouldAutoCollapse(SIDEBAR_AUTO_COLLAPSE_BREAKPOINT - 1)).toBe(true);
    expect(shouldAutoCollapse(800)).toBe(true);
  });

  it('does not collapse at or above the breakpoint', () => {
    expect(shouldAutoCollapse(SIDEBAR_AUTO_COLLAPSE_BREAKPOINT)).toBe(false);
    expect(shouldAutoCollapse(1440)).toBe(false);
  });

  it('treats an unknown width as wide rather than collapsing', () => {
    // jsdom and SSR can report 0; collapsing on every server render would
    // flash the compact layout on load.
    expect(shouldAutoCollapse(0)).toBe(false);
  });
});

describe('getInitialCollapsedState', () => {
  it('collapses on a narrow viewport when no preference exists', () => {
    expect(getInitialCollapsedState(800, null)).toBe(true);
  });

  it('expands on a wide viewport when no preference exists', () => {
    expect(getInitialCollapsedState(1440, null)).toBe(false);
  });

  it('lets a stored collapsed preference win over a wide viewport', () => {
    expect(getInitialCollapsedState(1440, true)).toBe(true);
  });

  it('lets a stored expanded preference win over a narrow viewport', () => {
    // An operator who deliberately expanded the sidebar keeps it that way.
    expect(getInitialCollapsedState(800, false)).toBe(false);
  });

  it('defaults to expanded when the viewport is unknown', () => {
    expect(getInitialCollapsedState(undefined, null)).toBe(false);
  });
});

describe('getEffectiveCollapsedState', () => {
  it('forces collapsed below the breakpoint regardless of preference', () => {
    expect(getEffectiveCollapsedState(800, null)).toBe(true);
    expect(getEffectiveCollapsedState(800, true)).toBe(true);
  });

  it('follows the preference at or above the breakpoint', () => {
    expect(getEffectiveCollapsedState(1440, true)).toBe(true);
    expect(getEffectiveCollapsedState(1440, false)).toBe(false);
  });

  it('expands by default above the breakpoint with no preference', () => {
    expect(getEffectiveCollapsedState(1440, null)).toBe(false);
  });
});

import { describe, it, expect } from 'vitest';

import {
  getShortcutsByCategory,
  isEditableTarget,
  isShortcutsHelpEvent,
  SHORTCUTS,
  SHORTCUT_CATEGORIES,
  type ShortcutCategory,
} from '@/lib/shortcuts';

describe('SHORTCUT_CATEGORIES', () => {
  it('covers the categories the issue names', () => {
    expect(SHORTCUT_CATEGORIES).toEqual([
      'Navigation',
      'Outage Table',
      'Command Palette',
      'Actions',
    ]);
  });
});

describe('SHORTCUTS registry', () => {
  it('has a unique id for every shortcut', () => {
    const ids = SHORTCUTS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives every shortcut keys and a description', () => {
    for (const shortcut of SHORTCUTS) {
      expect(shortcut.keys.length).toBeGreaterThan(0);
      expect(shortcut.description.length).toBeGreaterThan(5);
    }
  });

  it('assigns every shortcut to a known category', () => {
    for (const shortcut of SHORTCUTS) {
      expect(SHORTCUT_CATEGORIES).toContain(shortcut.category);
    }
  });

  it('populates every category, so none renders empty', () => {
    for (const category of SHORTCUT_CATEGORIES) {
      expect(getShortcutsByCategory(category).length).toBeGreaterThan(0);
    }
  });

  it('partitions the registry exactly, with nothing unaccounted for', () => {
    const total = SHORTCUT_CATEGORIES.reduce(
      (sum, category) => sum + getShortcutsByCategory(category).length,
      0
    );
    expect(total).toBe(SHORTCUTS.length);
  });

  it('documents the Shift+? trigger', () => {
    expect(
      getShortcutsByCategory('Navigation').some((s) => s.id === 'shift+?')
    ).toBe(true);
  });

  it('documents the command palette shortcut', () => {
    expect(
      getShortcutsByCategory('Command Palette').some((s) => s.id === 'mod+k')
    ).toBe(true);
  });

  it('documents an outage-table search shortcut', () => {
    expect(
      getShortcutsByCategory('Outage Table').some((s) => s.id === '/')
    ).toBe(true);
  });
});

describe('getShortcutsByCategory', () => {
  it('returns only the requested category', () => {
    for (const category of SHORTCUT_CATEGORIES) {
      for (const shortcut of getShortcutsByCategory(category)) {
        expect(shortcut.category).toBe(category as ShortcutCategory);
      }
    }
  });

  it('returns an empty list for an unknown category', () => {
    expect(getShortcutsByCategory('Nope' as ShortcutCategory)).toEqual([]);
  });
});

describe('isShortcutsHelpEvent', () => {
  it('matches Shift + ?', () => {
    expect(isShortcutsHelpEvent({ key: '?', shiftKey: true })).toBe(true);
  });

  it('does not match a bare slash, which focuses the outage filter', () => {
    // `?` is Shift + / on a US layout, so a plain `/` must not match.
    expect(isShortcutsHelpEvent({ key: '/', shiftKey: false })).toBe(false);
    expect(isShortcutsHelpEvent({ key: '/', shiftKey: true })).toBe(false);
  });

  it('does not match an unshifted question mark', () => {
    expect(isShortcutsHelpEvent({ key: '?', shiftKey: false })).toBe(false);
  });

  it('does not match when another modifier is held', () => {
    expect(
      isShortcutsHelpEvent({ key: '?', shiftKey: true, ctrlKey: true })
    ).toBe(false);
    expect(
      isShortcutsHelpEvent({ key: '?', shiftKey: true, metaKey: true })
    ).toBe(false);
    expect(
      isShortcutsHelpEvent({ key: '?', shiftKey: true, altKey: true })
    ).toBe(false);
  });

  it('does not match other keys', () => {
    expect(isShortcutsHelpEvent({ key: 'k', shiftKey: true })).toBe(false);
  });
});

describe('isEditableTarget', () => {
  const element = (tag: string, contentEditable = false) =>
    ({ tagName: tag, isContentEditable: contentEditable }) as unknown as HTMLElement;

  it('detects text-entry elements', () => {
    expect(isEditableTarget(element('INPUT'))).toBe(true);
    expect(isEditableTarget(element('TEXTAREA'))).toBe(true);
    expect(isEditableTarget(element('SELECT'))).toBe(true);
  });

  it('detects a contenteditable element', () => {
    expect(isEditableTarget(element('DIV', true))).toBe(true);
  });

  it('returns false for non-editable elements', () => {
    expect(isEditableTarget(element('DIV'))).toBe(false);
    expect(isEditableTarget(element('BUTTON'))).toBe(false);
    expect(isEditableTarget(element('A'))).toBe(false);
  });

  it('handles a nullish target', () => {
    expect(isEditableTarget(null)).toBe(false);
  });
});

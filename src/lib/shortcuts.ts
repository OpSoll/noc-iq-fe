/**
 * Central registry of application keyboard shortcuts.
 *
 * Both the shortcuts help modal and the command palette footer need the same
 * list, and a second hand-maintained copy is a second thing to forget to
 * update. Defining them once here means the help dialog cannot drift from
 * what the app actually does.
 *
 * Closes #678 — global keyboard shortcuts helper modal (Shift+?).
 */

export type ShortcutCategory =
  | 'Navigation'
  | 'Outage Table'
  | 'Command Palette'
  | 'Actions';

export interface Shortcut {
  /** Key combination as it should be displayed, e.g. `Shift + ?`. */
  keys: string;
  description: string;
  category: ShortcutCategory;
  /** Canonical lower-case token used for matching, e.g. `shift+?`. */
  id: string;
}

export const SHORTCUTS: readonly Shortcut[] = [
  {
    id: 'shift+?',
    keys: 'Shift + ?',
    description: 'Open this keyboard shortcuts reference',
    category: 'Navigation',
  },
  {
    id: 'mod+k',
    keys: 'Cmd / Ctrl + K',
    description: 'Open the command palette',
    category: 'Command Palette',
  },
  {
    id: 'escape',
    keys: 'Esc',
    description: 'Close the open dialog, drawer, or palette',
    category: 'Navigation',
  },
  {
    id: 'g+d',
    keys: 'G then D',
    description: 'Go to the dashboard',
    category: 'Navigation',
  },
  {
    id: 'g+o',
    keys: 'G then O',
    description: 'Go to the outages table',
    category: 'Navigation',
  },
  {
    id: 'g+p',
    keys: 'G then P',
    description: 'Go to payments',
    category: 'Navigation',
  },
  {
    id: 'g+w',
    keys: 'G then W',
    description: 'Go to webhooks',
    category: 'Navigation',
  },
  {
    id: '/',
    keys: '/',
    description: 'Focus the outage table search filter',
    category: 'Outage Table',
  },
  {
    id: 'j',
    keys: 'J',
    description: 'Move to the next outage row',
    category: 'Outage Table',
  },
  {
    id: 'k',
    keys: 'K',
    description: 'Move to the previous outage row',
    category: 'Outage Table',
  },
  {
    id: 'x',
    keys: 'X',
    description: 'Toggle selection on the focused outage row',
    category: 'Outage Table',
  },
  {
    id: 'mod+enter',
    keys: 'Cmd / Ctrl + Enter',
    description: 'Run the selected bulk outage action',
    category: 'Outage Table',
  },
  {
    id: 'r',
    keys: 'R',
    description: 'Refresh the current view',
    category: 'Actions',
  },
  {
    id: 'shift+n',
    keys: 'Shift + N',
    description: 'Log a new outage',
    category: 'Actions',
  },
] as const;

/** Categories in the order the modal presents them. */
export const SHORTCUT_CATEGORIES: readonly ShortcutCategory[] = [
  'Navigation',
  'Outage Table',
  'Command Palette',
  'Actions',
];

export function getShortcutsByCategory(
  category: ShortcutCategory
): Shortcut[] {
  return SHORTCUTS.filter((shortcut) => shortcut.category === category);
}

/**
 * True when a key event is the `Shift + ?` combination.
 *
 * `?` is `Shift + /` on a US layout, so the event carries `shiftKey` and
 * reports `key === '?'`. Accepting only that exact combination means a bare
 * `/` — which focuses the outage filter — is not swallowed.
 */
export function isShortcutsHelpEvent(event: {
  key: string;
  shiftKey: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
}): boolean {
  return (
    event.key === '?' && event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey
  );
}

/**
 * Whether the event target is a text-entry context, where bare letter
 * shortcuts must not fire.
 *
 * Without this check, typing "j" into the outage search box would jump the
 * table selection instead of inserting the letter.
 */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (!target || typeof target !== 'object') return false;
  const element = target as HTMLElement;
  const tag = element.tagName;
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    element.isContentEditable === true
  );
}

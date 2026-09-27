'use client';

import { useCallback, useEffect, useState } from 'react';

import Modal from '@/components/ui/modal';
import {
  isShortcutsHelpEvent,
  SHORTCUT_CATEGORIES,
  SHORTCUTS,
  getShortcutsByCategory,
} from '@/lib/shortcuts';

/**
 * Reference for every keyboard shortcut, opened with `Shift + ?`.
 *
 * Shortcuts that are implemented but undocumented are the ones nobody uses.
 * The list is rendered from the shared `SHORTCUTS` registry so the dialog
 * cannot describe a shortcut the app does not actually handle.
 *
 * Closes #678 — global keyboard shortcuts helper modal (Shift+?).
 */

export interface ShortcutsModalProps {
  /**
   * Controlled open state. Omit it and the component owns its state, toggling
   * from the global `Shift + ?` shortcut.
   */
  isOpen?: boolean;
  onClose?: () => void;
  /**
   * Called by the global `Shift + ?` listener in controlled mode. A controlled
   * consumer must pass this for the shortcut to be able to *open* the dialog,
   * since the component cannot flip a prop it does not own.
   */
  onToggle?: () => void;
  /** Set false to suppress the global `Shift + ?` listener. */
  enableGlobalShortcut?: boolean;
}

export default function ShortcutsModal({
  isOpen,
  onClose,
  onToggle,
  enableGlobalShortcut = true,
}: ShortcutsModalProps) {
  const isControlled = isOpen !== undefined;
  const [internalOpen, setInternalOpen] = useState(false);
  const open = isControlled ? isOpen : internalOpen;

  const close = useCallback(() => {
    if (!isControlled) setInternalOpen(false);
    onClose?.();
  }, [isControlled, onClose]);

  const toggle = useCallback(() => {
    if (isControlled) {
      // In controlled mode the parent owns the state; `onToggle` is how it
      // learns that the shortcut was pressed.
      (onToggle ?? onClose)?.();
      return;
    }
    setInternalOpen((prev) => !prev);
  }, [isControlled, onToggle, onClose]);

  useEffect(() => {
    if (!enableGlobalShortcut) return;

    function onKeyDown(event: KeyboardEvent) {
      if (!isShortcutsHelpEvent(event)) return;
      event.preventDefault();
      toggle();
    }

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [enableGlobalShortcut, toggle]);

  return (
    <Modal
      isOpen={open}
      onClose={close}
      title="Keyboard shortcuts"
      maxWidth="max-w-2xl"
    >
      <div className="space-y-4">
        <p className="text-sm text-slate-600">
          Press <kbd className="rounded border px-1 font-mono text-xs">Shift</kbd>{' '}
          + <kbd className="rounded border px-1 font-mono text-xs">?</kbd> to
          toggle this dialog from anywhere.
        </p>

        {SHORTCUT_CATEGORIES.map((category) => (
          <section key={category} aria-labelledby={`shortcuts-${category}`}>
            <h3
              id={`shortcuts-${category}`}
              data-testid={`shortcuts-category-${category}`}
              className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500"
            >
              {category}
            </h3>
            <dl className="divide-y divide-slate-100">
              {getShortcutsByCategory(category).map((shortcut) => (
                <div
                  key={shortcut.id}
                  data-testid={`shortcut-${shortcut.id}`}
                  className="flex items-center gap-3 py-1.5"
                >
                  <dt className="w-40 shrink-0">
                    <kbd className="rounded border border-slate-300 bg-slate-50 px-1.5 py-0.5 font-mono text-xs text-slate-800">
                      {shortcut.keys}
                    </kbd>
                  </dt>
                  <dd className="text-sm text-slate-600">
                    {shortcut.description}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}

        <p className="text-xs text-slate-400">
          {SHORTCUTS.length} shortcuts across {SHORTCUT_CATEGORIES.length}{' '}
          categories.
        </p>
      </div>
    </Modal>
  );
}

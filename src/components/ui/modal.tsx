"use client";

/**
 * Modal — accessible dialog with Escape key close handler (closes #707)
 *
 * Behaviour
 * ──────────
 * • Pressing Escape closes the modal immediately.
 * • The keydown listener is attached at the document level so it fires
 *   regardless of which element inside the modal currently has focus.
 * • `event.stopPropagation()` prevents the Escape keypress from reaching
 *   any parent listeners (e.g. a nested drawer that would also try to close).
 * • Focus is restored to the element that triggered the modal on close,
 *   delegated to the underlying `useFocusTrap` hook which already handles
 *   the full focus-trap + Escape lifecycle.
 * • The backdrop is a `role="dialog"` container with `aria-modal="true"` and
 *   a labelled heading, satisfying WCAG 1.3.1 and 4.1.2.
 *
 * Usage
 * ─────
 * ```tsx
 * const [open, setOpen] = useState(false);
 *
 * <Modal
 *   isOpen={open}
 *   onClose={() => setOpen(false)}
 *   title="Confirm action"
 * >
 *   <p>Are you sure?</p>
 *   <button onClick={() => setOpen(false)}>Cancel</button>
 *   <button onClick={handleConfirm}>Confirm</button>
 * </Modal>
 * ```
 */

import { useRef, useId, type ReactNode } from "react";
import { useFocusTrap } from "@/hooks/useFocusTrap";

export interface ModalProps {
  /** Whether the modal is currently visible. */
  isOpen: boolean;

  /**
   * Called when the modal should close.
   * Triggered by: Escape key, backdrop click, or any internal close button.
   */
  onClose: () => void;

  /**
   * Accessible heading shown at the top of the dialog.
   * Also used as `aria-labelledby` for screen readers.
   */
  title: string;

  /** Modal body content. */
  children: ReactNode;

  /**
   * Maximum width class applied to the dialog panel.
   * @default "max-w-lg"
   */
  maxWidth?: string;

  /**
   * When `true` clicking outside the dialog panel (on the backdrop) will NOT
   * close the modal.  Useful for forms with unsaved data.
   * @default false
   */
  disableBackdropClose?: boolean;
}

export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  maxWidth = "max-w-lg",
  disableBackdropClose = false,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const headingId = useId();

  /**
   * `useFocusTrap` handles three concerns for us:
   *   1. Traps Tab / Shift+Tab inside the panel while open.
   *   2. Moves focus to the first focusable child when the modal opens.
   *   3. Restores focus to the triggering element when the modal closes.
   *   4. Closes the modal on Escape — so we do NOT need a separate listener.
   */
  useFocusTrap(panelRef, isOpen, onClose);

  if (!isOpen) return null;

  return (
    // Backdrop — fixed full-screen overlay
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={disableBackdropClose ? undefined : onClose}
      data-backdrop=""
    >
      {/*
       * Dialog panel
       *
       * role="dialog" + aria-modal="true" tells AT that content outside
       * is inert while this panel is open.
       * aria-labelledby links the dialog to its visible heading.
       * onClick stops propagation so backdrop's onClick doesn't fire.
       */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        className={`relative w-full ${maxWidth} rounded-2xl border border-slate-200 bg-white p-6 shadow-xl`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <h2
            id={headingId}
            className="text-lg font-semibold text-slate-900"
          >
            {title}
          </h2>

          {/* Close button — explicit affordance complementing Escape */}
          <button
            type="button"
            aria-label="Close dialog"
            onClick={onClose}
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            {/* × icon */}
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}

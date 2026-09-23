"use client";

/**
 * SkipNav — accessibility skip-to-main-content link (closes #702)
 *
 * Rendered as the first focusable element on every page so that keyboard
 * users can bypass the navigation bar and jump straight to the main content
 * region with a single keypress.
 *
 * Behaviour
 * ──────────
 * • Visually hidden until it receives keyboard focus (standard sr-only →
 *   revealed-on-focus pattern).
 * • On Enter / activation it scrolls to and focuses `#main-content`.
 * • Uses a native `<a href="#main-content">` so that browsers with JS
 *   disabled still follow the anchor.
 *
 * Usage
 * ─────
 * Render <SkipNav /> as the very first child of <body>.
 * Ensure the main content container carries `id="main-content"` and
 * `tabIndex={-1}` so programmatic focus works without a visible ring.
 *
 * @example
 * // In layout.tsx — before <Navigation />
 * <SkipNav />
 * <Navigation />
 * <main id="main-content" tabIndex={-1}>…</main>
 */

import { useCallback } from "react";

export default function SkipNav() {
  /**
   * When the user activates the link we programmatically move focus to
   * `#main-content` so screen readers announce the landmark immediately,
   * rather than relying solely on the browser's default anchor scroll.
   */
  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>) => {
      e.preventDefault();
      const target = document.getElementById("main-content");
      if (!target) return;
      target.setAttribute("tabindex", "-1");
      target.focus({ preventScroll: false });
      // scrollIntoView is available in real browsers but absent in jsdom
      target.scrollIntoView?.({ behavior: "smooth" });
    },
    [],
  );

  return (
    <a
      href="#main-content"
      onClick={handleClick}
      /**
       * Tailwind sr-only → focus:not-sr-only pattern.
       * The element is off-screen until focused, then snaps to the top-left
       * corner of the viewport with full contrast (white on indigo).
       *
       * We use focus-visible so the reveal only triggers on keyboard focus,
       * not on programmatic focus from handleClick itself.
       */
      className={[
        // Hidden by default (same as Tailwind sr-only)
        "absolute",
        "-top-full",
        "left-0",
        "z-[9999]",
        "overflow-hidden",
        "whitespace-nowrap",
        // Revealed on keyboard focus
        "focus-visible:top-0",
        "focus-visible:overflow-visible",
        "focus-visible:whitespace-normal",
        // Visual treatment
        "rounded-br-md",
        "bg-indigo-600",
        "px-4",
        "py-2",
        "text-sm",
        "font-semibold",
        "text-white",
        "outline-none",
        "ring-2",
        "ring-indigo-300",
        "transition-[top]",
      ].join(" ")}
      data-testid="skip-nav"
    >
      Skip to main content
    </a>
  );
}

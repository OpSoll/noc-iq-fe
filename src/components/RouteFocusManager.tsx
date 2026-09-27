'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';

import { getRouteAnnouncement } from '@/lib/breadcrumbs';

/**
 * Moves screen reader focus to the new page's `<h1>` on every route change.
 *
 * Without this, focus stays on the link that was activated, so a screen reader
 * user who navigates to a new page hears nothing about it — the page appears
 * to be empty, and tabbing resumes from wherever they left off. This is WCAG
 * 2.4.3 (Focus Order) and 4.1.2 (Name, Role, Value) territory.
 *
 * Closes #679 — active route focus indicator for screen readers.
 */

/** Fallback heading text when a page has no `<h1>`. */
const DEFAULT_HEADING = 'Page content';

/**
 * Finds the main content heading.
 *
 * Scoped to the main region so a heading inside the nav or a drawer is never
 * focused by mistake.
 */
export function findMainHeading(root: Document | HTMLElement = document): HTMLElement | null {
  const main =
    root.querySelector('main') ??
    root.querySelector('[role="main"]') ??
    root.body;
  if (!main) return null;
  return main.querySelector<HTMLElement>('h1');
}

/**
 * Makes a heading programmatically focusable.
 *
 * `tabIndex={-1}` adds it to the focusable set without inserting it into the
 * natural tab order, so the heading is reachable by script but Tab still moves
 * past it. It is set defensively at focus time because page components are not
 * all guaranteed to have it.
 */
export function ensureFocusableHeading(heading: HTMLElement): void {
  if (!heading.hasAttribute('tabindex')) {
    heading.setAttribute('tabindex', '-1');
  }
}

export interface RouteFocusManagerProps {
  /** Announce the page change in the shared live region. */
  announce?: boolean;
  /** Disables focus movement, for tests and non-router contexts. */
  enabled?: boolean;
}

export default function RouteFocusManager({
  announce = true,
  enabled = true,
}: RouteFocusManagerProps) {
  const pathname = usePathname();
  // Skip the very first render: on initial load the browser has already placed
  // focus sensibly, and yanking it to the heading would be a regression for
  // anyone who arrived here with an intentional focus position.
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (!enabled) return;
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (!pathname) return;

    const heading = findMainHeading();
    if (heading) {
      ensureFocusableHeading(heading);
      // preventScroll keeps the viewport where the user left it; scrolling to
      // the top of every page is disorienting mid-task.
      heading.focus({ preventScroll: true });
    }

    if (announce) {
      const live = document.getElementById('route-announcer');
      if (live) live.textContent = getRouteAnnouncement(pathname);
    }
  }, [pathname, announce, enabled]);

  return null;
}

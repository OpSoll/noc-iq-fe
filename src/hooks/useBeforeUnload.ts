import { useEffect } from 'react';

const DEFAULT_MESSAGE =
  'You have unsaved changes. Are you sure you want to leave?';

/**
 * Warns the user before they lose unsaved form changes, whether they're
 * closing/reloading the tab (`beforeunload`) or navigating to another page
 * within the app (an in-app `<a>`/`<Link>` click, or the browser
 * back/forward buttons).
 *
 * Next.js App Router doesn't expose a `useBlocker`-style navigation guard
 * (unlike React Router), so in-app navigation is intercepted the standard
 * practical way: a capture-phase `click` listener on `document` that finds
 * the nearest internal anchor a click landed on and confirms before
 * letting the click proceed, plus a `popstate` listener that immediately
 * restores the current history entry if the user cancels — the navigation
 * has already happened by the time `popstate` fires, so this "undoes" it
 * rather than truly blocking it.
 *
 * @param shouldBlock - true when there are unsaved changes to guard.
 * @param message - shown in the confirmation dialog for in-app navigation.
 *   Browsers ignore custom `beforeunload` text and show their own generic
 *   wording for tab close/reload, per spec.
 */
export function useBeforeUnload(
  shouldBlock: boolean,
  message: string = DEFAULT_MESSAGE
) {
  useEffect(() => {
    if (!shouldBlock) {
      return;
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };

    const findInternalAnchor = (
      target: EventTarget | null
    ): HTMLAnchorElement | null => {
      if (!(target instanceof Element)) return null;
      const anchor = target.closest('a');
      if (!anchor || !anchor.href) return null;
      if (anchor.target === '_blank' || anchor.hasAttribute('download'))
        return null;

      let url: URL;
      try {
        url = new URL(anchor.href, window.location.href);
      } catch {
        return null;
      }
      if (url.origin !== window.location.origin) return null;
      if (
        url.pathname === window.location.pathname &&
        url.search === window.location.search
      ) {
        return null; // same page (e.g. a hash-only link)
      }
      return anchor;
    };

    const handleClick = (event: MouseEvent) => {
      const anchor = findInternalAnchor(event.target);
      if (!anchor) return;

      if (!window.confirm(message)) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    const handlePopState = () => {
      if (!window.confirm(message)) {
        // The history entry has already changed by the time popstate
        // fires; pushing the previous URL back is the closest we can get
        // to "staying on the page" for the back/forward-button case.
        window.history.pushState(null, '', window.location.href);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('click', handleClick, true);
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('click', handleClick, true);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [shouldBlock, message]);
}

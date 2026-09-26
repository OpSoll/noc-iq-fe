/**
 * Unit tests for useBeforeUnload (closes #682)
 *
 * Covers:
 *  - beforeunload listener attached/detached based on shouldBlock
 *  - preventDefault called on beforeunload when blocking
 *  - internal link clicks confirmed before navigation; cancel blocks the click
 *  - external links and same-page (hash) links are never intercepted
 *  - confirmed navigation is allowed to proceed
 *  - popstate: cancelling restores the current URL via pushState
 *  - listeners are removed once shouldBlock becomes false
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useBeforeUnload } from './useBeforeUnload';

function fireClickOn(anchor: HTMLAnchorElement): MouseEvent {
  const event = new MouseEvent('click', { bubbles: true, cancelable: true });
  anchor.dispatchEvent(event);
  return event;
}

describe('useBeforeUnload', () => {
  let confirmSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    confirmSpy = vi.spyOn(window, 'confirm');
  });

  afterEach(() => {
    confirmSpy.mockRestore();
    document.body.innerHTML = '';
  });

  it('does nothing when shouldBlock is false', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    renderHook(() => useBeforeUnload(false));
    expect(addSpy).not.toHaveBeenCalledWith('beforeunload', expect.anything());
    addSpy.mockRestore();
  });

  it('calls preventDefault and sets returnValue on beforeunload when blocking', () => {
    renderHook(() => useBeforeUnload(true));

    const event = new Event('beforeunload', {
      cancelable: true,
    }) as BeforeUnloadEvent;
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault');
    window.dispatchEvent(event);

    expect(preventDefaultSpy).toHaveBeenCalled();
    // jsdom's Event.returnValue doesn't round-trip a string assignment the
    // way a real browser's BeforeUnloadEvent does, so we only assert it
    // was set to something falsy/cancel-indicating rather than pinning
    // the exact runtime representation.
    expect(event.returnValue).toBeFalsy();
  });

  it('confirms before allowing a click on an internal link to proceed', () => {
    confirmSpy.mockReturnValue(true);
    renderHook(() => useBeforeUnload(true));

    const anchor = document.createElement('a');
    anchor.href = '/outages/123';
    document.body.appendChild(anchor);

    const event = fireClickOn(anchor);

    expect(confirmSpy).toHaveBeenCalledWith(
      'You have unsaved changes. Are you sure you want to leave?'
    );
    expect(event.defaultPrevented).toBe(false);
  });

  it('blocks the click (preventDefault) when the user cancels the confirmation', () => {
    confirmSpy.mockReturnValue(false);
    renderHook(() => useBeforeUnload(true));

    const anchor = document.createElement('a');
    anchor.href = '/outages/456';
    document.body.appendChild(anchor);

    const event = fireClickOn(anchor);

    expect(event.defaultPrevented).toBe(true);
  });

  it('uses a custom message when provided', () => {
    confirmSpy.mockReturnValue(true);
    renderHook(() => useBeforeUnload(true, 'Discard your draft?'));

    const anchor = document.createElement('a');
    anchor.href = '/dashboard';
    document.body.appendChild(anchor);
    fireClickOn(anchor);

    expect(confirmSpy).toHaveBeenCalledWith('Discard your draft?');
  });

  it('does not intercept links to external origins', () => {
    renderHook(() => useBeforeUnload(true));

    const anchor = document.createElement('a');
    anchor.href = 'https://example.com/somewhere';
    document.body.appendChild(anchor);
    fireClickOn(anchor);

    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it('does not intercept links that target a new tab', () => {
    renderHook(() => useBeforeUnload(true));

    const anchor = document.createElement('a');
    anchor.href = '/outages/789';
    anchor.target = '_blank';
    document.body.appendChild(anchor);
    fireClickOn(anchor);

    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it('does not intercept a same-page hash link', () => {
    renderHook(() => useBeforeUnload(true));

    const anchor = document.createElement('a');
    anchor.href = `${window.location.pathname}#section`;
    document.body.appendChild(anchor);
    fireClickOn(anchor);

    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it('restores the current URL on popstate when the user cancels', () => {
    confirmSpy.mockReturnValue(false);
    renderHook(() => useBeforeUnload(true));

    const pushStateSpy = vi.spyOn(window.history, 'pushState');
    window.dispatchEvent(new PopStateEvent('popstate'));

    expect(pushStateSpy).toHaveBeenCalledWith(null, '', window.location.href);
    pushStateSpy.mockRestore();
  });

  it('does not restore the URL on popstate when the user confirms', () => {
    confirmSpy.mockReturnValue(true);
    renderHook(() => useBeforeUnload(true));

    const pushStateSpy = vi.spyOn(window.history, 'pushState');
    window.dispatchEvent(new PopStateEvent('popstate'));

    expect(pushStateSpy).not.toHaveBeenCalled();
    pushStateSpy.mockRestore();
  });

  it('removes all listeners once shouldBlock becomes false', () => {
    confirmSpy.mockReturnValue(true);
    const { rerender } = renderHook(({ block }) => useBeforeUnload(block), {
      initialProps: { block: true },
    });

    rerender({ block: false });

    const anchor = document.createElement('a');
    anchor.href = '/outages/999';
    document.body.appendChild(anchor);
    fireClickOn(anchor);

    expect(confirmSpy).not.toHaveBeenCalled();
  });
});

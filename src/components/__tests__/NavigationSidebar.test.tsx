import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';

import { ToastProvider, useToast } from '@/components/ui/toast';
import Navigation from '@/components/Navigation';
import { SessionProvider } from '@/providers/session';
import { AccessibilityProvider } from '@/providers/accessibility';
import { SIDEBAR_COLLAPSED_KEY } from '@/lib/sidebarPreference';

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
}));

function setViewportWidth(width: number) {
  Object.defineProperty(window, 'innerWidth', {
    writable: true,
    configurable: true,
    value: width,
  });
}

function renderNav() {
  return render(
    <AccessibilityProvider>
      <SessionProvider>
        <ToastProvider>
          <Navigation />
        </ToastProvider>
      </SessionProvider>
    </AccessibilityProvider>
  );
}

beforeEach(() => {
  window.localStorage.clear();
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Navigation sidebar collapse', () => {
  it('renders a collapse toggle', () => {
    setViewportWidth(1440);
    renderNav();

    const toggle = screen.getByTestId('nav-collapse-toggle');
    expect(toggle).toBeInTheDocument();
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(toggle).toHaveAccessibleName('Collapse navigation');
  });

  it('starts expanded on a wide viewport with no stored preference', () => {
    setViewportWidth(1440);
    renderNav();

    expect(screen.getByTestId('primary-navigation-links')).toHaveAttribute(
      'data-collapsed',
      'false'
    );
  });

  it('starts collapsed on a narrow viewport', () => {
    setViewportWidth(800);
    renderNav();

    expect(screen.getByTestId('primary-navigation-links')).toHaveAttribute(
      'data-collapsed',
      'true'
    );
  });

  it('collapses the links and flips the toggle label', async () => {
    const user = userEvent.setup();
    setViewportWidth(1440);
    renderNav();

    await user.click(screen.getByTestId('nav-collapse-toggle'));

    const toggle = screen.getByTestId('nav-collapse-toggle');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(toggle).toHaveAccessibleName('Expand navigation');
    expect(screen.getByTestId('primary-navigation-links')).toHaveAttribute(
      'data-collapsed',
      'true'
    );
  });

  it('persists the collapsed state to local storage', async () => {
    const user = userEvent.setup();
    setViewportWidth(1440);
    renderNav();

    await user.click(screen.getByTestId('nav-collapse-toggle'));

    expect(window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY)).toBe('true');
  });

  it('persists the expanded state too', async () => {
    const user = userEvent.setup();
    setViewportWidth(1440);
    window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, 'true');
    renderNav();

    await user.click(screen.getByTestId('nav-collapse-toggle'));

    expect(window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY)).toBe('false');
  });

  it('restores the collapsed preference on a later visit', () => {
    setViewportWidth(1440);
    window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, 'true');

    renderNav();

    expect(screen.getByTestId('primary-navigation-links')).toHaveAttribute(
      'data-collapsed',
      'true'
    );
  });

  it('restores the expanded preference on a later visit', () => {
    setViewportWidth(800);
    window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, 'false');

    renderNav();

    expect(screen.getByTestId('primary-navigation-links')).toHaveAttribute(
      'data-collapsed',
      'false'
    );
  });

  it('forces collapse when the viewport shrinks below the breakpoint', async () => {
    const user = userEvent.setup();
    setViewportWidth(1440);
    renderNav();
    expect(screen.getByTestId('primary-navigation-links')).toHaveAttribute(
      'data-collapsed',
      'false'
    );

    setViewportWidth(700);
    window.dispatchEvent(new Event('resize'));

    await waitFor(() =>
      expect(screen.getByTestId('primary-navigation-links')).toHaveAttribute(
        'data-collapsed',
        'true'
      )
    );
  });

  it('keeps the navigation links reachable by screen readers when collapsed', () => {
    setViewportWidth(800);
    renderNav();

    // `sr-only` keeps the text in the accessibility tree, so a screen reader
    // user can still reach the links even though they are visually hidden.
    expect(screen.getByRole('link', { name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Outages' })).toBeInTheDocument();
  });

  it('still marks the active link with aria-current', () => {
    setViewportWidth(800);
    renderNav();

    expect(screen.getByText('Dashboard')).toHaveAttribute('aria-current', 'page');
  });

  it('removes the resize listener on unmount', () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    setViewportWidth(1440);
    const { unmount } = renderNav();

    unmount();

    expect(removeSpy).toHaveBeenCalledWith('resize', expect.any(Function));
  });
});

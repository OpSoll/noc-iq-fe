'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { ThemeSwitcher } from '@/components/ThemeSwitcher';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { useSession } from '@/hooks/useSession';
import {
  useAccessibility,
  type AccessibilityMode,
} from '@/providers/accessibility';
import {
  getInitialCollapsedState,
  readCollapsedPreference,
  shouldAutoCollapse,
  writeCollapsedPreference,
} from '@/lib/sidebarPreference';
import { cn } from '@/lib/utils';

// Routes only visible to admin users
const ADMIN_ROUTES = ['/webhooks', '/config'];

const A11Y_MODES: { value: AccessibilityMode; label: string }[] = [
  { value: 'default', label: 'Default' },
  { value: 'high-contrast', label: 'High contrast' },
  { value: 'reduced-motion', label: 'Reduced motion' },
];

const NAV_LINKS = [
  { href: '/', label: 'Dashboard' },
  { href: '/outages', label: 'Outages' },
  { href: '/bulk-import', label: 'Bulk Import' },
  { href: '/payments', label: 'Payments' },
  { href: '/setting', label: 'Settings' },
];

const ADMIN_LINKS = [
  { href: '/config', label: 'SLA Config' },
  { href: '/webhooks', label: 'Webhooks' },
];

const Navigation = () => {
  const { state, user, logout } = useSession();
  const { mode, setMode } = useAccessibility();
  const isAdmin = user?.role === 'admin';
  const pathname = usePathname();

  // A stored preference wins; the viewport only decides on a first visit.
  // (closes #676)
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setCollapsed(getInitialCollapsedState(window.innerWidth, readCollapsedPreference()));
  }, []);

  useEffect(() => {
    const onResize = () => {
      // Below the breakpoint the sidebar is forced collapsed; above it, the
      // operator's own preference takes over again.
      if (shouldAutoCollapse(window.innerWidth)) setCollapsed(true);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      writeCollapsedPreference(!prev);
      return !prev;
    });
  }, []);

  const getLinkClass = (path: string) => {
    const active = pathname === path;
    return cn(
      'inline-flex min-h-11 items-center rounded px-2.5 py-2 hover:underline',
      'focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none',
      active && 'font-bold',
      // Hidden text would still be read by screen readers, so the collapsed
      // label is removed from the DOM rather than merely visually hidden.
      collapsed && 'sr-only'
    );
  };

  return (
    <nav
      style={{ padding: '1rem', borderBottom: '1px solid #ccc' }}
      className="flex items-center justify-between gap-3"
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-expanded={!collapsed}
          aria-controls="primary-navigation-links"
          aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
          data-testid="nav-collapse-toggle"
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded text-slate-600 hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none"
        >
          <svg
            className={cn(
              'h-5 w-5 transition-transform duration-200 motion-reduce:transition-none',
              collapsed && 'rotate-180'
            )}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M11 19l-7-7 7-7M20 18v-2a4 4 0 00-4-4H8"
            />
          </svg>
        </button>

        <div
          id="primary-navigation-links"
          data-testid="primary-navigation-links"
          data-collapsed={collapsed ? 'true' : 'false'}
          // Smooth expand/collapse; motion-reduce drops the transition.
          className={cn(
            'flex flex-wrap gap-3 text-sm transition-all duration-200 ease-in-out motion-reduce:transition-none',
            collapsed && 'max-w-0 gap-0 overflow-hidden opacity-0'
          )}
        >
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={getLinkClass(link.href)}
              aria-current={pathname === link.href ? 'page' : undefined}
            >
              {link.label}
            </Link>
          ))}
          {isAdmin &&
            ADMIN_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={getLinkClass(link.href)}
                aria-current={pathname === link.href ? 'page' : undefined}
              >
                {link.label}
              </Link>
            ))}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2 text-sm text-slate-600">
        <NotificationBell />
        <ThemeSwitcher />
        <select
          value={mode}
          onChange={(e) => setMode(e.target.value as AccessibilityMode)}
          className="min-h-11 rounded border border-slate-200 bg-white px-2.5 py-2 text-sm text-slate-700 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none"
          aria-label="Accessibility mode"
        >
          {A11Y_MODES.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>

        {state === 'loading' && (
          <span className="text-slate-400">Checking session…</span>
        )}
        {state === 'authenticated' && user && (
          <span className="flex items-center gap-3">
            <span>{user.email}</span>
            {isAdmin && (
              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-500">
                admin
              </span>
            )}
            <button
              onClick={() => void logout()}
              className="min-h-11 rounded border border-slate-200 px-2.5 py-2 text-sm hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none"
            >
              Sign out
            </button>
          </span>
        )}
        {state === 'unauthenticated' && (
          <Link
            href="/login"
            className="inline-flex min-h-11 items-center rounded border border-slate-200 px-2.5 py-2 text-sm hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none"
          >
            Sign in
          </Link>
        )}
      </div>
    </nav>
  );
};

export default Navigation;

// Export admin route list so RouteGuard can use it
export { ADMIN_ROUTES };

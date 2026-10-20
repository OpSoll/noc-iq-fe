import { render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import RouteFocusManager from '@/components/RouteFocusManager';
import { APP_NAME } from '@/lib/routeTitle';

/**
 * #981 — the router-level title wiring: `RouteFocusManager` keeps
 * `document.title` in step with `usePathname` so every route (including
 * client-component routes, which cannot export `metadata`) gets a distinct
 * browser title.
 */

const pathnameRef = { current: '/outages' };

vi.mock('next/navigation', () => ({
  usePathname: () => pathnameRef.current,
}));

beforeEach(() => {
  pathnameRef.current = '/outages';
  document.title = '';
});

afterEach(() => {
  document.body.innerHTML = '';
});

describe('RouteFocusManager document title (#981)', () => {
  it('sets a descriptive title on first render', () => {
    render(<RouteFocusManager />);
    expect(document.title).toBe(`Outages · ${APP_NAME}`);
  });

  it('includes the entity id for detail routes', () => {
    pathnameRef.current = '/outages/abc-123';
    render(<RouteFocusManager />);
    expect(document.title).toBe(`Incident #abc-123 · ${APP_NAME}`);
  });

  it('falls back to the app name on the root route', () => {
    pathnameRef.current = '/';
    render(<RouteFocusManager />);
    expect(document.title).toBe(APP_NAME);
  });

  it('does not set a title when disabled', () => {
    render(<RouteFocusManager enabled={false} />);
    expect(document.title).toBe('');
  });
});

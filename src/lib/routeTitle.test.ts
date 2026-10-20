import { describe, expect, it } from 'vitest';
import { APP_NAME, HOME_TITLE, getRouteTitle } from './routeTitle';

/**
 * #981 — descriptive document titles per route.
 */
describe('getRouteTitle (#981)', () => {
  it('returns the bare app name for the root route', () => {
    expect(getRouteTitle('/')).toBe(HOME_TITLE);
    expect(HOME_TITLE).toBe(APP_NAME);
  });

  it('falls back to the app name for empty/nullish pathnames', () => {
    expect(getRouteTitle('')).toBe(HOME_TITLE);
    expect(getRouteTitle(null)).toBe(HOME_TITLE);
    expect(getRouteTitle(undefined)).toBe(HOME_TITLE);
  });

  it('includes the app name in every title', () => {
    for (const path of ['/outages', '/payments', '/config', '/webhooks']) {
      expect(getRouteTitle(path)).toContain(APP_NAME);
    }
  });

  it('gives each static route a unique title', () => {
    const routes = [
      '/',
      '/outages',
      '/outages/new',
      '/payments',
      '/bulk-import',
      '/bulk-import/history',
      '/config',
      '/webhooks',
      '/setting',
      '/login',
      '/register',
      '/admin/error-budget',
      '/admin/wave5',
    ];
    const titles = routes.map(getRouteTitle);
    expect(new Set(titles).size).toBe(routes.length);
  });

  it('names known routes rather than humanising the segment', () => {
    expect(getRouteTitle('/outages')).toBe(`Outages · ${APP_NAME}`);
    expect(getRouteTitle('/config')).toBe(`SLA Config · ${APP_NAME}`);
    expect(getRouteTitle('/setting')).toBe(`Settings · ${APP_NAME}`);
    expect(getRouteTitle('/bulk-import/history')).toBe(
      `Import History · ${APP_NAME}`
    );
  });

  it('includes the entity id on detail routes', () => {
    expect(getRouteTitle('/outages/abc-123')).toBe(`Incident #abc-123 · ${APP_NAME}`);
    expect(getRouteTitle('/payments/p-42')).toBe(`Payment #p-42 · ${APP_NAME}`);
  });

  it('ignores query strings and hashes', () => {
    expect(getRouteTitle('/outages?status=open')).toBe(`Outages · ${APP_NAME}`);
    expect(getRouteTitle('/outages/123#timeline')).toBe(
      `Incident #123 · ${APP_NAME}`
    );
  });

  it('ignores a trailing slash', () => {
    expect(getRouteTitle('/payments/')).toBe(`Payments · ${APP_NAME}`);
  });

  it('humanises unknown routes as a graceful fallback', () => {
    expect(getRouteTitle('/some/new-page')).toBe(`Some / New Page · ${APP_NAME}`);
  });
});

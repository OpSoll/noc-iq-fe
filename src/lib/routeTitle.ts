/**
 * Per-route document titles (#981).
 *
 * Every route shipped the same browser title (`NOCIQ`), so history entries,
 * tabs and bookmarks were indistinguishable. `getRouteTitle` derives a
 * descriptive title from the pathname, reusing the same route table as the
 * breadcrumb bar so the page title and the breadcrumb never drift apart.
 *
 * Titles always end with the app name (`… · NOCIQ`), and detail routes include
 * the entity id (`Incident #123 · NOCIQ`).
 */

/** Brand suffix appended to every page title. */
export const APP_NAME = 'NOCIQ';

/** Title shown on the root route. */
export const HOME_TITLE = APP_NAME;

/** Route segments whose child is an identifier (see also `PARAM_SEGMENTS`). */
const DETAIL_PARENT_LABELS: Record<string, (id: string) => string> = {
  outages: (id) => `Incident #${id}`,
  payments: (id) => `Payment #${id}`,
  incidents: (id) => `Incident #${id}`,
  disputes: (id) => `Dispute #${id}`,
};

/** Static page names, keyed by pathname. */
const ROUTE_TITLES: Record<string, string> = {
  '/': '',
  '/outages': 'Outages',
  '/outages/new': 'Log Outage',
  '/payments': 'Payments',
  '/bulk-import': 'Bulk Import',
  '/bulk-import/history': 'Import History',
  '/config': 'SLA Config',
  '/webhooks': 'Webhooks',
  '/setting': 'Settings',
  '/login': 'Sign In',
  '/register': 'Register',
  '/admin/error-budget': 'Error Budget',
  '/admin/wave5': 'Wave 5',
  '/logic': 'Access Logic',
};

/** Best-effort title for an unknown segment, e.g. `dry-run` -> `Dry Run`. */
function humanize(segment: string): string {
  return segment
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Builds the document title for a pathname. Query strings and hashes are
 * ignored, and a missing/invalid pathname falls back to the bare app name.
 */
export function getRouteTitle(pathname: string | null | undefined): string {
  const path = (pathname ?? '/').split('?')[0].split('#')[0].replace(/\/+$/, '') || '/';

  if (path === '/') return HOME_TITLE;

  // Exact match first (covers nested static routes like /bulk-import/history).
  if (ROUTE_TITLES[path] !== undefined && ROUTE_TITLES[path] !== '') {
    return `${ROUTE_TITLES[path]} · ${APP_NAME}`;
  }

  const segments = path.split('/').filter(Boolean);

  // Detail route: /outages/<id> or /payments/<id>.
  if (segments.length === 2 && DETAIL_PARENT_LABELS[segments[0]]) {
    const label = DETAIL_PARENT_LABELS[segments[0]](segments[1]);
    return `${label} · ${APP_NAME}`;
  }

  const fallback = segments.map(humanize).join(' / ');
  return fallback ? `${fallback} · ${APP_NAME}` : HOME_TITLE;
}

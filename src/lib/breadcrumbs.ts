/**
 * Route parsing for the breadcrumb bar.
 *
 * The naive approach — splitting the pathname and title-casing each segment —
 * produces `Home / Outages / Incident / 123`, which is not what anyone calls
 * the thing they are looking at. A route table maps segments to real labels and
 * recognises the patterns that take parameters, so an incident renders as
 * `Home / Outages / Incident #123`.
 *
 * Closes #677 — breadcrumb navigation bar with dynamic route labels.
 */

export interface Crumb {
  /** Path to link to. The final crumb is the current page. */
  href: string;
  /** Human label for this segment. */
  label: string;
  /** True for the last crumb, which represents the current page. */
  isCurrent: boolean;
}

/** Static label overrides, keyed by the first path segment. */
const SEGMENT_LABELS: Record<string, string> = {
  '': 'Home',
  outages: 'Outages',
  payments: 'Payments',
  'bulk-import': 'Bulk Import',
  'bulk-import-history': 'Import History',
  config: 'SLA Config',
  webhooks: 'Webhooks',
  setting: 'Settings',
  admin: 'Admin',
  login: 'Sign In',
  register: 'Register',
  'error-budget': 'Error Budget',
  wave5: 'Wave 5',
  history: 'History',
};

/** Route segments that are identifiers rather than pages, with a template. */
const PARAM_SEGMENTS: Record<string, (value: string) => string> = {
  // An outage id is referred to as an incident number, not an opaque string.
  outage: (value) => `Incident #${value}`,
  incident: (value) => `Incident #${value}`,
  dispute: (value) => `Dispute #${value}`,
  payment: (value) => `Payment #${value}`,
  timeline: () => 'Timeline',
  deliverables: () => 'Deliverables',
  evidence: () => 'Evidence',
  disputes: () => 'Disputes',
  site: (value) => `Site ${value}`,
};

/** Humanises a segment that has no override, e.g. `dry-run` -> `Dry Run`. */
export function humanizeSegment(segment: string): string {
  return segment
    .replace(/[-_]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Longest incident/dispute identifier shown before truncation. */
export const MAX_CRUMB_LABEL_LENGTH = 28;

/** Truncates a long label in the middle, keeping both ends readable. */
export function truncateCrumbLabel(
  label: string,
  maxLength: number = MAX_CRUMB_LABEL_LENGTH
): string {
  if (label.length <= maxLength) return label;
  const keep = maxLength - 1;
  const head = Math.ceil(keep / 2);
  const tail = Math.floor(keep / 2);
  return `${label.slice(0, head)}…${label.slice(label.length - tail)}`;
}

/**
 * Builds the breadcrumb trail for a pathname.
 *
 * `Incident #123` is truncated to `Incident #12…23` at 28 characters, which
 * only bites on unusually long identifiers, but those exist in real outage
 * data and a wrapping breadcrumb pushes the trail onto two lines.
 */
export function buildCrumbs(pathname: string): Crumb[] {
  const path = (pathname ?? '').split('?')[0].split('#')[0];
  const segments = path.split('/').filter(Boolean);

  const crumbs: Crumb[] = [
    { href: '/', label: SEGMENT_LABELS[''], isCurrent: false },
  ];

  let currentPath = '';
  segments.forEach((segment, index) => {
    currentPath += `/${segment}`;
    const isLast = index === segments.length - 1;

    let label: string;
    if (index === 0 && SEGMENT_LABELS[segment]) {
      label = SEGMENT_LABELS[segment];
    } else if (PARAM_SEGMENTS[segment]) {
      // `outages` is a known page; a bare `incident` is a parameter name.
      label = PARAM_SEGMENTS[segment](segments[index + 1] ?? '');
      // A parameter segment consumes the following value, so skip past it.
      if (segments[index + 1] !== undefined) {
        currentPath += `/${segments[index + 1]}`;
        // The consumed value is the final crumb, not an intermediate one.
        crumbs.push({
          href: currentPath,
          label: truncateCrumbLabel(label),
          isCurrent: segments[index + 1] === segments[segments.length - 1],
        });
        return;
      }
    } else {
      label = humanizeSegment(segment);
    }

    crumbs.push({
      href: currentPath,
      label: truncateCrumbLabel(label),
      isCurrent: isLast,
    });
  });

  // Exactly one crumb is the current page: the last one.
  if (crumbs.length > 1) {
    for (const crumb of crumbs) crumb.isCurrent = false;
    crumbs[crumbs.length - 1].isCurrent = true;
  }
  // On the home route the only crumb is the current page.
  if (crumbs.length === 1) crumbs[0].isCurrent = true;

  return crumbs;
}

/** Page title announced to screen readers on a route change. */
export function getRouteAnnouncement(pathname: string): string {
  const crumbs = buildCrumbs(pathname);
  return crumbs.map((crumb) => crumb.label).join(', ');
}

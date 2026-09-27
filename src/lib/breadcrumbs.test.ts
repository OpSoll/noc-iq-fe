import { describe, it, expect } from 'vitest';

import {
  buildCrumbs,
  getRouteAnnouncement,
  humanizeSegment,
  MAX_CRUMB_LABEL_LENGTH,
  truncateCrumbLabel,
} from '@/lib/breadcrumbs';

const labels = (pathname: string) =>
  buildCrumbs(pathname).map((crumb) => crumb.label);
const hrefs = (pathname: string) =>
  buildCrumbs(pathname).map((crumb) => crumb.href);

describe('humanizeSegment', () => {
  it('title-cases a hyphenated segment', () => {
    expect(humanizeSegment('dry-run')).toBe('Dry Run');
  });

  it('splits camelCase', () => {
    expect(humanizeSegment('dryRun')).toBe('Dry Run');
  });

  it('handles underscores and mixed case', () => {
    expect(humanizeSegment('some_new_thing')).toBe('Some New Thing');
  });
});

describe('truncateCrumbLabel', () => {
  it('leaves a short label intact', () => {
    expect(truncateCrumbLabel('Incident #123')).toBe('Incident #123');
  });

  it('truncates a long label in the middle', () => {
    const truncated = truncateCrumbLabel('x'.repeat(60));
    expect(truncated).toHaveLength(MAX_CRUMB_LABEL_LENGTH);
    expect(truncated).toContain('…');
  });

  it('respects a custom maximum', () => {
    expect(truncateCrumbLabel('abcdefghij', 5)).toHaveLength(5);
  });
});

describe('buildCrumbs', () => {
  it('returns a single Home crumb for the root route', () => {
    expect(labels('/')).toEqual(['Home']);
    expect(hrefs('/')).toEqual(['/']);
  });

  it('builds Home / Outages for a top-level page', () => {
    expect(labels('/outages')).toEqual(['Home', 'Outages']);
    expect(hrefs('/outages')).toEqual(['/', '/outages']);
  });

  it('uses a friendly label rather than the raw segment', () => {
    expect(labels('/bulk-import')).toEqual(['Home', 'Bulk Import']);
  });

  it('handles a three-level route', () => {
    expect(labels('/bulk-import/history')).toEqual([
      'Home',
      'Bulk Import',
      'History',
    ]);
  });

  it('strips a query string and hash', () => {
    expect(labels('/outages?site=LHR-04')).toEqual(['Home', 'Outages']);
    expect(labels('/outages#section')).toEqual(['Home', 'Outages']);
  });

  it('handles a trailing slash', () => {
    expect(labels('/outages/')).toEqual(['Home', 'Outages']);
  });

  it('humanises an unrecognised segment', () => {
    expect(labels('/outages/some-new-thing')).toEqual([
      'Home',
      'Outages',
      'Some New Thing',
    ]);
  });

  it('treats a trailing identifier as a real page, not a parameter', () => {
    // A bare trailing segment has no value after it, so it is not a parameter.
    expect(labels('/outages/incident-9')).toEqual(['Home', 'Outages', 'Incident-9']);
  });

  it('renders a parameter pattern rather than the literal name', () => {
    const crumbs = buildCrumbs('/outages/incident/timeline');
    expect(crumbs.map((c) => c.label)).toEqual([
      'Home',
      'Outages',
      'Timeline',
    ]);
    expect(hrefs('/outages/incident/timeline')).toEqual([
      '/',
      '/outages',
      '/outages/incident',
      '/outages/incident/timeline',
    ]);
  });

  it('marks exactly one crumb as the current page', () => {
    const crumbs = buildCrumbs('/outages/incident/timeline');
    expect(crumbs.filter((c) => c.isCurrent)).toHaveLength(1);
    expect(crumbs[crumbs.length - 1].isCurrent).toBe(true);
  });

  it('marks Home as current on the root route', () => {
    const crumbs = buildCrumbs('/');
    expect(crumbs).toHaveLength(1);
    expect(crumbs[0].isCurrent).toBe(true);
  });

  it('truncates a very long identifier', () => {
    const crumbs = buildCrumbs(`/outages/incident/${'z'.repeat(60)}`);
    expect(crumbs[crumbs.length - 1].label.length).toBeLessThanOrEqual(
      MAX_CRUMB_LABEL_LENGTH
    );
  });

  it('handles an empty pathname', () => {
    expect(labels('')).toEqual(['Home']);
  });
});

describe('getRouteAnnouncement', () => {
  it('joins the labels for a screen reader announcement', () => {
    expect(getRouteAnnouncement('/outages')).toBe('Home, Outages');
  });

  it('describes a nested route', () => {
    expect(getRouteAnnouncement('/bulk-import/history')).toBe(
      'Home, Bulk Import, History'
    );
  });
});

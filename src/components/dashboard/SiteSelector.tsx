'use client';

/**
 * SiteSelector — filters every dashboard metric by site (closes #602).
 *
 * Controlled component: the owning view holds the selection in the query
 * string through `useUrlSync`, so a filtered dashboard is a shareable URL and
 * "All Sites" is simply the empty value, which removes the parameter and
 * restores the global summary.
 *
 * Options can carry a region, in which case they are rendered in grouped
 * `<optgroup>`s. The outage schema has no region field today, so the wiring
 * derives flat options — grouping switches on by itself once the data supplies
 * one.
 */

import { useMemo } from 'react';

import type { Outage } from '@/types/outages';

/** Value representing "no site filter", i.e. the global summary view. */
export const ALL_SITES_VALUE = '';

export interface SiteOption {
  /** Identifier written to the URL parameter. */
  id: string;
  /** Human-readable label. */
  label: string;
  /** Optional grouping key; options are grouped when any option has one. */
  region?: string;
}

export interface SiteOptionGroup {
  /** Null for options that carry no region. */
  region: string | null;
  options: SiteOption[];
}

export interface SiteSelectorProps {
  options: SiteOption[];
  /** Currently selected site id, or {@link ALL_SITES_VALUE}. */
  value: string;
  onChange: (siteId: string) => void;
  /** Renders a disabled placeholder while the site list is still loading. */
  loading?: boolean;
  className?: string;
}

/**
 * Derives the selectable sites from outage records.
 *
 * `site_id` is preferred as the URL value because it is the stable key the
 * import format and the analytics filters use; `site_name` is the fallback for
 * records that only carry a name. Entries with neither are skipped, and the
 * result is sorted by label so the menu order does not shuffle between
 * refetches.
 */
export function deriveSiteOptions(outages: Outage[]): SiteOption[] {
  const byId = new Map<string, SiteOption>();

  for (const outage of outages) {
    const id = outage.site_id?.trim() || outage.site_name?.trim();
    if (!id) continue;
    const label = outage.site_name?.trim() || id;
    if (!byId.has(id)) byId.set(id, { id, label });
  }

  return [...byId.values()].sort((a, b) => a.label.localeCompare(b.label));
}

/** Splits options into region groups, preserving label order within each. */
export function groupSitesByRegion(options: SiteOption[]): SiteOptionGroup[] {
  const ungrouped: SiteOption[] = [];
  const regions = new Map<string, SiteOption[]>();

  for (const option of options) {
    const region = option.region?.trim();
    if (!region) {
      ungrouped.push(option);
      continue;
    }
    const bucket = regions.get(region);
    if (bucket) bucket.push(option);
    else regions.set(region, [option]);
  }

  const grouped: SiteOptionGroup[] = [...regions.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([region, regionOptions]) => ({ region, options: regionOptions }));

  if (ungrouped.length > 0) {
    grouped.push({ region: null, options: ungrouped });
  }

  return grouped;
}

export default function SiteSelector({
  options,
  value,
  onChange,
  loading = false,
  className,
}: SiteSelectorProps) {
  const groups = useMemo(() => groupSitesByRegion(options), [options]);
  const isGrouped = groups.some((group) => group.region !== null);

  return (
    <label className={`flex flex-col gap-1 text-xs ${className ?? ''}`}>
      <span className="font-medium text-slate-600">Site</span>
      <select
        aria-label="Site filter"
        value={value}
        disabled={loading}
        onChange={(event) => onChange(event.target.value)}
        className="rounded border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-wait disabled:opacity-60"
        data-testid="site-selector"
      >
        <option value={ALL_SITES_VALUE}>
          {loading ? 'Loading sites…' : 'All Sites'}
        </option>

        {isGrouped
          ? groups.map((group) => (
              <optgroup
                key={group.region ?? '__ungrouped__'}
                label={group.region ?? 'Other'}
              >
                {group.options.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </optgroup>
            ))
          : options.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
      </select>
    </label>
  );
}

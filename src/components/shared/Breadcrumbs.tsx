'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { buildCrumbs } from '@/lib/breadcrumbs';
import { cn } from '@/lib/utils';

/**
 * Dynamic breadcrumb bar for the top of the content area.
 *
 * Deeply nested views lose their context without one — an operator reading
 * `Incident #123` has no indication they are under Outages, or that the
 * timeline beneath it is part of the same incident.
 *
 * Closes #677 — breadcrumb navigation bar with dynamic route labels.
 */

export interface BreadcrumbsProps {
  /** Overrides the route, for tests and non-router contexts. */
  pathname?: string;
  className?: string;
}

export default function Breadcrumbs({ pathname, className }: BreadcrumbsProps) {
  const routePath = usePathname();
  const path = pathname ?? routePath;
  const crumbs = buildCrumbs(path);

  // A single crumb carries no hierarchy, so rendering it would be noise.
  if (crumbs.length <= 1) return null;

  return (
    <nav
      aria-label="Breadcrumb"
      data-testid="breadcrumbs"
      className={cn('px-1 py-2 text-sm text-slate-500', className)}
    >
      <ol className="flex flex-wrap items-center gap-1">
        {crumbs.map((crumb, index) => {
          const isLast = index === crumbs.length - 1;
          return (
            <li key={crumb.href} className="flex items-center gap-1">
              {isLast ? (
                <span
                  aria-current="page"
                  className="font-medium text-slate-800"
                  title={crumb.label}
                >
                  {crumb.label}
                </span>
              ) : (
                <>
                  <Link
                    href={crumb.href}
                    className="rounded hover:text-slate-800 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                  >
                    {crumb.label}
                  </Link>
                  <span aria-hidden="true" className="text-slate-300">
                    /
                  </span>
                </>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

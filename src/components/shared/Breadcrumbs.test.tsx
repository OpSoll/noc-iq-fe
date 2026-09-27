import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';

import Breadcrumbs from '@/components/shared/Breadcrumbs';

vi.mock('next/navigation', () => ({
  usePathname: () => '/outages/incident/timeline',
}));

const HREFS: Array<string | null> = [];
vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
  } & React.HTMLAttributes<HTMLAnchorElement>) => {
    HREFS.push(href);
    return (
      <a href={href} {...rest}>
        {children}
      </a>
    );
  },
}));

describe('Breadcrumbs', () => {
  beforeEach(() => {
    HREFS.length = 0;
  });

  it('renders nothing on a single-crumb route', () => {
    render(<Breadcrumbs pathname="/" />);
    expect(screen.queryByTestId('breadcrumbs')).not.toBeInTheDocument();
  });

  it('renders a labelled breadcrumb navigation', () => {
    render(<Breadcrumbs pathname="/outages" />);

    const nav = screen.getByTestId('breadcrumbs');
    expect(nav.tagName.toLowerCase()).toBe('nav');
    expect(nav).toHaveAccessibleName('Breadcrumb');
  });

  it('shows the page hierarchy', () => {
    render(<Breadcrumbs pathname="/outages/incident/timeline" />);

    expect(screen.getByRole('link', { name: 'Home' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Outages' })).toBeInTheDocument();
    expect(screen.getByText('Timeline')).toBeInTheDocument();
  });

  it('links each segment to its parent route', () => {
    render(<Breadcrumbs pathname="/outages/incident/timeline" />);

    expect(HREFS).toEqual(['/', '/outages', '/outages/incident']);
  });

  it('marks only the final crumb as the current page', () => {
    render(<Breadcrumbs pathname="/outages/incident/timeline" />);

    const current = screen.getAllByText(/Home|Outages|Timeline/).filter(
      (el) => el.getAttribute('aria-current') === 'page'
    );
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveTextContent('Timeline');
  });

  it('does not link the current page', () => {
    render(<Breadcrumbs pathname="/outages" />);
    expect(screen.queryByRole('link', { name: 'Outages' })).not.toBeInTheDocument();
  });

  it('uses friendly labels rather than raw segments', () => {
    render(<Breadcrumbs pathname="/bulk-import/history" />);

    expect(screen.getByRole('link', { name: 'Bulk Import' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'History' })).toBeInTheDocument();
  });

  it('truncates a long incident name gracefully', () => {
    render(<Breadcrumbs pathname={`/outages/${'z'.repeat(80)}`} />);

    const current = document.querySelector('[aria-current="page"]');
    expect(current?.textContent).toContain('…');
    expect((current?.textContent ?? '').length).toBeLessThan(40);
  });

  it('exposes the truncated label as a title for hover', () => {
    render(<Breadcrumbs pathname={`/outages/${'z'.repeat(80)}`} />);

    const current = document.querySelector('[aria-current="page"]');
    expect(current?.getAttribute('title')).toBe(current?.textContent);
  });

  it('separates segments with decorative slashes', () => {
    render(<Breadcrumbs pathname="/outages" />);
    expect(screen.getByText('/')).toHaveAttribute('aria-hidden', 'true');
  });

  it('renders an ordered list', () => {
    render(<Breadcrumbs pathname="/bulk-import/history" />);

    expect(screen.getAllByRole('listitem')).toHaveLength(3);
  });
});

/**
 * Unit tests for the dashboard site filter (closes #602).
 *
 * The last suite wires the selector to `useUrlSync` the way the dashboard does,
 * so "the URL parameter is updated and All Sites removes it again" is asserted
 * against a real query string rather than a mocked setter.
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockSearchParamsGet = vi.fn();
const mockSearchParamsToString = vi.fn();

vi.mock('next/navigation', () => ({
  useSearchParams: () => ({
    get: mockSearchParamsGet,
    toString: mockSearchParamsToString,
  }),
}));

import SiteSelector, {
  ALL_SITES_VALUE,
  deriveSiteOptions,
  groupSitesByRegion,
  type SiteOption,
} from '@/components/dashboard/SiteSelector';
import { useUrlSync } from '@/hooks/useUrlSync';
import type { Outage } from '@/types/outages';

function makeOutage(overrides: Partial<Outage> = {}): Outage {
  return {
    id: overrides.id ?? 'o1',
    site_name: overrides.site_name ?? 'Site A',
    site_id: overrides.site_id,
    severity: 'high',
    status: 'resolved',
    detected_at: '2026-09-01T00:00:00Z',
    description: 'test',
    affected_services: [],
    ...overrides,
  };
}

const OPTIONS: SiteOption[] = [
  { id: 'site-a', label: 'Alpha' },
  { id: 'site-b', label: 'Bravo' },
];

describe('deriveSiteOptions', () => {
  it('prefers site_id as the value and site_name as the label', () => {
    expect(
      deriveSiteOptions([
        makeOutage({ site_id: 'site-nyc-01', site_name: 'NYC DC' }),
      ])
    ).toStrictEqual([{ id: 'site-nyc-01', label: 'NYC DC' }]);
  });

  it('falls back to site_name when no site_id is present', () => {
    expect(
      deriveSiteOptions([makeOutage({ site_name: 'Legacy Site' })])
    ).toStrictEqual([{ id: 'Legacy Site', label: 'Legacy Site' }]);
  });

  it('de-duplicates sites across outages', () => {
    const options = deriveSiteOptions([
      makeOutage({ id: '1', site_id: 'site-a', site_name: 'Alpha' }),
      makeOutage({ id: '2', site_id: 'site-a', site_name: 'Alpha' }),
    ]);

    expect(options).toHaveLength(1);
  });

  it('sorts options by label so the menu order is stable', () => {
    const options = deriveSiteOptions([
      makeOutage({ id: '1', site_id: 'z', site_name: 'Zulu' }),
      makeOutage({ id: '2', site_id: 'a', site_name: 'Alpha' }),
    ]);

    expect(options.map((o) => o.label)).toStrictEqual(['Alpha', 'Zulu']);
  });

  it('skips records with neither a site id nor a name', () => {
    const options = deriveSiteOptions([
      makeOutage({ id: '1', site_id: undefined, site_name: '' }),
      makeOutage({ id: '2', site_id: 'site-a', site_name: 'Alpha' }),
    ]);

    expect(options).toHaveLength(1);
  });
});

describe('groupSitesByRegion', () => {
  it('groups options by region, sorted, with ungrouped options last', () => {
    const groups = groupSitesByRegion([
      { id: '3', label: 'Ungrouped' },
      { id: '1', label: 'Oslo', region: 'EMEA' },
      { id: '2', label: 'Denver', region: 'AMER' },
    ]);

    expect(groups.map((g) => g.region)).toStrictEqual(['AMER', 'EMEA', null]);
    expect(groups[2].options.map((o) => o.label)).toStrictEqual(['Ungrouped']);
  });

  it('returns a single ungrouped bucket when nothing has a region', () => {
    const groups = groupSitesByRegion(OPTIONS);

    expect(groups).toHaveLength(1);
    expect(groups[0].region).toBeNull();
  });
});

describe('SiteSelector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParamsGet.mockReturnValue(null);
    mockSearchParamsToString.mockReturnValue('');
  });

  it('offers All Sites first, then every site', () => {
    render(
      <SiteSelector
        options={OPTIONS}
        value={ALL_SITES_VALUE}
        onChange={vi.fn()}
      />
    );

    const select = screen.getByLabelText('Site filter');
    expect(
      Array.from(select.querySelectorAll('option')).map((o) => o.textContent)
    ).toStrictEqual(['All Sites', 'Alpha', 'Bravo']);
  });

  it('reflects the controlled selection', () => {
    render(
      <SiteSelector options={OPTIONS} value="site-b" onChange={vi.fn()} />
    );

    expect(screen.getByLabelText('Site filter')).toHaveValue('site-b');
  });

  it('reports the selected site id', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <SiteSelector
        options={OPTIONS}
        value={ALL_SITES_VALUE}
        onChange={onChange}
      />
    );

    await user.selectOptions(screen.getByLabelText('Site filter'), 'site-b');

    expect(onChange).toHaveBeenCalledWith('site-b');
  });

  it('resets to the global summary when All Sites is selected', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <SiteSelector options={OPTIONS} value="site-a" onChange={onChange} />
    );

    await user.selectOptions(
      screen.getByLabelText('Site filter'),
      ALL_SITES_VALUE
    );

    expect(onChange).toHaveBeenCalledWith(ALL_SITES_VALUE);
  });

  it('groups options when a region is supplied', () => {
    render(
      <SiteSelector
        options={[
          { id: '1', label: 'Oslo', region: 'EMEA' },
          { id: '2', label: 'Denver', region: 'AMER' },
        ]}
        value={ALL_SITES_VALUE}
        onChange={vi.fn()}
      />
    );

    const labels = Array.from(
      screen.getByLabelText('Site filter').querySelectorAll('optgroup')
    ).map((group) => group.getAttribute('label'));

    expect(labels).toStrictEqual(['AMER', 'EMEA']);
  });

  it('disables the control while the site list is loading', () => {
    render(
      <SiteSelector
        options={[]}
        value={ALL_SITES_VALUE}
        onChange={vi.fn()}
        loading
      />
    );

    const select = screen.getByLabelText('Site filter');
    expect(select).toBeDisabled();
    expect(select).toHaveTextContent('Loading sites…');
  });
});

describe('SiteSelector URL synchronisation', () => {
  const DASHBOARD_DEFAULTS = { site: '', severity: '' };

  function DashboardSiteFilter() {
    const [urlState, setUrlState] = useUrlSync(DASHBOARD_DEFAULTS);
    return (
      <SiteSelector
        options={OPTIONS}
        value={urlState.site}
        onChange={(site) => setUrlState({ site })}
      />
    );
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParamsGet.mockReturnValue(null);
    mockSearchParamsToString.mockReturnValue('');
    window.history.replaceState(null, '', '/');
  });

  it('writes the selected site id into the query string for shareable links', async () => {
    const user = userEvent.setup();
    render(<DashboardSiteFilter />);

    await user.selectOptions(screen.getByLabelText('Site filter'), 'site-a');

    expect(new URLSearchParams(window.location.search).get('site')).toBe(
      'site-a'
    );
  });

  it('removes the parameter when All Sites resets the filter', async () => {
    const user = userEvent.setup();
    mockSearchParamsToString.mockReturnValue('site=site-a');
    render(<DashboardSiteFilter />);

    await user.selectOptions(
      screen.getByLabelText('Site filter'),
      ALL_SITES_VALUE
    );

    expect(new URLSearchParams(window.location.search).has('site')).toBe(false);
  });

  it('initialises the selection from the URL', () => {
    mockSearchParamsGet.mockImplementation((key: string) =>
      key === 'site' ? 'site-b' : null
    );

    render(<DashboardSiteFilter />);

    expect(screen.getByLabelText('Site filter')).toHaveValue('site-b');
  });
});
